import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Linking, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { createClient } from "@supabase/supabase-js";
import StatsCard from "../../components/StatsCard";

import NextMatchCard from "../../components/NextMatchCard";
import TeamMatchCard from "../../components/TeamMatchCard";
import BreakpointGraph from "../../components/BreakpointGraph";
import { calculateEloChange, getBreakpointLevel, fetchMatchRaces } from "../../utils/rating";
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSession } from "../../lib/SessionContext";
import { isMatchLocked } from "../../utils/match";
import MatchReminderBanner from "../../components/MatchReminderBanner";
import TeamStatusBanner from "../../components/TeamStatusBanner";
import { registerForPushNotificationsAsync, scheduleMatchReminder } from "../../utils/notifications";
import { getApiBaseUrl } from "../../lib/api";

export default function HomeScreen() {
  const { userId, getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get current session from context
  const { currentSession, loading: sessionLoading, refreshSessions } = useSession();

  console.log(`[Dashboard] Render. UserID: ${userId}, isLoading: ${loading}`);

  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ winRate: 0, wl: "0-0", shutouts: 0, rank: "N/A", stats8: {}, stats9: {} });
  const [ratingHistory, setRatingHistory] = useState<any[]>([]);
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [userTeamName, setUserTeamName] = useState<string | null>(null);
  const [globalNextMatch, setGlobalNextMatch] = useState<any>(null);
  const [races, setRaces] = useState<Record<string, any>>({});
  const [bountyDisplay, setBountyDisplay] = useState(false);
  const [bountyAmount, setBountyAmount] = useState(0);
  const [bountyExpanded, setBountyExpanded] = useState(false);
  const [bountyDetails, setBountyDetails] = useState<{
    val8BreakRun: number; val8RackRun: number; val9: number; valSnap: number; valShutout: number;
    bnr8: number; rr8: number; bnr9: number; snaps: number; shutoutsCount: number;
    showShutouts: boolean;
  } | null>(null);

  const pushTokenSynced = useRef(false);
  const getTokenRef = useRef(getToken);
  const currentSessionRef = useRef(currentSession);
  const profileRef = useRef(profile);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!userId || pushTokenSynced.current) return;
    pushTokenSynced.current = true;

    const syncPushToken = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          // Get Clerk Token to authenticate with Supabase
          const clerkToken = await getToken({ template: 'supabase' });

          const supabaseAuth = createClient(
            process.env.EXPO_PUBLIC_SUPABASE_URL!,
            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${clerkToken}` } } }
          );

          const { error, data } = await supabaseAuth
            .from('profiles')
            .update({ push_token: token })
            .eq('id', userId)
            .select('*');
            
          const count = data ? data.length : 0;

          if (error) {
            console.error("Error saving push token:", error);
          } else if (count === 0) {
            console.error("Error: Token update matched 0 rows. RLS failure?");
          } else {
            console.log("Push token saved to profile");
          }
        }
      } catch (err) {
        console.error("Push Token Sync Error:", err);
      }
    };

    syncPushToken();
  }, [userId]);

  const lastFetchTime = useRef<number>(0);
  const lastFetchedSessionId = useRef<string | null>(null);
  const fetchInFlightRef = useRef(false);
  const CACHE_DURATION = 60000;

  const fetchData = useCallback(async (force = false) => {
    if (sessionLoading || fetchInFlightRef.current) return;

    let session = currentSessionRef.current;

    const now = Date.now();
    const sessionChanged = session?.id !== lastFetchedSessionId.current;

    // Use cache ONLY if:
    // 1. Not forced
    // 2. Session hasn't changed
    // 3. Cache hasn't expired
    // 4. We have profile data (meaning we successfully fetched at least once)
    if (!force && !sessionChanged && lastFetchTime.current > 0 && (now - lastFetchTime.current) < CACHE_DURATION && profileRef.current) {
      console.log("Using cached dashboard data");
      setLoading(false);
      return;
    }

    lastFetchTime.current = now;
    lastFetchedSessionId.current = session?.id || null;
    fetchInFlightRef.current = true;

    try {
      if (!userId) return;

      const token = await getTokenRef.current({ template: 'supabase' });
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

      if (force && !session) {
        const refreshedSessions = await refreshSessions();
        const refreshedSession =
          refreshedSessions.find((item) => item.id === currentSessionRef.current?.id) ||
          refreshedSessions.find((item) => item.isPrimary) ||
          refreshedSessions[0] ||
          null;

        session = refreshedSession;
        currentSessionRef.current = refreshedSession;
      }

      if (!session) {
        setActiveSession(null);
        setLoading(false);
        return;
      }

      // Fetch Membership Details for this specific session (payment status, stats)
      const { data: membershipData, error: memError } = await supabaseAuthenticated
        .from("league_players")
        .select(`
            payment_status, matches_played, matches_won, shutouts,
            total_break_and_runs_8ball, total_rack_and_runs_8ball,
            total_break_and_runs_9ball, total_rack_and_runs_9ball, total_nine_on_snap,
            leagues!inner (
                id, name, type, status, start_date, session_fee, is_team_league,
                location, city,
                bounty_val_8_run, bounty_val_8_rack_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout,
                parent_league:parent_league_id(name, location, city, bounty_val_8_run, bounty_val_8_rack_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout)
            )
        `)
        .eq("player_id", userId)
        .eq("league_id", session.id)
        .single();

      if (memError) {
        console.log("Error fetching active membership details:", memError);
      }

      const activeMembership: any = membershipData || {};
      const sessionStatus = activeMembership.leagues?.status || session.status;
      const isSessionLive = sessionStatus === 'active';

      setActiveSession({
        ...session,
        status: sessionStatus,
        isTeamLeague: activeMembership.leagues?.is_team_league || session.isTeamLeague || false,
        paid: activeMembership.payment_status === 'paid',
        payment_status: activeMembership.payment_status,
        session_fee: activeMembership.leagues?.session_fee,
        parent_league: activeMembership.leagues?.parent_league
      });

      // Calculate Bounty based on membership stats
      const parent = activeMembership.leagues?.parent_league;
      // Handle parent array if necessary (though usually singular)
      const parentObj = Array.isArray(parent) ? parent[0] : parent;
      const isTeamLeague = activeMembership.leagues?.is_team_league || session.isTeamLeague || false;

      const val8BreakRun = activeMembership.leagues?.bounty_val_8_run ?? parentObj?.bounty_val_8_run ?? 5;
      const val8RackRun = activeMembership.leagues?.bounty_val_8_rack_run ?? parentObj?.bounty_val_8_rack_run ?? 2;
      const val9 = activeMembership.leagues?.bounty_val_9_run ?? parentObj?.bounty_val_9_run ?? 3;
      const valSnap = activeMembership.leagues?.bounty_val_9_snap ?? parentObj?.bounty_val_9_snap ?? 1;
      const valShutout = isTeamLeague ? 0 : (activeMembership.leagues?.bounty_val_shutout ?? parentObj?.bounty_val_shutout ?? 1);

      const bnr8 = activeMembership.total_break_and_runs_8ball || 0;
      const rr8 = activeMembership.total_rack_and_runs_8ball || 0;
      const bnr9 = activeMembership.total_break_and_runs_9ball || 0;
      const snaps = activeMembership.total_nine_on_snap || 0;
      const shutoutsCount = isTeamLeague ? 0 : (activeMembership.shutouts || 0);
      let resolvedTeamId: string | null = null;
      setBountyAmount((bnr8 * val8BreakRun) + (rr8 * val8RackRun) + (bnr9 * val9) + (snaps * valSnap) + (shutoutsCount * valShutout));
      setBountyDetails({ val8BreakRun, val8RackRun, val9, valSnap, valShutout, bnr8, rr8, bnr9, snaps, shutoutsCount, showShutouts: !isTeamLeague });

      if (isTeamLeague) {
        const { data: captainTeam } = await supabaseAuthenticated
          .from('teams')
          .select('id, name')
          .eq('league_id', session.id)
          .eq('captain_id', userId)
          .maybeSingle();

        const { data: memberTeamData } = await supabaseAuthenticated
          .from('team_members')
          .select('teams!inner(id, name)')
          .eq('player_id', userId)
          .eq('teams.league_id', session.id)
          .maybeSingle();

        const joinedTeam: any = memberTeamData?.teams;
        resolvedTeamId = captainTeam?.id || (!Array.isArray(joinedTeam) ? joinedTeam?.id : null) || null;
        const resolvedTeamName = captainTeam?.name || (!Array.isArray(joinedTeam) ? joinedTeam?.name : null) || null;
        setUserTeamId(resolvedTeamId);
        setUserTeamName(resolvedTeamName);
      } else {
        setUserTeamId(null);
        setUserTeamName(null);
      }

      if (!isSessionLive) {
        setMatches([]);
        setNextMatch(null);
        setGlobalNextMatch(null);
        setRaces({});
        setStats({
          winRate: 0,
          wl: "0-0",
          shutouts: 0,
          rank: "N/A",
          stats8: {},
          stats9: {}
        });
        setLoading(false);
        return;
      }

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

      const { data: globalMatchesData } = await supabaseAuthenticated
        .from("matches")
        .select(`
          *,
          player1:player1_id(full_name, breakpoint_rating, fargo_rating),
          player2:player2_id(full_name, breakpoint_rating, fargo_rating),
          games (*),
          team_match_sets(
            team_match_id,
            set_number
          )
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

      const globalMatches = globalMatchesData || [];

      // Fetch Races for all matches
      if (matches.length > 0) {
        const inputs = matches.map((m: any) => ({
          id: m.id,
          p1Rating: m.player1?.breakpoint_rating || 500,
          p2Rating: m.player2?.breakpoint_rating || 500
        }));

        fetchMatchRaces(inputs).then(raceData => {
          if (raceData) setRaces(raceData);
        });
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
          if (!m.is_forfeit && m.status_8ball === 'finalized' && m.status_9ball === 'finalized' && m.winner_id_8ball === userId && m.winner_id_9ball === userId) {
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
        .select("player_id, matches_won, matches_played, breakpoint_racks_won, breakpoint_racks_played, profiles!inner(is_active)")
        .eq("league_id", session.id)
        .eq("profiles.is_active", true);

      if (leaguePlayers) {
        const statsArray = leaguePlayers.map((p: any) => {
          const played = p.matches_played || 0;
          const wins = p.matches_won || 0;
          const racksWon = p.breakpoint_racks_won || 0;
          const racksPlayed = p.breakpoint_racks_played || 0;
          return {
            id: p.player_id,
            played,
            winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
            rackWinRate: racksPlayed > 0 ? (racksWon / racksPlayed) * 100 : 0
          };
        });

        // Exact Sort order from LeaderboardScreen
        statsArray.sort((a, b) => {
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          return b.rackWinRate - a.rackWinRate; // Secondary: Rack win %
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

      if (globalMatches) {
        const getMatchTimestamp = (m: any) => new Date(m.submitted_at || m.created_at || m.scheduled_date).getTime();
        const getTeamSetMeta = (m: any) => Array.isArray(m.team_match_sets) ? m.team_match_sets[0] : m.team_match_sets;
        const getPreviousRatingForMatch = (m: any, currentRating: number) => {
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

          let previousRating;
          if (snapshotVal) {
            previousRating = snapshotVal;
          } else {
            let mySets = 0, oppSets = 0;
            if (m.winner_id_8ball) { isP1 ? (m.winner_id_8ball === userId ? mySets++ : oppSets++) : (m.winner_id_8ball === userId ? mySets++ : oppSets++) }
            if (m.winner_id_9ball) { isP1 ? (m.winner_id_9ball === userId ? mySets++ : oppSets++) : (m.winner_id_9ball === userId ? mySets++ : oppSets++) }
            const wonMatch = mySets > oppSets;
            const draw = mySets === oppSets;

            if (draw) {
              previousRating = currentRating;
            } else {
              const change = calculateEloChange(currentRating, oppRating, wonMatch);

              if (isNaN(change)) {
                console.warn("NaN Elo Change detected", { currentRating, oppRating });
                previousRating = currentRating;
              } else {
                previousRating = currentRating - change;
              }
            }
          }

          return Math.max(100, Math.min(1000, previousRating));
        };

        // Sort Newest -> Oldest for walking backwards
        // Team-league set matches are grouped by team_match_id so one night = one graph point.
        const sortedMatches = globalMatches
          .filter(m =>
            m.status === 'finalized' ||
            m.status_8ball === 'finalized' ||
            m.status_9ball === 'finalized'
          )
          .sort((a, b) => {
            const tA = getMatchTimestamp(a);
            const tB = getMatchTimestamp(b);
            if (tB !== tA) return tB - tA;

            const aTeamSet = getTeamSetMeta(a);
            const bTeamSet = getTeamSetMeta(b);
            if (aTeamSet?.team_match_id && bTeamSet?.team_match_id && aTeamSet.team_match_id === bTeamSet.team_match_id) {
              return (bTeamSet.set_number || 0) - (aTeamSet.set_number || 0);
            }

            return 0;
          });

        const historyEvents: Array<{ date: string; matches: any[] }> = [];
        const teamEvents = new Map<string, { date: string; matches: any[] }>();

        for (const match of sortedMatches) {
          const teamSet = getTeamSetMeta(match);
          if (teamSet?.team_match_id) {
            const existingEvent = teamEvents.get(teamSet.team_match_id);
            if (existingEvent) {
              existingEvent.matches.push(match);
            } else {
              const event = {
                date: match.submitted_at || match.created_at || match.scheduled_date,
                matches: [match]
              };
              teamEvents.set(teamSet.team_match_id, event);
              historyEvents.push(event);
            }
            continue;
          }

          historyEvents.push({
            date: match.submitted_at || match.created_at || match.scheduled_date,
            matches: [match]
          });
        }

        console.log(`[Dashboard] Graph: Processing ${sortedMatches.length} global matches across ${historyEvents.length} graph events.`);

        for (const event of historyEvents) {
          for (const m of event.matches) {
            runningRating = getPreviousRatingForMatch(m, runningRating);
          }

          history.push({
            date: event.date,
            rating: parseFloat(getBreakpointLevel(runningRating))
          });
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

      if (activeMembership.leagues?.is_team_league || session.isTeamLeague) {
        if (resolvedTeamId) {
          const { data: teamMatchesData } = await supabaseAuthenticated
            .from('team_matches')
            .select(`
              *,
              team_a:team_a_id(*),
              team_b:team_b_id(*),
              team_match_captain_submissions(
                team_id,
                verification_status
              )
            `)
            .eq('league_id', session.id)
            .or(`team_a_id.eq.${resolvedTeamId},team_b_id.eq.${resolvedTeamId}`)
            .order('week_number', { ascending: true })
            .order('created_at', { ascending: true });

          const nextTeamMatch = (teamMatchesData || []).find((m: any) => m.status !== 'completed');
          setNextMatch(nextTeamMatch || null);
        } else {
          setNextMatch(null);
        }
      } else {
        const nextUp = matches?.find(m => {
          const is8Final = m.status_8ball === 'finalized';
          const is9Final = m.status_9ball === 'finalized';
          const isFullyFinalized = m.status === 'finalized' || (is8Final && is9Final);
          return !isFullyFinalized;
        });
        setNextMatch(nextUp);
      }

      // Fetch Global Next Match for Banner (Across ALL leagues)
      // Only fetch if we have a user
      if (userId) {
        const { data: globalMatchData } = await supabaseAuthenticated
          .from("matches")
          .select(`
              *,
              player1:player1_id(full_name),
              player2:player2_id(full_name),
              leagues(name, location, parent_league:parent_league_id(name))
            `)
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
          .neq('status', 'finalized')
          .neq('status', 'completed') // Assuming completed is also a final state
          .gte('scheduled_date', new Date().toISOString().split('T')[0]) // Only future or today
          .order("scheduled_date", { ascending: true })
          .limit(1)
          .single();

        if (globalMatchData) {
          const sessionName = globalMatchData.leagues?.name;
          const parentName = globalMatchData.leagues?.parent_league?.name;
          const location = globalMatchData.leagues?.location;

          // Fetch dismissal status
          const { data: dismissalData, error: dismissalError } = await supabaseAuthenticated
            .from('dismissed_reminders')
            .select('reminder_type')
            .eq('user_id', userId)
            .eq('match_id', globalMatchData.id);

          if (dismissalError) console.error("[Dismissal] Fetch Error:", dismissalError.message, dismissalError.code);
          console.log(`[Dismissal] Fetched for ${globalMatchData.id} / ${userId}:`, dismissalData);

          setGlobalNextMatch({
            ...globalMatchData,
            league_name: parentName,
            session_name: sessionName,
            location: location,
            dismissed_types: dismissalData ? dismissalData.map((d: any) => d.reminder_type) : []
          });

          // Schedule local notification if not dismissed
          const alreadyDismissed = dismissalData?.some((d: any) => d.reminder_type === 'dayof');
          if (!alreadyDismissed) {
            scheduleMatchReminder(globalMatchData, userId);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      fetchInFlightRef.current = false;
      if (!sessionLoading) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [userId, sessionLoading, refreshSessions]);

  // Force re-fetch when session context finishes loading
  useEffect(() => {
    if (!sessionLoading) {
      fetchData(false);
    }
  }, [sessionLoading, currentSession?.id, userId, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Force refresh when coming from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('[Dashboard] App resumed - forcing data refresh');
        fetchData(true); // Force refresh, bypass cache
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchData]);

  // Loading Guard: Prevent stutter or flash of "No Session"
  // Keep showing loader until:
  // 1. Session context has finished loading (sessionLoading is false)
  // 2. Dashboard fetch has completed (loading is false) 
  // 3. If user has a session in context, we must wait for activeSession to be populated
  const [isPaying, setIsPaying] = useState(false);
  const shouldShowLoader = sessionLoading || loading || (currentSession && !activeSession);
  const effectiveSessionFee = Number(activeSession?.session_fee) > 0 ? Number(activeSession.session_fee) : 25;

  const handlePaySessionFee = async () => {
    if (!currentSession || !userId) return;
    setIsPaying(true);
    try {
      const token = await getToken();
      const apiUrl = getApiBaseUrl();

      const response = await fetch(`${apiUrl}/api/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'player_session_fee',
          sessionId: currentSession.id,
          source: 'mobile'
        })
      });

      const data = await response.json();
      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Alert.alert("Error", data.error || "Failed to create payment link.");
      }
    } catch (e) {
      console.error("Payment Error:", e);
      Alert.alert("Error", "Could not start payment.");
    } finally {
      setIsPaying(false);
    }
  };

  if (shouldShowLoader) {
    return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;
  }

  // Calculate special stats for Render
  const getSpecialStats = (match: any) => {
    if (!match || !match.games) return undefined;
    let p1_8br = 0, p2_8br = 0;
    let p1_8rr = 0, p2_8rr = 0;
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
      if (g.game_type === '8ball' && g.is_rack_and_run) {
        if (g.winner_id === match.player1_id) p1_8rr++;
        else if (g.winner_id === match.player2_id) p2_8rr++;
      }
    });
    return { p1_8br, p2_8br, p1_8rr, p2_8rr, p1_9br, p2_9br, p1_snap, p2_snap };
  };

  const handleDismissReminder = async (type: '3day' | 'dayof') => {
    console.log(`[Dismissal] Attempting to dismiss ${type} for match ${globalNextMatch?.id} with userId ${userId}`);
    if (!globalNextMatch || !userId) return;

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.error("[Dismissal] No token available");
        return;
      }

      const supabaseAuth = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data, error } = await supabaseAuth.from('dismissed_reminders').insert({
        user_id: userId,
        match_id: globalNextMatch.id,
        reminder_type: type
      }).select();

      if (error) {
        console.error("[Dismissal] Insert Failed:", error.message, error.code);
      } else {
        console.log("[Dismissal] Success:", data);
      }
    } catch (err) {
      console.error("[Dismissal] Error:", err);
    }
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
            {(activeSession.parent_league.location || activeSession.location) ? ` | ${activeSession.parent_league.location || activeSession.location}` : ''}
          </Text>
        )}
        {activeSession?.isTeamLeague && userTeamName && (
          <Text className="text-gray-300 font-bold tracking-wider uppercase text-xs mt-2" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
            {userTeamName}
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
                  <Text className="text-gray-400 text-xs">8-Ball B&R (${bountyDetails.val8BreakRun})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.bnr8} = ${bountyDetails.bnr8 * bountyDetails.val8BreakRun}</Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">8-Ball R&R (${bountyDetails.val8RackRun})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.rr8} = ${bountyDetails.rr8 * bountyDetails.val8RackRun}</Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">9-Ball B&R (${bountyDetails.val9})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.bnr9} = ${bountyDetails.bnr9 * bountyDetails.val9}</Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-400 text-xs">9-on-Snap (${bountyDetails.valSnap})</Text>
                  <Text className="text-green-400 text-xs font-bold">x{bountyDetails.snaps} = ${bountyDetails.snaps * bountyDetails.valSnap}</Text>
                </View>

                {bountyDetails.showShutouts && (
                  <View className="flex-row justify-between">
                    <Text className="text-gray-400 text-xs">Shutouts (${bountyDetails.valShutout})</Text>
                    <Text className="text-green-400 text-xs font-bold">x{bountyDetails.shutoutsCount} = ${bountyDetails.shutoutsCount * bountyDetails.valShutout}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {globalNextMatch && <MatchReminderBanner nextMatch={{ ...globalNextMatch, currentUserId: userId }} onDismiss={handleDismissReminder} />}


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
                  <Text className="text-red-200 text-xs">
                    Session fee: ${effectiveSessionFee.toFixed(2)}. All players must pay before the session can start.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handlePaySessionFee}
                  disabled={isPaying}
                  className="bg-red-500 px-4 py-2 rounded-full"
                >
                  <Text className="text-white font-bold text-xs" style={{ includeFontPadding: false }}>
                    {isPaying ? '...' : 'PAY NOW'}
                  </Text>
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

                <StatRow label="9 on Snap" value={stats.stats9?.snap || 0} />

              </View>
            </View>

            <BreakpointGraph data={ratingHistory} />

            {nextMatch ? (
              (() => {
                if (activeSession?.isTeamLeague && userTeamId) {
                  return (
                    <TeamMatchCard
                      match={nextMatch}
                      userTeamId={userTeamId}
                      timezone={activeSession?.timezone || 'America/Chicago'}
                    />
                  );
                }

                // Logic for status calculation (Same as MatchesScreen)
                const now = new Date();
                const [year, month, day] = nextMatch.scheduled_date.split('-').map(Number);
                const windowStart = new Date(year, month - 1, day, 8, 0, 0);
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

                const matchLocked = isMatchLocked(
                  nextMatch.scheduled_date,
                  activeSession?.timezone || 'America/Chicago',
                  nextMatch.is_manually_unlocked,
                  effectiveStatus,
                  isStarted
                );

                const formattedDate = nextMatch.scheduled_date
                  ? (() => {
                    const datePart = nextMatch.scheduled_date.split('T')[0];
                    const [year, month, day] = datePart.split('-').map(Number);
                    return new Date(year, month - 1, day).toLocaleDateString();
                  })()
                  : 'TBD';

                // Get race from state (fetched server-side)
                const matchRaces = races[nextMatch.id];
                const racesForCard = matchRaces ? {
                  p1_8: matchRaces.race8.p1, p2_8: matchRaces.race8.p2,
                  p1_9: matchRaces.race9.p1, p2_9: matchRaces.race9.p2
                } : undefined;

                const opponent = nextMatch.player1_id === userId ? nextMatch.player2 : nextMatch.player1;

                return (
                  <NextMatchCard
                    opponentName={opponent?.full_name || 'Unknown'}
                    opponentRating={opponent?.breakpoint_rating}
                    date={formattedDate}
                    isLocked={matchLocked}
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
                    scheduledTime={nextMatch.scheduled_time}
                    tableName={nextMatch.table_name}
                  />
                );
              })()
            ) : activeSession?.status !== 'active' ? (
              <View className="bg-surface p-6 rounded-lg border border-yellow-500/30 items-center justify-center mb-6">
                <Text className="text-yellow-300 text-center font-bold" style={{ includeFontPadding: false }}>
                  Schedule Not Live Yet
                </Text>
                <Text className="text-gray-400 text-center mt-2" style={{ includeFontPadding: false }}>
                  The operator still needs to start this session before the schedule is visible.
                </Text>
              </View>
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
