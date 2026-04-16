import { createClient } from "@/utils/supabase/server";
export const dynamic = 'force-dynamic';
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import PaymentStatusManager from "@/components/PaymentStatusManager";
import { generateSchedule, startSeason, approveCaptainRequest, rejectCaptainRequest, approveTeamRoster, rejectTeamRoster, allowTeamRosterEdit, denyTeamRosterEdit } from "@/app/actions/league-actions";
import SessionLeaderboard from "@/components/SessionLeaderboard";
import RescheduleInbox from "@/components/RescheduleInbox";
import MatchDateManager from "@/components/MatchDateManager";
import { createAdminClient } from "@/utils/supabase/admin";
import GenerateScheduleForm from "@/components/GenerateScheduleForm";
import ResetMatchButton from "@/components/ResetMatchButton";
import MatchesListView from "@/components/MatchesListView";
import SendNotificationButton from "@/components/SendNotificationButton";
import EndSessionButton from "@/components/EndSessionButton";
import StartSessionButton from "@/components/StartSessionButton";
import { getSessionLeaderboard, getTeamSessionLeaderboard } from "@/app/actions/stats-actions";
import UnlockRequestAction from "@/components/UnlockRequestAction";

import { verifyOperator } from "@/utils/auth-helpers";
import { isMatchDateLocked } from "@/utils/match-utils";
import { getBreakpointLevel } from "@/utils/stats-calculator";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await verifyOperator(id);

    const supabase = createAdminClient();

    // Fetch league details
    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) {
        return <div className="text-white p-8">League not found</div>;
    }

    const isLeagueOrg = league.type === 'league';

    // If it's a League Org, fetch its sessions
    let sessions: any[] = [];
    if (isLeagueOrg) {
        const { data: s } = await supabase
            .from("leagues")
            .select("*")
            .eq("parent_league_id", id)
            .order("created_at", { ascending: false });
        sessions = s || [];
    }

    // Fetch matches (Only if it's a session)
    const { data: matches } = !isLeagueOrg ? await supabase
        .from("matches")
        .select(`
      *,
      player1:player1_id(full_name),
      player2:player2_id(full_name)
    `)
        .eq("league_id", id)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }) : { data: [] };

    const { data: teamMatches } = !isLeagueOrg && league.is_team_league
        ? await supabase
            .from("team_matches")
            .select(`
                *,
                team_a:team_a_id(name),
                team_b:team_b_id(name)
            `)
            .eq("league_id", id)
            .order("week_number", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
        : { data: [] };

    const { count: teamMatchCount } = !isLeagueOrg && league.is_team_league
        ? await supabase
            .from("team_matches")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", id)
        : { count: 0 };

    // Fetch pending players
    const sessionIds = sessions.map(s => s.id);
    const allLeagueIds = [id, ...sessionIds];

    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("*, profiles!inner(full_name, email, is_active), leagues:league_id(name, type)")
        .in("league_id", allLeagueIds)
        .eq("status", "pending")
        .eq("profiles.is_active", true);

    // Fetch UNPAID active players for this session
    const { count: unpaidPlayerCount } = await supabase
        .from("league_players")
        .select("*", { count: 'exact', head: true })
        .eq("league_id", id)
        .eq("status", "active")
        .eq("payment_status", "unpaid");

    const hasUnpaidPlayers = (unpaidPlayerCount || 0) > 0;
    const hasPending = pendingRequests && pendingRequests.length > 0;
    const hasMatches = (matches && matches.length > 0) || (league.is_team_league && (teamMatchCount || 0) > 0);
    const isSetup = league.status === 'setup';
    const isCompleted = league.status === 'completed';

    // Fetch captain requests (team sessions only)
    let captainRequests: any[] = [];
    if (!isLeagueOrg && league.is_team_league) {
        const { data: capReqs } = await supabase
            .from('captain_requests')
            .select('id, league_id, player_id, status, created_at')
            .eq('league_id', id)
            .eq('status', 'pending');
        
        if (capReqs && capReqs.length > 0) {
            // Look up profile names via profiles table using clerk_id / id match
            const playerIds = capReqs.map((r: any) => r.player_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', playerIds);
            const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
            captainRequests = capReqs.map((r: any) => ({
                ...r,
                profile: profileMap.get(r.player_id) || null
            }));
        }
    }

    // Fetch submitted team rosters & edit requests
    let rosterSubmissions: any[] = [];
    let editRequests: any[] = [];
    let teamPaymentSummary: {
        teamId: string;
        teamName: string;
        tid: string;
        memberCount: number;
        paidCount: number;
        isPaid: boolean;
        members: {
            playerId: string;
            fullName: string;
            paymentStatus: string;
            isPaid: boolean;
        }[];
    }[] = [];
    
    if (!isLeagueOrg && league.is_team_league) {
        const { data: teamsWithActions } = await supabase
            .from('teams')
            .select('id, name, tid, captain_id, status')
            .eq('league_id', id)
            .in('status', ['submitted', 'edit_requested']);
        
        if (teamsWithActions && teamsWithActions.length > 0) {
            for (const team of teamsWithActions) {
                const { data: members } = await supabase
                    .from('team_members')
                    .select('id, profiles(full_name, breakpoint_rating)')
                    .eq('team_id', team.id);
                
                const teamData = {
                    ...team,
                    members: members || []
                };

                if (team.status === 'submitted') {
                    rosterSubmissions.push(teamData);
                } else if (team.status === 'edit_requested') {
                    editRequests.push(teamData);
                }
            }
        }

        const { data: allTeams } = await supabase
            .from('teams')
            .select('id, name, tid, status')
            .eq('league_id', id)
            .order('created_at', { ascending: true });

        if (allTeams && allTeams.length > 0) {
            const teamIds = allTeams.map((team: any) => team.id);
            const { data: allMembers } = await supabase
                .from('team_members')
                .select('team_id, player_id')
                .in('team_id', teamIds);

            const playerIds = [...new Set((allMembers || []).map((member: any) => member.player_id))];

            const { data: profiles } = playerIds.length > 0
                ? await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', playerIds)
                : { data: [] as any[] };

            const { data: leaguePlayerStatuses } = playerIds.length > 0
                ? await supabase
                    .from('league_players')
                    .select('player_id, payment_status')
                    .eq('league_id', id)
                    .in('player_id', playerIds)
                : { data: [] as any[] };

            const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
            const paymentMap = new Map((leaguePlayerStatuses || []).map((lp: any) => [lp.player_id, lp.payment_status || 'unpaid']));
            const paidStatuses = new Set(['paid', 'paid_cash', 'paid_online', 'waived']);

            teamPaymentSummary = allTeams.map((team: any) => {
                const members = (allMembers || [])
                    .filter((member: any) => member.team_id === team.id)
                    .map((member: any) => {
                        const paymentStatus = paymentMap.get(member.player_id) || 'unpaid';
                        return {
                            playerId: member.player_id,
                            fullName: profileMap.get(member.player_id)?.full_name || 'Unknown Player',
                            paymentStatus,
                            isPaid: paidStatuses.has(paymentStatus),
                        };
                    });

                const paidCount = members.filter((member) => member.isPaid).length;

                return {
                    teamId: team.id,
                    teamName: team.name,
                    tid: team.tid,
                    memberCount: members.length,
                    paidCount,
                    isPaid: members.length > 0 && paidCount === members.length,
                    members,
                };
            });
        }
    }

    // Fetch Leaderboard Data (if it's a session)
    let leaderboard: any[] = [];
    let leaderboardLimit = 25;
    let totalPlayers = 0;

    if (!isLeagueOrg) {
        const { data: settings } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "leaderboard_limit")
            .single();

        leaderboardLimit = parseInt(settings?.value || '25');

        leaderboard = league.is_team_league
            ? await getTeamSessionLeaderboard(id, 5)
            : await getSessionLeaderboard(id, 5);

        const { count } = league.is_team_league
            ? await supabase
                .from("teams")
                .select("*", { count: 'exact', head: true })
                .eq("league_id", id)
            : await supabase
                .from("league_players")
                .select("*, profiles!inner(is_active)", { count: 'exact', head: true })
                .eq("league_id", id)
                .eq("status", "active")
                .eq("profiles.is_active", true);
        totalPlayers = count || 0;
    }

    // Fetch enrolled players for push notifications
    let notificationPlayers: { id: string, full_name: string, is_enrolled: boolean }[] = [];
    if (!isLeagueOrg) {
        // Use admin client to bypass RLS on profiles.push_token which may be restricted
        const adminSupabase = createAdminClient();
        const { data: allPlayers } = await adminSupabase
            .from('league_players')
            .select(`
                player_id,
                profiles!inner(id, full_name, push_token, is_active, notify_league)
            `)
            .eq('league_id', id)
            .eq('status', 'active')
            .eq('profiles.is_active', true);

        if (allPlayers) {
            notificationPlayers = allPlayers.map(p => {
                const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                const is_enrolled = !!profile.push_token && profile.notify_league !== false;
                return { id: profile.id, full_name: profile.full_name || 'Unknown User', is_enrolled };
            });
            console.log(`[DEBUG] Total Active Players for session ${id}:`, allPlayers.length);
            console.log(`[DEBUG] Enrolled count:`, notificationPlayers.filter(p => p.is_enrolled).length);
        } else {
            console.log(`[DEBUG] No players found or query failed.`);
        }
    }

    // Fetch Reschedule Requests (if session)
    let rescheduleRequests: any[] = [];
    if (!isLeagueOrg) {
        const { data: singlesReqs } = await supabase
            .from("reschedule_requests")
            .select(`
                *,
                requester:requester_id(full_name),
                match:matches!inner(
                    player1:player1_id(full_name),
                    player2:player2_id(full_name),
                    league_id
                )
            `)
            .eq("match.league_id", id)
            .eq("status", "pending_operator")
            .order('created_at', { ascending: false });
        const { data: teamReqs } = await supabase
            .from("reschedule_requests")
            .select(`
                *,
                requester:requester_id(full_name),
                team_match:team_matches!reschedule_requests_team_match_id_fkey!inner(
                    week_number,
                    league_id,
                    team_a:team_a_id(name),
                    team_b:team_b_id(name)
                )
            `)
            .eq("team_match.league_id", id)
            .eq("status", "pending_operator")
            .order('created_at', { ascending: false });
        rescheduleRequests = [...(singlesReqs || []), ...(teamReqs || [])];
    }

    const unlockRequests = rescheduleRequests.filter((req: any) => req.status === 'pending_operator');



    if (isLeagueOrg) {
        return (
            <main className="console-page flex flex-col">
                <Navbar />
                <div className="console-container">
                    <div className="console-header">
                        <div>
                            <Link href="/dashboard/operator" className="text-sm text-gray-300 hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                            <h1 className="console-title mt-2">{league.name}</h1>
                            <p className="console-subtitle">Organization dashboard</p>
                        </div>
                        <div className="console-toolbar">
                            <Link href={`/dashboard/operator/leagues/${id}/sessions/new`} className="btn btn-primary text-sm px-4">
                                + Add Session
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                                View Players
                            </Link>
                        </div>
                    </div>

                    {hasPending && (
                        <div className="card-glass mb-4">
                            <h2 className="console-section-title flex items-center gap-2">
                                Pending Join Requests
                                <span className="console-pill console-pill-warning">{pendingRequests.length}</span>
                            </h2>
                            <div className="console-table-wrap">
                                <table className="console-table">
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Email</th>
                                            <th>Requesting</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                {pendingRequests.map((request) => (
                                    <tr key={request.id}>
                                        <td className="font-bold text-white">{request.profiles?.full_name || "Unknown User"}</td>
                                        <td className="text-gray-400">{request.profiles?.email}</td>
                                        <td>{request.leagues?.name || "Unknown League"}</td>
                                        <td>
                                            <div className="console-toolbar">
                                            <form action={async () => {
                                                'use server';
                                                const { approvePlayer } = await import("@/app/actions/league-actions");
                                                await approvePlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn !bg-green-600 !text-white hover:!bg-green-500 text-xs">
                                                    Accept
                                                </button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                await rejectPlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn btn-danger text-xs">
                                                    Reject
                                                </button>
                                            </form>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <h2 className="console-section-title">Active Sessions</h2>
                    {sessions.length > 0 ? (
                        <div className="console-table-wrap">
                            <table className="console-table">
                                <thead>
                                    <tr>
                                        <th>Session</th>
                                        <th>Status</th>
                                        <th>Fee</th>
                                        <th>Created</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map((session: any) => (
                                        <tr key={session.id}>
                                            <td>
                                                <Link href={`/dashboard/operator/leagues/${session.id}`} className="console-row-link">
                                                    {session.name}
                                                </Link>
                                            </td>
                                            <td>
                                                <span className={`console-pill ${session.status === 'active' ? 'console-pill-success' : ''}`}>
                                                    {session.status}
                                                </span>
                                            </td>
                                            <td>
                                                {session.creation_fee_status === 'unpaid' ? (
                                                    <span className="console-pill console-pill-danger">Fee unpaid</span>
                                                ) : (
                                                    <span className="console-pill console-pill-success">Current</span>
                                                )}
                                            </td>
                                            <td>{session.created_at ? new Date(session.created_at).toLocaleDateString() : "Unknown"}</td>
                                            <td>
                                                <Link href={`/dashboard/operator/leagues/${session.id}`} className="btn btn-primary text-sm">
                                                    Manage
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="card-glass p-12 text-center text-gray-500 italic">
                            No sessions found. Create a new session to start a league season.
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // Calculate Session Start Date
    let sessionStartDate = null;
    if (matches && matches.length > 0) {
        const week1Matches = matches.filter((m: any) => m.week_number === 1 && m.scheduled_date);
        if (week1Matches.length > 0) {
            week1Matches.sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
            sessionStartDate = new Date(week1Matches[0].scheduled_date).toLocaleDateString();
        }
    }

    return (
        <main className="console-page flex flex-col">
            <Navbar />
            <div className="console-container">
                <div className="console-header">
                    <div>
                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}`} className="text-sm !text-[#D4AF37] hover:!text-white transition-colors" style={{ color: '#D4AF37' }}>&larr; Back to Organization</Link>
                        <div className="flex items-center gap-4 mt-2">
                            <h1 className="console-title m-0">{league.name}</h1>
                            {sessionStartDate && (
                                <span className="text-sm text-gray-300 border-l border-border pl-4" style={{ marginLeft: '0.5rem' }}>
                                    Start: {sessionStartDate}
                                </span>
                            )}
                            {league.status === 'active' && (
                                <div className="ml-auto">
                                    <EndSessionButton leagueId={id} />
                                </div>
                            )}
                        </div>
                        <div className="console-toolbar mt-2">
                            <span className={`console-pill ${isCompleted ? 'console-pill-success' : ''}`}>
                                Status: {league.status}
                            </span>
                            {league.creation_fee_status === 'unpaid' && (
                                <span className="console-pill console-pill-danger">
                                    Fee Pending
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="console-toolbar">
                        <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                            Players
                        </Link>
                        <Link href={`/dashboard/operator/leagues/${id}/stats`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                            Stats
                        </Link>
                    </div>
                </div>

                <div className="console-split">
                    {/* Left Column: Matches & Actions */}
                    <div className="space-y-8">



                        {/* Session Actions Panel */}
                        {!isCompleted && (
                            <div className="card-glass p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Session Actions</h3>
                                <div className="space-y-4">
                                    {isSetup && !hasMatches && (
                                        <GenerateScheduleForm
                                            leagueId={id}
                                            initialStartDate={league.start_date ? new Date(league.start_date).toISOString().split('T')[0] : ''}
                                            initialTimezone={league.timezone}
                                            creationFeeStatus={league.creation_fee_status}
                                            parentLeagueId={league.parent_league_id}
                                            teamPaymentSummary={teamPaymentSummary}
                                        />
                                    )}

                                    {league.creation_fee_status === 'unpaid' && (
                                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/pay-fee`} className="btn btn-primary w-full text-center block">
                                            Pay Session Fee
                                        </Link>
                                    )}

                                    {/* Send Notification Button - Always available if session is active/setup */}
                                    <SendNotificationButton sessionId={id} notificationPlayers={notificationPlayers} />

                                    {isSetup && hasMatches && (
                                        <div className="space-y-2">
                                            <StartSessionButton
                                                leagueId={id}
                                                disabled={league.creation_fee_status === 'unpaid' || hasUnpaidPlayers}
                                                disabledLabel={league.creation_fee_status === 'unpaid' ? 'Fee Required to Start' : hasUnpaidPlayers ? `Waiting for ${unpaidPlayerCount} Player(s)` : 'Start Session'}
                                            />
                                            <form action={async () => {
                                                'use server';
                                                const { resetSchedule } = await import("@/app/actions/league-actions");
                                                await resetSchedule(id);
                                            }}>
                                                <button className="btn w-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>Reset Schedule</button>
                                            </form>
                                        </div>
                                    )}

                                    {isSetup && (
                                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/add-players`} className="btn w-full bg-surface border border-border text-center block hover:bg-surface-hover" style={{ color: '#D4AF37' }}>
                                            Manage / Invite Players
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}

                        <MatchesListView
                            matches={matches || []}
                            teamMatches={teamMatches || []}
                            leagueId={id}
                            leagueStatus={league.status}
                            timezone={league.timezone}
                            isTeamLeague={league.is_team_league}
                        />

                    </div>


                    {/* Right Column: Leaderboard & Pending */}
                    <div className="space-y-8">
                        {hasPending && !isCompleted && (
                            <div className="card-glass p-6 border-primary/30">
                                <h3 className="text-lg font-bold mb-4" style={{ color: '#D4AF37' }}>Pending Requests</h3>
                                <div className="grid gap-2">
                                    {pendingRequests.map((request) => (
                                        <div key={request.id} className="bg-surface/50 p-3 rounded border border-border text-sm">
                                            <div className="font-bold text-white mb-1">{request.profiles?.full_name}</div>
                                            <div className="flex gap-2 mt-2">
                                                <form action={async () => {
                                                    'use server';
                                                    const { approvePlayer } = await import("@/app/actions/league-actions");
                                                    await approvePlayer(id, request.player_id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-1" style={{ backgroundColor: '#22c55e', color: 'white' }}>Approve</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                    await rejectPlayer(id, request.player_id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>Reject</button>
                                                </form>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isLeagueOrg && captainRequests.length > 0 && (
                            <div className="card-glass p-6 border-primary/30">
                                <h3 className="text-lg font-bold mb-4" style={{ color: '#D4AF37' }}>
                                    Captain Requests
                                    <span className="ml-2 bg-[#D4AF37] text-black text-xs px-2 py-0.5 rounded-full">{captainRequests.length}</span>
                                </h3>
                                <div className="grid gap-2">
                                    {captainRequests.map((req: any) => {
                                        const profile = req.profile;
                                        return (
                                            <div key={req.id} className="bg-surface/50 p-4 rounded border border-border">
                                                <div className="font-bold text-white mb-1">{profile?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500 mb-3">{profile?.email}</div>
                                                <div className="flex gap-2">
                                                    <form action={async () => {
                                                        'use server';
                                                        await approveCaptainRequest(req.id, id, req.player_id);
                                                    }} className="flex-1">
                                                        <button className="btn w-full text-xs py-1" style={{ backgroundColor: '#22c55e', color: 'white' }}>Approve</button>
                                                    </form>
                                                    <form action={async () => {
                                                        'use server';
                                                        await rejectCaptainRequest(req.id, id);
                                                    }} className="flex-1">
                                                        <button className="btn w-full text-xs py-1" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>Reject</button>
                                                    </form>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {!isLeagueOrg && editRequests.length > 0 && (
                            <div className="card-glass p-6 border-primary/30">
                                <h3 className="text-lg font-bold mb-4" style={{ color: '#D4AF37' }}>
                                    Roster Edit Requests
                                    <span className="ml-2 bg-[#D4AF37] text-black text-xs px-2 py-0.5 rounded-full">{editRequests.length}</span>
                                </h3>
                                <div className="grid gap-4">
                                    {editRequests.map((submission: any) => (
                                        <div key={submission.id} className="bg-surface/50 p-4 rounded border border-border">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-[#D4AF37] text-lg">{submission.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">TID: {submission.tid}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1 mb-4 border-t border-white/5 pt-3">
                                                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Current Roster</div>
                                                {submission.members.map((m: any) => (
                                                    <div key={m.id} className="flex justify-between text-xs text-white bg-black/20 px-2 py-1.5 rounded">
                                                        <span>{m.profiles?.full_name}</span>
                                                        <span className="text-[#D4AF37] font-bold">{getBreakpointLevel(m.profiles?.breakpoint_rating)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex gap-2">
                                                <form action={async () => {
                                                    'use server';
                                                    await allowTeamRosterEdit(submission.id, id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-2 font-bold" style={{ backgroundColor: '#22c55e', color: 'black' }}>Allow Edit</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    await denyTeamRosterEdit(submission.id, id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-2 font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>Deny</button>
                                                </form>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isLeagueOrg && rosterSubmissions.length > 0 && (
                            <div className="card-glass p-6 border-primary/30">
                                <h3 className="text-lg font-bold mb-4" style={{ color: '#D4AF37' }}>
                                    Roster Submissions
                                    <span className="ml-2 bg-[#D4AF37] text-black text-xs px-2 py-0.5 rounded-full">{rosterSubmissions.length}</span>
                                </h3>
                                <div className="grid gap-4">
                                    {rosterSubmissions.map((submission: any) => (
                                        <div key={submission.id} className="bg-surface/50 p-4 rounded border border-border">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-[#D4AF37] text-lg">{submission.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">TID: {submission.tid}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1 mb-4 border-t border-white/5 pt-3">
                                                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Team Roster</div>
                                                {submission.members.map((m: any) => (
                                                    <div key={m.id} className="flex justify-between text-xs text-white bg-black/20 px-2 py-1.5 rounded">
                                                        <span>{m.profiles?.full_name}</span>
                                                        <span className="text-[#D4AF37] font-bold">{getBreakpointLevel(m.profiles?.breakpoint_rating)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex gap-2">
                                                <form action={async () => {
                                                    'use server';
                                                    await approveTeamRoster(submission.id, id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-2 font-bold" style={{ backgroundColor: '#22c55e', color: 'black' }}>Approve Roster</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    await rejectTeamRoster(submission.id, id);
                                                }} className="flex-1">
                                                    <button className="btn w-full text-xs py-2 font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>Reject</button>
                                                </form>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isLeagueOrg && unlockRequests.length > 0 && (
                            <div className="console-panel mb-4">
                                <h2 className="console-section-title flex items-center gap-2">
                                    Unlock Requests
                                    <span className="console-pill console-pill-warning">
                                        {unlockRequests.length}
                                    </span>
                                </h2>
                                <div className="console-table-wrap">
                                    <table className="console-table">
                                        <thead>
                                            <tr>
                                                <th>Match</th>
                                                <th>Requester</th>
                                                <th>Reason</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unlockRequests.map((req: any) => (
                                                <tr key={req.id}>
                                                    <td className="font-semibold text-white">
                                                        {req.match
                                                            ? `${req.match.player1?.full_name || 'Player 1'} vs ${req.match.player2?.full_name || 'Player 2'}`
                                                            : `${req.team_match?.team_a?.name || 'Team A'} vs ${req.team_match?.team_b?.name || 'Team B'} • Week ${req.team_match?.week_number ?? '-'}`
                                                        }
                                                    </td>
                                                    <td>{req.requester?.full_name || 'Unknown'}</td>
                                                    <td className="max-w-md text-gray-300">{req.reason}</td>
                                                    <td>
                                                        <UnlockRequestAction requestId={req.id} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {!isLeagueOrg && (
                            <div className="card-glass p-0 overflow-hidden">
                                <SessionLeaderboard
                                    sessionId={id}
                                sessionName="Leaderboard"
                                initialStats={leaderboard}
                                totalPlayers={totalPlayers}
                                limit={leaderboardLimit}
                                enablePlayerLinks={true}
                                isTeamLeague={league.is_team_league}
                            />
                        </div>
                        )}

                        {!isLeagueOrg && rescheduleRequests.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2 ml-1">Request History</h3>
                                <RescheduleInbox requests={rescheduleRequests} userId={userId} userRole="operator" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
