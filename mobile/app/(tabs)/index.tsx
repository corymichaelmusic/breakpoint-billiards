import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import StatsCard from "../../components/StatsCard";

import NextMatchCard from "../../components/NextMatchCard";
import BreakpointGraph from "../../components/BreakpointGraph";
import { calculateEloChange, getBreakpointLevel, fetchMatchRaces } from "../../utils/rating";
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";

export default function HomeScreen() {
  const { userId, signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get current session from context
  const { currentSession, loading: sessionLoading } = useSession();

  console.log(`[Dashboard] Render. UserID: ${userId}, isLoading: ${loading}`);

  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ winRate: 0, wl: "0-0", shutouts: 0, rank: "N/A", stats8: {}, stats9: {} });
  const [ratingHistory, setRatingHistory] = useState<any[]>([]);
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [races, setRaces] = useState<Record<string, any>>({});
  const [bountyDisplay, setBountyDisplay] = useState(false);
  const [bountyAmount, setBountyAmount] = useState(0);
  const [bountyExpanded, setBountyExpanded] = useState(false);
  const [bountyDetails, setBountyDetails] = useState<{
    val8: number; val9: number; valSnap: number; valShutout: number;
    bnr8: number; bnr9: number; snaps: number; shutoutsCount: number;
  } | null>(null);

  const lastFetchTime = useRef<number>(0);
  const lastFetchedSessionId = useRef<string | null>(null);
  const CACHE_DURATION = 60000;

  const fetchData = useCallback(async (force = false) => {
    if (sessionLoading) return;

    const now = Date.now();
    const sessionChanged = currentSession?.id !== lastFetchedSessionId.current;

    // Use cache ONLY if:
    // 1. Not forced
    // 2. Session hasn't changed
    // 3. Cache hasn't expired
    // 4. We have profile data (meaning we successfully fetched at least once)
    if (!force && !sessionChanged && lastFetchTime.current > 0 && (now - lastFetchTime.current) < CACHE_DURATION && profile) {
      console.log("Using cached dashboard data");
      setLoading(false);
      return;
    }

    lastFetchTime.current = now;
    lastFetchedSessionId.current = currentSession?.id || null;

    try {
      if (!userId) return;

      const token = await getToken({ template: 'supabase' });
      console.log(`[Dashboard] Fetching data... UserID: ${userId}, Token Available: ${!!token}`);

      if (!token) {
        console.warn("[Dashboard] ❌ No Supabase token available yet. Retrying in background...");
        // Do NOT set loading false here. Wait for token to be available.
        return;
      }

      const supabaseAuthenticated = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      // Fetch Profile
      const { data: userProfile, error: profileError } = await supabaseAuthenticated
        .from("profiles")
        .select("full_name, fargo_rating, breakpoint_rating, nickname")
        .eq("id", userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.log("Profile Fetch Error:", profileError);
      }
      setProfile(userProfile);

      // Fetch Settings
      const { data: settingsData } = await supabaseAuthenticated
        .from("system_settings")
        .select("value")
        .eq("key", "enable_bounty_display")
        .single();

      const isBountyEnabled = settingsData?.value ? settingsData.value === 'true' : true;
      setBountyDisplay(isBountyEnabled);

      if (!currentSession) {
        setLoading(false);
        return;
      }

      // Use Session from Context
      const session = currentSession;

      // Fetch Membership Details for this specific session (payment status, stats)
      const { data: membershipData, error: memError } = await supabaseAuthenticated
        .from("league_players")
        .select(`
            payment_status, matches_played, matches_won, shutouts,
            total_break_and_runs_8ball, total_rack_and_runs_8ball,
            total_break_and_runs_9ball, total_rack_and_runs_9ball, total_nine_on_snap,
            leagues!inner (
                id, name, type, status, start_date,
                bounty_val_8_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout,
                parent_league:parent_league_id(name, bounty_val_8_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout)
            )
        `)
        .eq("player_id", userId)
        .eq("league_id", session.id)
        .single();

      if (memError) {
        console.log("Error fetching active membership details:", memError);
      }

      const activeMembership: any = membershipData || {};

      setActiveSession({
        ...session,
        paid: activeMembership.payment_status === 'paid',
        payment_status: activeMembership.payment_status,
        parent_league: activeMembership.leagues?.parent_league
      });

      // Calculate Bounty based on membership stats
      const parent = activeMembership.leagues?.parent_league;
      // Handle parent array if necessary (though usually singular)
      const parentObj = Array.isArray(parent) ? parent[0] : parent;

      const val8 = activeMembership.leagues?.bounty_val_8_run ?? parentObj?.bounty_val_8_run ?? 5;
      const val9 = activeMembership.leagues?.bounty_val_9_run ?? parentObj?.bounty_val_9_run ?? 3;
      const valSnap = activeMembership.leagues?.bounty_val_9_snap ?? parentObj?.bounty_val_9_snap ?? 1;
      const valShutout = activeMembership.leagues?.bounty_val_shutout ?? parentObj?.bounty_val_shutout ?? 1;

      const bnr8 = activeMembership.total_break_and_runs_8ball || 0;
      const bnr9 = activeMembership.total_break_and_runs_9ball || 0;
      const snaps = activeMembership.total_nine_on_snap || 0;
      const shutoutsCount = activeMembership.shutouts || 0;
      setBountyAmount((bnr8 * val8) + (bnr9 * val9) + (snaps * valSnap) + (shutoutsCount * valShutout));
      setBountyDetails({ val8, val9, valSnap, valShutout, bnr8, bnr9, snaps, shutoutsCount });

      // Fetch Matches
      const { data: matchesData } = await supabaseAuthenticated
        .from("matches")
        .select(`
          *, 
          player1:player1_id(full_name, breakpoint_rating, fargo_rating), 
          player2:player2_id(full_name, breakpoint_rating, fargo_rating),
          games (*)
        `)
        .eq("league_id", session.id) // Filter by selected session
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order("scheduled_date", { ascending: true });

      const matches = matchesData || [];
      setMatches(matches);

      // Fetch Races for all matches
      if (matches.length > 0) {
        const inputs = matches.map((m: any) => ({
          id: m.id,
          p1Rating: m.player1?.fargo_rating || m.player1?.breakpoint_rating || 500,
          p2Rating: m.player2?.fargo_rating || m.player2?.breakpoint_rating || 500
        }));

        fetchMatchRaces(inputs).then(raceData => {
          if (raceData) setRaces(raceData);
        });
      }

      // DEBUG: Check for rating_history table presence
      try {
        const { data: rhData, error: rhError } = await supabaseAuthenticated.from('rating_history').select('*').limit(1);
        console.log("DEBUG: rating_history table check:", { data: rhData, error: rhError });

        const { data: prData, error: prError } = await supabaseAuthenticated.from('player_ratings').select('*').limit(1);
        console.log("DEBUG: player_ratings table check:", { data: prData, error: prError });
      } catch (err) {
        console.log("DEBUG: Table check failed", err);
      }

      // Calculate Stats
      let matchesPlayed = 0, matchesWon = 0, shutouts = 0;
      let p8_setsWon = 0, p8_setsLost = 0, p8_racksWon = 0, p8_racksLost = 0;
      let p9_setsWon = 0, p9_setsLost = 0, p9_racksWon = 0, p9_racksLost = 0;

      if (matches) {
        matches.forEach(m => {
          const isP1 = m.player1_id === userId;
          if (m.status_8ball === 'finalized') {
            const my8 = isP1 ? m.points_8ball_p1 : m.points_8ball_p2;
            const opp8 = isP1 ? m.points_8ball_p2 : m.points_8ball_p1;
            p8_racksWon += my8 || 0; p8_racksLost += opp8 || 0;
            if (m.winner_id_8ball === userId) {
              p8_setsWon++;
              matchesWon++; // Correctly increment total wins based on authoritative winner
            } else if (m.winner_id_8ball) {
              p8_setsLost++;
            }
            matchesPlayed++;
          }
          if (m.status_9ball === 'finalized') {
            const my9 = isP1 ? m.points_9ball_p1 : m.points_9ball_p2;
            const opp9 = isP1 ? m.points_9ball_p2 : m.points_9ball_p1;
            p9_racksWon += my9 || 0; p9_racksLost += opp9 || 0;
            if (m.winner_id_9ball === userId) {
              p9_setsWon++;
              matchesWon++; // Correctly increment total wins based on authoritative winner
            } else if (m.winner_id_9ball) {
              p9_setsLost++;
            }
            matchesPlayed++;
          }
          if (m.status_8ball === 'finalized' && m.status_9ball === 'finalized' && m.winner_id_8ball === userId && m.winner_id_9ball === userId) {
            shutouts++;
          }
        });
      }

      const setWinRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
      const setWL = `${matchesWon}-${matchesPlayed - matchesWon}`;

      // Calculate Rank
      let rank = "N/A";
      const { data: leaguePlayers } = await supabaseAuthenticated
        .from("league_players")
        .select("player_id, matches_won, matches_played")
        .eq("league_id", session.id);

      if (leaguePlayers) {
        const statsArray = leaguePlayers.map((p: any) => {
          const played = p.matches_played || 0;
          const wins = p.matches_won || 0;
          return {
            id: p.player_id,
            played,
            winRate: played > 0 ? Math.round((wins / played) * 100) : 0
          };
        });

        // Exact Sort order from LeaderboardScreen
        statsArray.sort((a, b) => {
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          return b.played - a.played;
        });

        // Filter out 0 matches to affect rank? Leaderboard shows them at bottom. 
        // In Dashboard "Session Rank", usually implies active rank.
        // But if user has 15-6, they definitely have matches.

        const myRankIndex = statsArray.findIndex(p => p.id === userId);
        console.log(`[Dashboard] Rank Calculation: Found user at index ${myRankIndex} of ${statsArray.length} players.`);
        if (myRankIndex !== -1) {
          rank = `#${myRankIndex + 1}`;
        }
      }

      // Calculate Rating History (Hybrid: Snapshots + Reverse Calculation)
      let history: any[] = [];
      let runningRating = 500;
      if (userProfile) { // Safe check
        runningRating = userProfile.breakpoint_rating || userProfile.fargo_rating || 500;
      }

      // Safety check for starting point
      if (isNaN(runningRating)) runningRating = 500;

      // Push current state (The "End" of the graph)
      history.push({
        date: new Date().toISOString(),
        rating: parseFloat(getBreakpointLevel(runningRating))
      });

      if (matches) {
        // Sort Newest -> Oldest for walking backwards
        // Prefer submitted_at (actual finish time) > created_at > scheduled_date
        const sortedMatches = matches
          .filter(m => m.status === 'finalized' || (m.status_8ball === 'finalized' && m.status_9ball === 'finalized'))
          .sort((a, b) => {
            const tA = new Date(a.submitted_at || a.created_at || a.scheduled_date).getTime();
            const tB = new Date(b.submitted_at || b.created_at || b.scheduled_date).getTime();
            return tB - tA;
          });

        console.log(`[Dashboard] Graph: Processing ${sortedMatches.length} matches for history.`);

        for (const m of sortedMatches) {
          const isP1 = m.player1_id === userId;
          const opponent = isP1 ? m.player2 : m.player1;
          let oppRating = opponent?.breakpoint_rating || opponent?.fargo_rating || 500;
          if (isNaN(oppRating)) oppRating = 500;

          // 1. Try to find a Snapshot (Ground Truth)
          // The snapshot 'bbrs_rating_start' is the rating BEFORE this match was played.
          let snapshotVal = null;
          if (m.games && m.games.length > 0) {
            // Check all games, prioritize the first one
            const firstGame = m.games.sort((a: any, b: any) => (a.game_number || 0) - (b.game_number || 0))[0];
            if (firstGame) {
              const rawSnapshot = isP1 ? firstGame.bbrs_player1_rating_start : firstGame.bbrs_player2_rating_start;
              if (rawSnapshot && !isNaN(rawSnapshot)) {
                snapshotVal = rawSnapshot;
              }
            }
          }

          // 2. Determine Rating BEFORE this match
          let previousRating;

          if (snapshotVal) {
            // We have exact data! Use it.
            previousRating = snapshotVal;
          } else {
            // No snapshot (Legacy match). We must calculate Reverse Elo.
            // Did we win?
            let mySets = 0, oppSets = 0;
            if (m.winner_id_8ball) { isP1 ? (m.winner_id_8ball === userId ? mySets++ : oppSets++) : (m.winner_id_8ball === userId ? mySets++ : oppSets++) }
            if (m.winner_id_9ball) { isP1 ? (m.winner_id_9ball === userId ? mySets++ : oppSets++) : (m.winner_id_9ball === userId ? mySets++ : oppSets++) }
            const wonMatch = mySets > oppSets;
            const draw = mySets === oppSets;

            if (draw) {
              previousRating = runningRating; // No change
            } else {
              // Current = Previous + Change
              // Previous = Current - Change
              const change = calculateEloChange(runningRating, oppRating, wonMatch);

              if (isNaN(change)) {
                console.warn("NaN Elo Change detected", { runningRating, oppRating });
                previousRating = runningRating;
              } else {
                // If I won, change is positive. Previous was lower.
                // If I lost, change is negative. Previous was higher.
                // So Previous = Current - Change works.
                previousRating = runningRating - change;
              }
            }
          }

          // Clamp previousRating to prevent runaway values
          previousRating = Math.max(100, Math.min(1000, previousRating));

          // 3. Push the "Before" state for this match
          // Use submitted_at/created_at for better X-axis distribution
          const matchDate = m.submitted_at || m.created_at || m.scheduled_date;

          history.push({
            date: matchDate,
            rating: parseFloat(getBreakpointLevel(previousRating))
          });

          // 4. Update runningRating for the NEXT iteration (which is the OLDER match)
          runningRating = previousRating;
        }
      }

      // Reverse back to text chronological order (Oldest -> Newest) for the Graph
      history.reverse();

      setRatingHistory(history);

      setStats({
        winRate: setWinRate,
        wl: setWL,
        shutouts: shutouts,
        rank: rank,
        stats8: {
          br: activeMembership.total_break_and_runs_8ball || 0,
          rr: activeMembership.total_rack_and_runs_8ball || 0,
          racksWon: p8_racksWon, racksLost: p8_racksLost,
          rackWinRate: (p8_racksWon + p8_racksLost > 0) ? Math.round((p8_racksWon / (p8_racksWon + p8_racksLost)) * 100) : 0,
          setsWon: p8_setsWon, setsLost: p8_setsLost,
          setWinRate: (p8_setsWon + p8_setsLost > 0) ? Math.round((p8_setsWon / (p8_setsWon + p8_setsLost)) * 100) : 0
        },
        stats9: {
          br: activeMembership.total_break_and_runs_9ball || 0,
          rr: activeMembership.total_rack_and_runs_9ball || 0,
          snap: activeMembership.total_nine_on_snap || 0,
          racksWon: p9_racksWon, racksLost: p9_racksLost,
          rackWinRate: (p9_racksWon + p9_racksLost > 0) ? Math.round((p9_racksWon / (p9_racksWon + p9_racksLost)) * 100) : 0,
          setsWon: p9_setsWon, setsLost: p9_setsLost,
          setWinRate: (p9_setsWon + p9_setsLost > 0) ? Math.round((p9_setsWon / (p9_setsWon + p9_setsLost)) * 100) : 0
        }
      });

      // Next Match Logic
      const nextUp = matches?.find(m => {
        const is8Final = m.status_8ball === 'finalized';
        const is9Final = m.status_9ball === 'finalized';
        const isFullyFinalized = m.status === 'finalized' || (is8Final && is9Final);
        return !isFullyFinalized;
      });
      setNextMatch(nextUp);
      setNextMatch(nextUp);
    } catch (e) {
      console.error(e);
    } finally {
      if (!sessionLoading) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, getToken, router, user, currentSession, sessionLoading]);

  useFocusEffect(useCallback(() => { fetchData(false); }, [fetchData]));

  // Force re-fetch when session context finishes loading
  useEffect(() => {
    if (!sessionLoading) {
      fetchData(false);
    }
  }, [sessionLoading]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(true); }, [fetchData]);

  // Loading Guard: Prevent stutter or flash of "No Session"
  // Keep showing loader until:
  // 1. Session context has finished loading (sessionLoading is false)
  // 2. Dashboard fetch has completed (loading is false) 
  // 3. If user has a session in context, we must wait for activeSession to be populated
  const shouldShowLoader = sessionLoading || loading || (currentSession && !activeSession);

  if (shouldShowLoader) {
    return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;
  }

  // Calculate special stats for Render
  const getSpecialStats = (match: any) => {
    if (!match || !match.games) return undefined;
    let p1_8br = 0, p2_8br = 0;
    let p1_9br = 0, p2_9br = 0;
    let p1_snap = 0, p2_snap = 0;

    match.games.forEach((g: any) => {
      if (g.is_break_and_run) {
        if (g.game_type === '8ball') {
          if (g.winner_id === match.player1_id) p1_8br++;
          else if (g.winner_id === match.player2_id) p2_8br++;
        } else if (g.game_type === '9ball') {
          if (g.winner_id === match.player1_id) p1_9br++;
          else if (g.winner_id === match.player2_id) p2_9br++;
        }
      }
      if (g.is_9_on_snap) {
        if (g.winner_id === match.player1_id) p1_snap++;
        else if (g.winner_id === match.player2_id) p2_snap++;
      }
    });
    return { p1_8br, p2_8br, p1_9br, p2_9br, p1_snap, p2_snap };
  };

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-2 items-center bg-background border-b border-border/50">
        <Text className="text-foreground text-2xl font-bold tracking-wider uppercase text-center" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
          {activeSession?.name || 'Welcome'}
        </Text>

        {activeSession?.parent_league?.name && (
          <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
            {activeSession.parent_league.name}
          </Text>
        )}
        {bountyDisplay && (
          <TouchableOpacity
            onPress={() => setBountyExpanded(!bountyExpanded)}
            activeOpacity={0.8}
            className="items-center w-full"
          >
            <View className="bg-green-900/40 border border-green-500/50 rounded-full px-4 py-1 mt-3 mb-1 flex-row items-center justify-center max-w-[80%]">
              <Ionicons name={bountyExpanded ? "chevron-up" : "cash-outline"} size={16} color="#4ade80" style={{ marginRight: 6 }} />
              <Text className="text-green-400 font-bold text-sm tracking-wide" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                BOUNTY: ${bountyAmount}
              </Text>
            </View>

            {bountyExpanded && bountyDetails && (
              <View className="bg-black/40 border border-green-500/30 rounded-lg p-3 mt-1 w-[90%] max-w-sm">
                <Text className="text-green-400 font-bold text-xs mb-2 text-center uppercase tracking-widest border-b border-green-500/30 pb-1">Bounty Breakdown</Text>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">8-Ball B&R (${bountyDetails.val8})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.bnr8} = ${bountyDetails.bnr8 * bountyDetails.val8}</Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">9-Ball B&R (${bountyDetails.val9})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.bnr9} = ${bountyDetails.bnr9 * bountyDetails.val9}</Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">9-on-Snap (${bountyDetails.valSnap})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.snaps} = ${bountyDetails.snaps * bountyDetails.valSnap}</Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-gray-400 text-xs">Shutouts (${bountyDetails.valShutout})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.shutoutsCount} = ${bountyDetails.shutoutsCount * bountyDetails.valShutout}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}>
        {!activeSession ? (
          <View className="items-center justify-center py-10 mt-10">
            <View className="bg-surface/50 p-8 rounded-full mb-6 border border-border/30">
              <FontAwesome5 name="users" size={40} color="#D4AF37" />
            </View>
            <Text className="text-white text-2xl font-bold mb-3 tracking-wide">No Active Session</Text>
            <Text className="text-gray-400 text-center mb-8 px-8 leading-6 text-base">
              You haven't joined a league session yet.{"\n"}Join a session to start tracking your stats and matches.
            </Text>
            <TouchableOpacity onPress={() => router.push('/onboarding/select-league')} className="bg-primary px-8 py-4 rounded-full shadow-lg shadow-black/50 mb-4 w-full" activeOpacity={0.8}>
              <Text className="text-black font-bold uppercase tracking-wider text-sm text-center w-full" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>Find a Session</Text>
            </TouchableOpacity>


          </View>
        ) : (
          <>
            {activeSession.payment_status === 'unpaid' && (
              <View className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className="text-red-100 font-bold text-base mb-1" style={{ includeFontPadding: false }}>Session Fee Unpaid</Text>
                  <Text className="text-red-200 text-xs">All players must pay session fee to start.</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Pay Fee", "Please see your League Operator to pay.")} className="bg-red-500 px-4 py-2 rounded-full">
                  <Text className="text-white font-bold text-xs" style={{ includeFontPadding: false }}>PAY NOW</Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="flex-row gap-2 mb-4">
              <StatsCard label="Win Rate" value={`${stats.winRate}%`} highlight />
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => router.push("/(tabs)/leaderboard")}
                activeOpacity={0.7}
              >
                <StatsCard label="Session Rank" value={stats.rank} />
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2 mb-6">
              <StatsCard label="Set W-L" value={stats.wl} />
              <StatsCard label="Shutouts" value={stats.shutouts} />
            </View>

            <View className="bg-surface border border-border rounded-xl p-4 mb-6">
              <Text className="text-foreground text-xl font-bold mb-4 border-b border-border pb-2" style={{ includeFontPadding: false }}>Session Breakdown</Text>
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2 pr-4">
                    <Text className="text-[#D4AF37] font-bold text-lg uppercase shrink-0" style={{ includeFontPadding: false }}>8-Ball</Text>
                    <View>
                      <Text className="text-gray-400 text-sm font-bold" style={{ includeFontPadding: false }}>{stats.stats8?.setsWon || 0}-{stats.stats8?.setsLost || 0} </Text>
                    </View>
                    <View className="min-w-[50px]">
                      <Text className="text-gray-500 text-xs font-bold" style={{ includeFontPadding: false }}>({stats.stats8?.setWinRate || 0}%)   </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-sm font-bold uppercase">Racks: <Text className="text-white">{stats.stats8?.racksWon}-{stats.stats8?.racksLost}</Text> <Text className="text-gray-500">({stats.stats8?.rackWinRate}%)</Text></Text>
                  </View>
                </View>
                <StatRow label="Break & Run" value={stats.stats8?.br || 0} />
                <StatRow label="Rack & Run" value={stats.stats8?.rr || 0} />

              </View>
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-2 pr-4">
                    <Text className="text-primary font-bold text-lg uppercase shrink-0" style={{ includeFontPadding: false }}>9-Ball</Text>
                    <View>
                      <Text className="text-gray-400 text-sm font-bold" style={{ includeFontPadding: false }}>{stats.stats9?.setsWon || 0}-{stats.stats9?.setsLost || 0} </Text>
                    </View>
                    <View className="min-w-[50px]">
                      <Text className="text-gray-500 text-xs font-bold" style={{ includeFontPadding: false }}>({stats.stats9?.setWinRate || 0}%)   </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="text-gray-500 text-sm font-bold uppercase">Racks: <Text className="text-white">{stats.stats9?.racksWon}-{stats.stats9?.racksLost}</Text> <Text className="text-gray-500">({stats.stats9?.rackWinRate}%)</Text></Text>
                  </View>
                </View>
                <StatRow label="Break & Run" value={stats.stats9?.br || 0} />
                <StatRow label="Rack & Run" value={stats.stats9?.rr || 0} />
                <StatRow label="9 on Snap" value={stats.stats9?.snap || 0} />

              </View>
            </View>

            <BreakpointGraph data={ratingHistory} />

            {nextMatch ? (
              (() => {
                // Logic for status calculation (Same as MatchesScreen)
                const now = new Date();
                const scheduledDate = new Date(nextMatch.scheduled_date);
                const windowStart = new Date(scheduledDate);
                windowStart.setHours(8, 0, 0, 0);
                const windowEnd = new Date(windowStart);
                windowEnd.setDate(windowEnd.getDate() + 1);

                const isTimeOpen = now >= windowStart && now < windowEnd;

                const isBothSetsFinalized = nextMatch.status_8ball === 'finalized' && nextMatch.status_9ball === 'finalized';
                const totalPoints = (nextMatch.points_8ball_p1 || 0) + (nextMatch.points_8ball_p2 || 0) + (nextMatch.points_9ball_p1 || 0) + (nextMatch.points_9ball_p2 || 0);
                const isStarted = totalPoints > 0;

                let effectiveStatus = nextMatch.status;
                if (nextMatch.status === 'finalized' || isBothSetsFinalized) {
                  effectiveStatus = 'finalized';
                } else if (isStarted) {
                  effectiveStatus = 'in_progress';
                }

                const isMatchLocked = !nextMatch.is_manually_unlocked && !isTimeOpen && effectiveStatus !== 'finalized' && effectiveStatus !== 'in_progress';

                const formattedDate = nextMatch.scheduled_date ? new Date(nextMatch.scheduled_date).toLocaleDateString() : 'TBD';

                // Get race from state (fetched server-side)
                const matchRaces = races[nextMatch.id];
                const racesForCard = matchRaces ? {
                  p1_8: matchRaces.race8.p1, p2_8: matchRaces.race8.p2,
                  p1_9: matchRaces.race9.p1, p2_9: matchRaces.race9.p2
                } : undefined;

                return (
                  <NextMatchCard
                    opponentName={nextMatch.player1_id === userId ? nextMatch.player2?.full_name : nextMatch.player1?.full_name || 'Unknown'}
                    date={formattedDate}
                    isLocked={isMatchLocked}
                    matchId={nextMatch.id}
                    leagueName={activeSession.parent_league?.name}
                    sessionName={activeSession.name}
                    weekNumber={nextMatch.week_number}
                    status={effectiveStatus}
                    player1Id={nextMatch.player1_id}
                    player2Id={nextMatch.player2_id}
                    paymentStatusP1={nextMatch.payment_status_p1}
                    paymentStatusP2={nextMatch.payment_status_p2}
                    label={`Week ${nextMatch.week_number}`}
                    scores={{ p1_8: nextMatch.points_8ball_p1, p2_8: nextMatch.points_8ball_p2, p1_9: nextMatch.points_9ball_p1, p2_9: nextMatch.points_9ball_p2, isPlayer1: nextMatch.player1_id === userId }}
                    specialStats={getSpecialStats(nextMatch)}
                    verificationStatus={nextMatch.verification_status}
                    p1SubmittedAt={nextMatch.p1_submitted_at}
                    p2SubmittedAt={nextMatch.p2_submitted_at}
                    races={racesForCard}
                  />
                );
              })()
            ) : (
              <View className="bg-surface p-6 rounded-lg border border-border items-center justify-center mb-6">
                <Text className="text-gray-500 text-center italic mt-4" style={{ includeFontPadding: false }}>No scheduled matches.</Text>
              </View>
            )}

            <View className="mb-8 items-center gap-4">
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/matches")}
                className="bg-secondary px-6 py-3 rounded-full border border-border w-full items-center"
              >
                <Text className="text-white font-bold uppercase text-xs tracking-widest text-center w-full" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>Session Schedule</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/onboarding/select-league')} className="px-6 py-3 rounded-full border border-gray-700 w-full items-center active:bg-white/5">
                <Text className="text-gray-400 font-bold uppercase text-xs tracking-widest text-center w-full" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>Join New Session</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string, value: string | number }) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-border/50 last:border-0">
      <Text className="text-gray-400 font-medium text-sm flex-1 mr-2" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      <View className="min-w-[60px] items-end pr-4 shrink-0">
        <Text className="text-foreground font-bold text-lg text-right" style={{ includeFontPadding: false }}>{value} </Text>
      </View>
    </View>
  );
}
