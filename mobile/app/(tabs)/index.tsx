import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import StatsCard from "../../components/StatsCard";
import NextMatchCard from "../../components/NextMatchCard";
import BreakpointGraph from "../../components/BreakpointGraph";
import { calculateEloChange, getBreakpointLevel } from "../../utils/rating";
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function HomeScreen() {
  const { userId, signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [stats, setStats] = useState<any>({ winRate: 0, wl: "0-0", shutouts: 0, rank: "N/A", stats8: {}, stats9: {} });
  const [ratingHistory, setRatingHistory] = useState<any[]>([]);
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [displayRating, setDisplayRating] = useState<number | null>(null);
  const [bountyDisplay, setBountyDisplay] = useState(false);
  const [bountyAmount, setBountyAmount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      if (!userId) return;

      // 1. Authenticate Supabase (Bypass GoTrue)
      const token = await getToken({ template: 'supabase' });

      if (!token) {
        console.warn("No Supabase token available. Retrying or Aborting...");
        // Use default anon client if no token? Or just abort? 
        // If we need user data, we need token.
        // Let's try to wait a bit and retry? No, simpler to just abort and let refresh handle it.
        setLoading(false);
        return;
      }

      // We'll create a new client for authenticated requests
      const supabaseAuthenticated = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      // 2. Fetch Profile and Memberships in Parallel
      // We start both requests immediately to reduce waterfall latency
      const profilePromise = supabaseAuthenticated
        .from("profiles")
        .select("full_name, fargo_rating, breakpoint_rating, nickname")
        .eq("id", userId)
        .single();

      const membershipPromise = supabaseAuthenticated
        .from("league_players")
        .select(`
            league_id,
            payment_status,
            matches_played,
            matches_won,
            shutouts,
            total_break_and_runs_8ball,
            total_rack_and_runs_8ball,
            total_win_zip_8ball,
            total_break_and_runs_9ball,
            total_rack_and_runs_9ball,
            total_nine_on_snap,
            total_win_zip_9ball,
            leagues!inner (
                id,
                name,
                type,
                status,
                start_date,
                bounty_val_8_run,
                bounty_val_9_run,
                bounty_val_9_snap,
                bounty_val_shutout,
                parent_league:parent_league_id(
                    name,
                    bounty_val_8_run,
                    bounty_val_9_run,
                    bounty_val_9_snap,
                    bounty_val_shutout
                )
            )
        `)
        .eq("player_id", userId)
        .in("leagues.status", ["active", "setup"])
        .order("joined_at", { ascending: false });

      const settingsPromise = supabaseAuthenticated
        .from("system_settings")
        .select("value")
        .eq("key", "enable_bounty_display")
        .single();

      const [profileResult, membershipResult, settingsResult] = await Promise.all([profilePromise, membershipPromise, settingsPromise]);

      const { data: profileData, error: profileError } = profileResult;
      const { data: memberships, error: membershipError } = membershipResult;

      // Handle Settings
      const settingValue = settingsResult.data?.value;
      const isBountyEnabled = settingValue ? settingValue === 'true' : true;
      setBountyDisplay(isBountyEnabled);

      let userProfile = profileData;

      if (profileError && profileError.code !== 'PGRST116') {
        console.log("Profile Fetch Error:", profileError);
        Alert.alert("Connection Error", "Failed to load profile. Please checking internet connection.");
        setLoading(false);
        return;
      }

      if (!userProfile) {
        console.log("Profile not found. Creating...");
        const email = user?.primaryEmailAddress?.emailAddress;
        const fullName = user?.fullName || user?.firstName || 'Player';
        const avatarUrl = user?.imageUrl;

        const performProfileCreation = async (attemptToken: string) => {
          const client = createClient(
            process.env.EXPO_PUBLIC_SUPABASE_URL!,
            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${attemptToken}` } } }
          );
          return await client.from('profiles').upsert({ id: userId, email, full_name: fullName, avatar_url: avatarUrl, role: 'player' }).select().single();
        };

        let { data: newProfile, error: createError } = await performProfileCreation(token);

        if (createError && (createError.code === 'PGRST303' || createError.message?.includes('JWT expired'))) {
          const freshToken = await getToken({ template: 'supabase' });
          if (freshToken) {
            const retry = await performProfileCreation(freshToken);
            newProfile = retry.data;
            createError = retry.error;
          }
        }

        if (createError) {
          console.error("Failed to create profile:", createError);
          Alert.alert("Connection Error", "Could not create/fetch profile.");
          setLoading(false);
        } else {
          userProfile = newProfile;
        }
      }
      setProfile(userProfile);

      if (membershipError) {
        console.log("Membership fetch error:", JSON.stringify(membershipError, null, 2));
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        console.log("DEBUG: No memberships found for user", userId);
        return;
      }

      const activeMembership = memberships?.find((m: any) => m.leagues.type === 'session') || memberships?.[0];

      if (activeMembership) {
        if (activeMembership.payment_status === 'unpaid') {
          console.log("User has not paid session fee.");
        }

        const session = activeMembership.leagues;
        const sessionWithStatus = {
          ...session,
          paid: activeMembership.payment_status === 'paid',
          payment_status: activeMembership.payment_status
        };
        setActiveSession(sessionWithStatus);

        const bnr8 = activeMembership.total_break_and_runs_8ball || 0;
        const bnr9 = activeMembership.total_break_and_runs_9ball || 0;
        const snaps = activeMembership.total_nine_on_snap || 0;
        const shutoutsCount = activeMembership.shutouts || 0;

        const parent = session.parent_league;
        const val8 = session.bounty_val_8_run ?? parent?.bounty_val_8_run ?? 5;
        const val9 = session.bounty_val_9_run ?? parent?.bounty_val_9_run ?? 3;
        const valSnap = session.bounty_val_9_snap ?? parent?.bounty_val_9_snap ?? 1;
        const valShutout = session.bounty_val_shutout ?? parent?.bounty_val_shutout ?? 1;

        const totalBounty = (bnr8 * val8) + (bnr9 * val9) + (snaps * valSnap) + (shutoutsCount * valShutout);
        setBountyAmount(totalBounty);

        // 3. Fetch Matches
        const { data: matches } = await supabaseAuthenticated
          .from("matches")
          .select(`
            *,
            player1:player1_id(full_name),
            player2:player2_id(full_name)
          `)
          .eq("league_id", session.id) // Filter by league
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
          .order("scheduled_date", { ascending: true }); // Order by date

        // 4. Fetch Leaderboard & Current Global Rating
        let sessionRank = 'N/A';
        const { data: allPlayers } = await supabaseAuthenticated
          .from('league_players')
          .select('player_id, matches_played, matches_won')
          .eq('league_id', session.id);

        // FETCH GLOBAL PROFILE RATING
        // We need this to anchor the graph correctly so it ends at the current actual rating.
        const { data: profileData } = await supabaseAuthenticated
          .from('profiles')
          .select('breakpoint_rating')
          .eq('id', userId)
          .single();

        const globalRating = profileData?.breakpoint_rating || 500;

        // FETCH ALL FINALIZED MATCHES FOR HISTORY (Global, not just session)
        const { data: globalHistory } = await supabaseAuthenticated
          .from('matches')
          .select('id, created_at, scheduled_date, status_8ball, status_9ball, points_8ball_p1, points_8ball_p2, points_9ball_p1, points_9ball_p2, player1_id, player2_id')
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
          .order('scheduled_date', { ascending: true })
          .order('created_at', { ascending: true });

        if (allPlayers && allPlayers.length > 0) {
          // Calculate Win Rates and Sort
          const sortedPlayers = allPlayers.map(p => ({
            id: p.player_id,
            winRate: p.matches_played > 0 ? (p.matches_won / p.matches_played) : 0
          })).sort((a, b) => b.winRate - a.winRate);

          const myRankIndex = sortedPlayers.findIndex(p => p.id === userId);
          if (myRankIndex !== -1) {
            sessionRank = `#${myRankIndex + 1}`;
          }
        }

        // 5. Calculate Stats and Rating History
        // STRATEGY: "Shape & Shift" (Global Version)
        // 1. Simulate the ENTIRE history forward from 500.
        // 2. Shift to match Reality.

        const rawHistory: { date: string, rawRating: number }[] = [];
        let simRating = 500;

        // We track session specific stats separately below, this loop is JUST for the graph
        if (globalHistory) {
          globalHistory.forEach(m => {
            const isP1 = m.player1_id === userId;
            const p1Pts8 = m.points_8ball_p1 || 0;
            const p2Pts8 = m.points_8ball_p2 || 0;
            const p1Pts9 = m.points_9ball_p1 || 0;
            const p2Pts9 = m.points_9ball_p2 || 0;

            let didUpdate = false;
            let currentMatchRating = simRating; // Snapshot before match? or after? usually we track 'updates'. 

            // --- 8-Ball Set ---
            if (m.status_8ball === 'finalized') {
              const my8 = isP1 ? p1Pts8 : p2Pts8;
              const opp8 = isP1 ? p2Pts8 : p1Pts8;

              if (my8 !== opp8) {
                const delta8 = calculateEloChange(simRating, 500, my8 > opp8);
                simRating += delta8;
                didUpdate = true;
              }
            }

            // --- 9-Ball Set ---
            if (m.status_9ball === 'finalized') {
              const my9 = isP1 ? p1Pts9 : p2Pts9;
              const opp9 = isP1 ? p2Pts9 : p1Pts9;

              if (my9 !== opp9) {
                const delta9 = calculateEloChange(simRating, 500, my9 > opp9);
                simRating += delta9;
                didUpdate = true;
              }
            }

            // Capture History Point
            if (didUpdate || m.status_8ball === 'finalized' || m.status_9ball === 'finalized') {
              rawHistory.push({
                date: m.scheduled_date || m.created_at,
                rawRating: simRating
              });
            }
          });
        }

        // Apply Offset
        // We anchor the END of the graph to the globalRating
        const finalSim = simRating;
        const offset = globalRating - finalSim;

        const history = rawHistory.map(p => ({
          date: p.date,
          rating: parseFloat(getBreakpointLevel(p.rawRating + offset))
        }));

        // --- SESSION SPECIFIC STATS (Win Rates etc) ---
        // Use the 'matches' array which is filtered by activeSession
        let matchesPlayed = 0;
        let matchesWon = 0;
        let totalPoints = 0;

        if (matches) {
          matches.forEach(m => {
            const isP1 = m.player1_id === userId;
            // ... existing stats logic ...
            if (m.status_8ball === 'finalized') {
              matchesPlayed++;
              const my8 = isP1 ? (m.points_8ball_p1 || 0) : (m.points_8ball_p2 || 0);
              const opp8 = isP1 ? (m.points_8ball_p2 || 0) : (m.points_8ball_p1 || 0);
              totalPoints += my8;
              if (my8 > opp8) matchesWon++;
            }
            if (m.status_9ball === 'finalized') {
              matchesPlayed++;
              const my9 = isP1 ? (m.points_9ball_p1 || 0) : (m.points_9ball_p2 || 0);
              const opp9 = isP1 ? (m.points_9ball_p2 || 0) : (m.points_9ball_p1 || 0);
              totalPoints += my9;
              if (my9 > opp9) matchesWon++;
            }
          });
        }

        // Determine Next Match (Correct logic using is_manually_unlocked from DB)
        let nextUp = null;
        if (matches && matches.length > 0) {
          nextUp = matches.find(m => {
            const is8Final = m.status_8ball === 'finalized';
            const is9Final = m.status_9ball === 'finalized';
            const isFullyFinalized = m.status === 'finalized' || (is8Final && is9Final);
            return !isFullyFinalized;
          });

          // If all matches are completed, nextUp will be undefined (null)
          // Ideally we show "Season Complete" or similar?
          // For now, null means the card won't render, or we can fallback to the last match if desired.
          // But usually "No upcoming matches" is shown if null.
        }

        // RE-FETCH Next Match specifically to get is_manually_unlocked reliably?
        // Or just trust this list if it includes is_manually_unlocked.
        // The query above selects `*`. So it has it.

        // 5. Calculate New Stats: Win Rate, Set W-L, Shutouts
        // Win Rate = Sets Won / Sets Played (Already matchesPlayed/matchesWon logic above)
        const setWinRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;

        // Set W-L
        const matchesLost = matchesPlayed - matchesWon;
        const setWL = `${matchesWon}-${matchesLost}`;

        // Shutouts: Wins both 8-ball and 9-ball in a single match
        let shutouts = 0;
        // We need to iterate matches again or do it in the loop above?
        // The loop above iterates `matches` (my matches).
        // We can just re-iterate or check inside.
        // We can just re-iterate or check inside.
        if (matches) {
          matches.forEach(m => {
            // Check if I won BOTH sets
            const isP1 = m.player1_id === userId;
            const won8 = m.status_8ball === 'finalized' && (isP1 ? m.winner_id_8ball === userId : m.winner_id_8ball === userId);
            // Wait, winner_id check: if m.winner_id_8ball === userId. simple.
            const won8Simple = m.status_8ball === 'finalized' && m.winner_id_8ball === userId;
            const won9Simple = m.status_9ball === 'finalized' && m.winner_id_9ball === userId;

            if (won8Simple && won9Simple) {
              shutouts++;
            }
          });
        }

        // Update State
        // Re-mapped stats object to new requirements
        // winRate -> Win Rate %
        // pointsPerMatch -> Set W-L
        // totalPoints -> Shutouts
        // Fargo -> Rank

        // Calculate Session-Specific Granular Stats from Matches
        let p8_racksWon = 0;
        let p8_racksLost = 0;
        let p8_setsWon = 0;
        let p8_setsLost = 0;

        let p9_racksWon = 0;
        let p9_racksLost = 0;
        let p9_setsWon = 0;
        let p9_setsLost = 0;

        if (matches) {
          matches.forEach(m => {
            const isP1 = m.player1_id === userId;
            if (m.status_8ball === 'finalized') {
              p8_racksWon += isP1 ? (m.points_8ball_p1 || 0) : (m.points_8ball_p2 || 0);
              p8_racksLost += isP1 ? (m.points_8ball_p2 || 0) : (m.points_8ball_p1 || 0);

              if (m.winner_id_8ball === userId) p8_setsWon++;
              else if (m.winner_id_8ball) p8_setsLost++;
            }
            if (m.status_9ball === 'finalized') {
              p9_racksWon += isP1 ? (m.points_9ball_p1 || 0) : (m.points_9ball_p2 || 0);
              p9_racksLost += isP1 ? (m.points_9ball_p2 || 0) : (m.points_9ball_p1 || 0);

              if (m.winner_id_9ball === userId) p9_setsWon++;
              else if (m.winner_id_9ball) p9_setsLost++;
            }
          });
        }

        const p8_totalRacks = p8_racksWon + p8_racksLost;
        const p8_winRate = p8_totalRacks > 0 ? Math.round((p8_racksWon / p8_totalRacks) * 100) : 0;
        const p8_setsPlayed = p8_setsWon + p8_setsLost;
        const p8_setWinRate = p8_setsPlayed > 0 ? Math.round((p8_setsWon / p8_setsPlayed) * 100) : 0;

        const p9_totalRacks = p9_racksWon + p9_racksLost;
        const p9_winRate = p9_totalRacks > 0 ? Math.round((p9_racksWon / p9_totalRacks) * 100) : 0;
        const p9_setsPlayed = p9_setsWon + p9_setsLost;
        const p9_setWinRate = p9_setsPlayed > 0 ? Math.round((p9_setsWon / p9_setsPlayed) * 100) : 0;


        // Update State
        // Re-mapped stats object to new requirements
        setStats({
          winRate: setWinRate,
          wl: setWL,
          shutouts: shutouts,
          rank: sessionRank,
          stats8: {
            br: activeMembership.total_break_and_runs_8ball || 0,
            rr: activeMembership.total_rack_and_runs_8ball || 0,
            winZip: activeMembership.total_win_zip_8ball || 0,
            racksWon: p8_racksWon,
            racksLost: p8_racksLost,
            rackWinRate: p8_winRate,
            setsWon: p8_setsWon,
            setsLost: p8_setsLost,
            setWinRate: p8_setWinRate
          },
          stats9: {
            br: activeMembership.total_break_and_runs_9ball || 0,
            rr: activeMembership.total_rack_and_runs_9ball || 0,
            winZip: activeMembership.total_win_zip_9ball || 0,
            snap: activeMembership.total_nine_on_snap || 0,
            racksWon: p9_racksWon,
            racksLost: p9_racksLost,
            rackWinRate: p9_winRate,
            setsWon: p9_setsWon,
            setsLost: p9_setsLost,
            setWinRate: p9_setWinRate
          }
        });

        // Persist Graph Data: Only update if we have data, or if it's the first load
        if (history.length > 0 || ratingHistory.length === 0) {
          setRatingHistory(history);
        }

        setNextMatch(nextUp);
        // setDisplayRating(currentRatingVal); // REMOVED: Calculated from Global Profile now.
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, getToken, router, user]); // Correctly wrapped in useCallback

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Derived state for lock
  const isMatchLocked = nextMatch ? (
    !nextMatch.is_manually_unlocked &&
    new Date(nextMatch.scheduled_date).toDateString() !== new Date().toDateString()
  ) : true;

  // Don't show full-screen loader if we already have data (background refresh)
  if (loading && !profile) {
    return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;
  }



  return (
    <SafeAreaView className="flex-1 bg-background">

      {/* Session Name Header */}
      <View className="px-4 pt-4 pb-2 items-center bg-background border-b border-border/50">
        <Text className="text-foreground text-2xl font-bold tracking-wider uppercase text-center">
          {activeSession?.name || '...'}
        </Text>
        {activeSession?.parent_league?.name && (
          <Text className="text-primary font-bold tracking-widest uppercase text-sm mt-1">
            {activeSession.parent_league.name}
          </Text>
        )}

        {/* BOUNTY BADGE */}
        {bountyDisplay && (
          <View className="bg-green-900/40 border border-green-500/50 rounded-full px-4 py-1 mt-3 mb-1 flex-row items-center">
            <Ionicons name="cash-outline" size={16} color="#4ade80" style={{ marginRight: 6 }} />
            <Text className="text-green-400 font-bold text-sm tracking-wide">
              BOUNTY: ${bountyAmount}
            </Text>
          </View>
        )}
      </View>


      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
      >


        {/* PAYMENT NOTIFICATION */}
        {activeSession && activeSession.payment_status === 'unpaid' && (
          <View className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-red-100 font-bold text-base mb-1">Session Fee Unpaid</Text>
              <Text className="text-red-200 text-xs">All players must pay session fee in order for session to start.</Text>
            </View>
            <TouchableOpacity onPress={() => Alert.alert("Pay Fee", "Please see your League Operator to pay.")} className="bg-red-500 px-4 py-2 rounded-full">
              <Text className="text-white font-bold text-xs">PAY NOW</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="flex-row gap-2 mb-4">
          <StatsCard label="Win Rate" value={`${stats.winRate}%`} highlight />
          <StatsCard
            label="Session Rank"
            value={
              ['#1', '#2', '#3'].includes(stats.rank) ? (
                <View className="flex-row items-center gap-2">
                  <FontAwesome5
                    name="crown"
                    size={16}
                    color={stats.rank === '#1' ? "#FFD700" : stats.rank === '#2' ? "#C0C0C0" : "#CD7F32"}
                  />
                  <Text className="text-2xl font-bold text-foreground">{stats.rank}</Text>
                </View>
              ) : (
                stats.rank
              )
            }
          />
        </View>
        <View className="flex-row gap-2 mb-6">
          <StatsCard label="Set W-L" value={stats.wl} />
          <StatsCard label="Shutouts" value={stats.shutouts} />
        </View>

        {/* Detailed Session Stats Accordion/Section */}
        <View className="bg-surface border border-border rounded-xl p-4 mb-6">
          <Text className="text-foreground text-xl font-bold mb-4 border-b border-border pb-2">Session Breakdown</Text>

          {/* 8-Ball */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-end gap-2">
                <Text className="text-[#D4AF37] font-bold text-lg uppercase">8-Ball</Text>
                <Text className="text-gray-400 text-sm font-bold mb-[2px]">
                  {stats.stats8?.setsWon || 0}-{stats.stats8?.setsLost || 0} ({stats.stats8?.setWinRate || 0}%)
                </Text>
              </View>
              <Text className="text-gray-400 text-xs font-bold">
                {(stats.stats8?.racksWon || 0) + (stats.stats8?.racksLost || 0)} Racks: {stats.stats8?.racksWon || 0}-{stats.stats8?.racksLost || 0} ({stats.stats8?.rackWinRate || 0}%)
              </Text>
            </View>
            <StatRow label="Break & Run" value={stats.stats8?.br || 0} />
            <StatRow label="Rack & Run" value={stats.stats8?.rr || 0} />
            <StatRow label="Win-Zip" value={stats.stats8?.winZip || 0} />
          </View>

          {/* 9-Ball */}
          <View>
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-end gap-2">
                <Text className="text-primary font-bold text-lg uppercase">9-Ball</Text>
                <Text className="text-gray-400 text-sm font-bold mb-[2px]">
                  {stats.stats9?.setsWon || 0}-{stats.stats9?.setsLost || 0} ({stats.stats9?.setWinRate || 0}%)
                </Text>
              </View>
              <Text className="text-gray-400 text-xs font-bold">
                {(stats.stats9?.racksWon || 0) + (stats.stats9?.racksLost || 0)} Racks: {stats.stats9?.racksWon || 0}-{stats.stats9?.racksLost || 0} ({stats.stats9?.rackWinRate || 0}%)
              </Text>
            </View>
            <StatRow label="Break & Run" value={stats.stats9?.br || 0} />
            <StatRow label="Rack & Run" value={stats.stats9?.rr || 0} />
            <StatRow label="9 on Snap" value={stats.stats9?.snap || 0} />
            <StatRow label="Win-Zip" value={stats.stats9?.winZip || 0} />
          </View>
        </View>

        {/* Breakpoint Graph */}
        <BreakpointGraph data={ratingHistory} />

        {/* Match Schedule Section - Hidden if Session is in Setup */}
        {activeSession?.status === 'active' || activeSession?.status === 'completed' ? (
          <>
            {nextMatch ? (
              (() => {
                const now = new Date();
                const scheduledDate = new Date(nextMatch.scheduled_date);
                const windowStart = new Date(scheduledDate);
                windowStart.setHours(8, 0, 0, 0);
                const windowEnd = new Date(windowStart);
                windowEnd.setDate(windowEnd.getDate() + 1);

                const isTimeOpen = now >= windowStart && now < windowEnd;

                // Effective Status Calculation
                const isBothSetsFinalized = nextMatch.status_8ball === 'finalized' && nextMatch.status_9ball === 'finalized';
                const totalPoints = (nextMatch.points_8ball_p1 || 0) + (nextMatch.points_8ball_p2 || 0) + (nextMatch.points_9ball_p1 || 0) + (nextMatch.points_9ball_p2 || 0);
                const isStarted = totalPoints > 0;

                let effectiveStatus = nextMatch.status;
                if (nextMatch.status === 'finalized' || isBothSetsFinalized) {
                  effectiveStatus = 'finalized';
                } else if (isStarted) {
                  effectiveStatus = 'in_progress';
                }

                // Lock only if NOT finalized/completed
                const isMatchLocked = !nextMatch.is_manually_unlocked && !isTimeOpen && effectiveStatus !== 'finalized' && effectiveStatus !== 'in_progress';

                // Scores for display
                const isP1 = nextMatch.player1_id === userId;
                const scores = {
                  p1_8: nextMatch.points_8ball_p1 || 0,
                  p2_8: nextMatch.points_8ball_p2 || 0,
                  p1_9: nextMatch.points_9ball_p1 || 0,
                  p2_9: nextMatch.points_9ball_p2 || 0,
                  isPlayer1: isP1
                };

                return (
                  <NextMatchCard
                    opponentName={nextMatch.player1_id === userId ? nextMatch.player2?.full_name : nextMatch.player1?.full_name || 'Unknown'}
                    date={`Week ${nextMatch.week_number} • ${nextMatch.scheduled_date ? new Date(nextMatch.scheduled_date).toLocaleDateString() : 'TBD'}`}
                    isLocked={isMatchLocked}
                    matchId={nextMatch.id}
                    leagueName={activeSession.parent_league?.name}
                    sessionName={activeSession.name}
                    weekNumber={nextMatch.week_number}
                    status={effectiveStatus} // Pass effective status overrides DB status
                    player1Id={nextMatch.player1_id}
                    player2Id={nextMatch.player2_id}
                    paymentStatusP1={nextMatch.payment_status_p1}
                    paymentStatusP2={nextMatch.payment_status_p2}
                    label={`Week ${nextMatch.week_number}`}
                    scores={scores}
                  />
                );
              })()
            ) : (
              <View className="bg-surface p-6 rounded-lg border border-border items-center justify-center mb-6">
                <Text className="text-gray-500 text-center italic mt-4">No scheduled matches found.</Text>
              </View>
            )}

            <View className="mb-8 items-center">
              <Link href="/(tabs)/matches" asChild>
                <TouchableOpacity className="bg-secondary px-6 py-3 rounded-full border border-border w-full items-center">
                  <Text className="text-white font-bold uppercase text-xs tracking-widest">Session Schedule</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </>
        ) : (
          <View className="items-center justify-center p-8 bg-surface rounded-xl border border-border mt-4 mb-8">
            <Ionicons name="time-outline" size={48} color="#D4AF37" style={{ marginBottom: 16 }} />
            <Text className="text-primary text-center text-xl font-bold mb-2">Session Starting Soon</Text>
            <Text className="text-gray-400 text-center">
              The operator is finalizing the session.
              {activeSession?.payment_status === 'unpaid' ? " Please pay your fee above." : " Matches will appear here once the session starts."}
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string, value: string | number }) {
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-border/50 last:border-0">
      <Text className="text-gray-400 font-medium text-sm">{label}</Text>
      <Text className="text-foreground font-bold text-lg">{value}</Text>
    </View>
  )
}
