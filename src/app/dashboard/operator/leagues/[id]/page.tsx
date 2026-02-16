import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import PaymentStatusManager from "@/components/PaymentStatusManager";
import { generateSchedule, startSeason } from "@/app/actions/league-actions";
import SessionLeaderboard from "@/components/SessionLeaderboard";
import RescheduleInbox from "@/components/RescheduleInbox";
import MatchDateManager from "@/components/MatchDateManager";
import { createAdminClient } from "@/utils/supabase/admin";
import GenerateScheduleForm from "@/components/GenerateScheduleForm";
import ResetMatchButton from "@/components/ResetMatchButton";
import MatchesListView from "@/components/MatchesListView";

import { verifyOperator } from "@/utils/auth-helpers";
import { isMatchDateLocked } from "@/utils/match-utils";

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
        .order("created_at", { ascending: true }) : { data: [] };

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
    const hasMatches = matches && matches.length > 0;
    const isSetup = league.status === 'setup';
    const isCompleted = league.status === 'completed';

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

        const { getSessionLeaderboard } = await import("@/app/actions/stats-actions");
        leaderboard = await getSessionLeaderboard(id, 5);

        const { count } = await supabase
            .from("league_players")
            .select("*, profiles!inner(is_active)", { count: 'exact', head: true })
            .eq("league_id", id)
            .eq("status", "active")
            .eq("profiles.is_active", true);
        totalPlayers = count || 0;
    }

    // Fetch Reschedule Requests (if session)
    let rescheduleRequests: any[] = [];
    if (!isLeagueOrg) {
        const { data: reqs } = await supabase
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
        rescheduleRequests = reqs || [];
    }



    if (isLeagueOrg) {
        return (
            <main className="min-h-screen flex flex-col bg-background">
                <Navbar />
                <div className="container py-8 max-w-5xl">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <Link href="/dashboard/operator" className="text-sm text-gray-300 hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                            <h1 className="text-3xl font-bold font-sans text-[#D4AF37] mt-2">{league.name}</h1>
                            <p className="text-gray-300">Organization Dashboard</p>
                        </div>
                        <div className="flex gap-2">
                            <Link href={`/dashboard/operator/leagues/${id}/sessions/new`} className="btn btn-primary text-sm px-4">
                                + Add Session
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                                View Players
                            </Link>
                        </div>
                    </div>

                    {hasPending && (
                        <div className="card-glass p-6 mb-8 border-primary/30">
                            <h2 className="text-lg font-bold text-[#D4AF37] mb-4 flex items-center gap-2">
                                Pending Join Requests
                                <span className="bg-[#D4AF37] text-black text-xs px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                            </h2>
                            <div className="grid gap-2">
                                {pendingRequests.map((request) => (
                                    <div key={request.id} className="bg-surface/40 p-5 rounded-lg border border-white/5 flex flex-col sm:flex-row justify-between items-center shadow-lg shadow-black/50 gap-4 transition-all hover:bg-surface/60">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-white/10 text-xs font-bold text-gray-400">
                                                    {request.profiles?.full_name?.charAt(0) || "?"}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-lg">{request.profiles?.full_name || "Unknown User"}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{request.profiles?.email}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-3 py-1 rounded-full">
                                                <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold">Requesting to Join:</span>
                                                <span className="text-xs text-white font-bold">{request.leagues?.name || "Unknown League"}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <form action={async () => {
                                                'use server';
                                                const { approvePlayer } = await import("@/app/actions/league-actions");
                                                await approvePlayer(request.league_id, request.player_id);
                                            }} className="flex-1 sm:flex-none">
                                                <button type="submit" className="btn w-full sm:w-auto !bg-green-600 !text-white hover:!bg-green-500 !border-none shadow-lg shadow-green-900/20 px-6 py-2.5 text-xs font-bold rounded uppercase tracking-wide transform hover:scale-105 transition-all">
                                                    Accept
                                                </button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                await rejectPlayer(request.league_id, request.player_id);
                                            }} className="flex-1 sm:flex-none">
                                                <button type="submit" className="btn w-full sm:w-auto !bg-red-600 !text-white hover:!bg-red-500 !border-none shadow-lg shadow-red-900/20 px-6 py-2.5 text-xs font-bold rounded uppercase tracking-wide transform hover:scale-105 transition-all">
                                                    Reject
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h2 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Active Sessions</h2>
                    {sessions.length > 0 ? (
                        <div className="grid gap-4">
                            {sessions.map((session: any) => (
                                <Link key={session.id} href={`/dashboard/operator/leagues/${session.id}`}>
                                    <div className="card-glass p-6 hover-effect cursor-pointer flex justify-between items-center group">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{session.name}</h3>
                                            <div className="flex gap-2 items-center">
                                                <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wide border
                                                    ${session.status === 'active' ? 'bg-[#22c55e]/20 text-[#4ade80] border-[#22c55e]/30' : 'bg-surface text-gray-300 border-border'}`}>
                                                    {session.status}
                                                </span>
                                                {session.creation_fee_status === 'unpaid' && (
                                                    <span className="text-xs px-2 py-1 rounded font-bold uppercase tracking-wide bg-error text-white border border-error">
                                                        Fee Unpaid
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-[#D4AF37] font-semibold text-sm group-hover:underline">
                                            Manage Session &rarr;
                                        </div>
                                    </div>
                                </Link>
                            ))}
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
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="container py-8 max-w-6xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}`} className="text-sm !text-[#D4AF37] hover:!text-white transition-colors" style={{ color: '#D4AF37' }}>&larr; Back to Organization</Link>
                        <div className="flex items-center gap-4 mt-2">
                            <h1 className="text-3xl font-bold font-sans text-[#D4AF37] m-0">{league.name}</h1>
                            {sessionStartDate && (
                                <span className="text-sm text-gray-300 border-l border-border pl-4" style={{ marginLeft: '0.5rem' }}>
                                    Start: {sessionStartDate}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide border
                                ${isCompleted ? 'bg-success/20 text-success border-success/30' : 'bg-surface text-gray-300 border-border'}`}>
                                Status: {league.status}
                            </span>
                            {league.creation_fee_status === 'unpaid' && (
                                <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide bg-error text-white">
                                    Fee Pending
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                            Players
                        </Link>
                        <Link href={`/dashboard/operator/leagues/${id}/stats`} className="btn bg-transparent border border-white hover:bg-white/20 !text-white text-sm px-4">
                            Stats
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
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
                                        />
                                    )}

                                    {league.creation_fee_status === 'unpaid' && (
                                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/pay-fee`} className="btn btn-primary w-full text-center block">
                                            Pay Session Fee
                                        </Link>
                                    )}

                                    {isSetup && hasMatches && (
                                        <div className="space-y-2">
                                            <form action={async () => {
                                                'use server';
                                                const { startSession } = await import("@/app/actions/league-actions");
                                                await startSession(id);
                                            }}>
                                                <button type="submit"
                                                    disabled={league.creation_fee_status === 'unpaid' || hasUnpaidPlayers}
                                                    className={`btn w-full ${league.creation_fee_status === 'unpaid' || hasUnpaidPlayers ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}`}
                                                    style={!(league.creation_fee_status === 'unpaid' || hasUnpaidPlayers) ? { backgroundColor: '#22c55e', color: 'black' } : {}}
                                                >
                                                    {league.creation_fee_status === 'unpaid' ? 'Fee Required to Start' : hasUnpaidPlayers ? `Waiting for ${unpaidPlayerCount} Player(s)` : 'Start Session'}
                                                </button>
                                            </form>
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
                            leagueId={id}
                            leagueStatus={league.status}
                            timezone={league.timezone}
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

                        {!isLeagueOrg && (
                            <div className="card-glass p-0 overflow-hidden">
                                <SessionLeaderboard
                                    sessionId={id}
                                    sessionName="Leaderboard"
                                    initialStats={leaderboard}
                                    totalPlayers={totalPlayers}
                                    limit={leaderboardLimit}
                                    enablePlayerLinks={true}
                                />
                            </div>
                        )}

                        {!isLeagueOrg && rescheduleRequests.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2 ml-1">Reschedule Inbox</h3>
                                <RescheduleInbox requests={rescheduleRequests} userId={userId} userRole="operator" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
