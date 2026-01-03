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

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

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
        .select("*, profiles:player_id(full_name, email), leagues:league_id(name, type)")
        .in("league_id", allLeagueIds)
        .eq("status", "pending");

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
            .select("*", { count: 'exact', head: true })
            .eq("league_id", id)
            .eq("status", "active");
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
                            <Link href="/dashboard/operator" className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Back to Dashboard</Link>
                            <h1 className="text-3xl font-bold font-sans text-primary mt-2">{league.name}</h1>
                            <p className="text-gray-400">Organization Dashboard</p>
                        </div>
                        <div className="flex gap-2">
                            <Link href={`/dashboard/operator/leagues/${id}/sessions/new`} className="btn btn-primary text-sm px-4">
                                + Add Session
                            </Link>
                            <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-surface border-border hover:bg-surface-hover text-sm px-4">
                                View Players
                            </Link>
                        </div>
                    </div>

                    {hasPending && (
                        <div className="card-glass p-6 mb-8 border-primary/30">
                            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                                Pending Join Requests
                                <span className="bg-primary text-black text-xs px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                            </h2>
                            <div className="grid gap-2">
                                {pendingRequests.map((request) => (
                                    <div key={request.id} className="bg-surface/50 p-4 rounded border border-border flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-white">{request.profiles?.full_name || "Unknown User"}</div>
                                            <div className="text-sm text-gray-400">{request.profiles?.email}</div>
                                            <div className="text-xs text-primary mt-1">
                                                To Join: {request.leagues?.name || "Unknown League"}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <form action={async () => {
                                                'use server';
                                                const { approvePlayer } = await import("@/app/actions/league-actions");
                                                await approvePlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn bg-success text-black px-3 py-1 text-sm font-bold hover:bg-success/90">Approve</button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                await rejectPlayer(request.league_id, request.player_id);
                                            }}>
                                                <button type="submit" className="btn bg-error/10 text-error border border-error px-3 py-1 text-sm font-bold hover:bg-error hover:text-white">Reject</button>
                                            </form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h2 className="text-xl font-bold text-white mb-4 border-b border-border pb-2">Active Sessions</h2>
                    {sessions.length > 0 ? (
                        <div className="grid gap-4">
                            {sessions.map((session: any) => (
                                <Link key={session.id} href={`/dashboard/operator/leagues/${session.id}`}>
                                    <div className="card-glass p-6 hover-effect cursor-pointer flex justify-between items-center group">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{session.name}</h3>
                                            <div className="flex gap-2 items-center">
                                                <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wide border
                                                    ${session.status === 'active' ? 'bg-success/20 text-success border-success/30' : 'bg-surface text-gray-400 border-border'}`}>
                                                    {session.status}
                                                </span>
                                                {session.creation_fee_status === 'unpaid' && (
                                                    <span className="text-xs px-2 py-1 rounded font-bold uppercase tracking-wide bg-error text-white border border-error">
                                                        Fee Unpaid
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-primary font-semibold text-sm group-hover:underline">
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
                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}`} className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Back to Organization</Link>
                        <div className="flex items-center gap-4 mt-2">
                            <h1 className="text-3xl font-bold font-sans text-primary m-0">{league.name}</h1>
                            {sessionStartDate && (
                                <span className="text-sm text-gray-400 border-l border-border pl-4">
                                    Start: {sessionStartDate}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide border
                                ${isCompleted ? 'bg-success/20 text-success border-success/30' : 'bg-surface text-gray-400 border-border'}`}>
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
                        <Link href={`/dashboard/operator/leagues/${id}/players`} className="btn bg-surface border-border hover:bg-surface-hover text-sm px-4">
                            Players
                        </Link>
                        <Link href={`/dashboard/operator/leagues/${id}/stats`} className="btn bg-surface border-border hover:bg-surface-hover text-sm px-4">
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
                                        <form action={async (formData) => {
                                            'use server';
                                            const { generateSchedule, updateLeague } = await import("@/app/actions/league-actions");
                                            const startDate = formData.get('start_date') as string;
                                            const timezone = formData.get('timezone') as string;

                                            if (startDate || timezone) {
                                                await updateLeague(id, { ...(startDate && { start_date: startDate }), ...(timezone && { timezone }) });
                                            }

                                            const res = await generateSchedule(id);
                                            if (res?.error === 'NOT_ENOUGH_PLAYERS') {
                                                const parentId = league.parent_league_id;
                                                redirect(`/dashboard/operator/leagues/${parentId}/sessions/${id}/add-players`);
                                            }
                                        }} className="bg-surface/30 p-4 rounded border border-border">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-400">Start Date</label>
                                                    <input type="date" name="start_date" required defaultValue={league.start_date ? new Date(league.start_date).toISOString().split('T')[0] : ''} className="input w-full text-sm bg-black/50 border-gray-700" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-gray-400">Timezone</label>
                                                    <select name="timezone" defaultValue={league.timezone || 'America/Chicago'} className="input w-full text-sm bg-black/50 border-gray-700">
                                                        <option value="America/Chicago">Central Time (CT)</option>
                                                        <option value="America/New_York">Eastern Time (ET)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button type="submit"
                                                disabled={league.creation_fee_status === 'unpaid'}
                                                className={`btn w-full ${league.creation_fee_status === 'unpaid' ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'btn-primary'}`}>
                                                {league.creation_fee_status === 'unpaid' ? 'Pay Fee to Generate Schedule' : 'Generate Schedule'}
                                            </button>
                                        </form>
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
                                                    className={`btn w-full ${league.creation_fee_status === 'unpaid' || hasUnpaidPlayers ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-success text-black'}`}>
                                                    {league.creation_fee_status === 'unpaid' ? 'Fee Required to Start' : hasUnpaidPlayers ? `Waiting for ${unpaidPlayerCount} Player(s)` : 'Start Session'}
                                                </button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                const { resetSchedule } = await import("@/app/actions/league-actions");
                                                await resetSchedule(id);
                                            }}>
                                                <button className="btn w-full bg-error/10 text-error border border-error hover:bg-error hover:text-white">Reset Schedule</button>
                                            </form>
                                        </div>
                                    )}

                                    {isSetup && (
                                        <Link href={`/dashboard/operator/leagues/${league.parent_league_id}/sessions/${id}/add-players`} className="btn w-full bg-surface border border-border text-center block hover:bg-surface-hover">
                                            Manage / Invite Players
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Matches List */}
                        <div className="card-glass p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-white">Matches</h2>
                                {league.status === 'active' && (
                                    <form action={async () => {
                                        'use server';
                                        const { submitLeagueResults } = await import("@/app/actions/league-actions");
                                        await submitLeagueResults(id);
                                    }}>
                                        <button className="btn text-xs px-3 py-1 bg-surface border border-primary text-primary hover:bg-primary hover:text-black">End Season</button>
                                    </form>
                                )}
                            </div>

                            {hasMatches ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border text-gray-500 text-xs uppercase">
                                                <th className="p-2">Wk</th>
                                                <th className="p-2">Date</th>
                                                <th className="p-2">Matchup</th>
                                                <th className="p-2">Status</th>
                                                <th className="p-2">Scores</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {matches.map((match) => (
                                                <tr key={match.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-2 font-mono text-gray-400">{match.week_number}</td>
                                                    <td className="p-2 text-sm">
                                                        <MatchDateManager matchId={match.id} initialDate={match.scheduled_date} isUnlocked={match.is_manually_unlocked} />
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex flex-col gap-1 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <PaymentStatusManager matchId={match.id} playerId={match.player1_id} status={match.payment_status_p1} playerName={match.player1?.full_name || "P1"} />
                                                                <span className={match.winner_id === match.player1_id ? 'text-primary font-bold' : 'text-gray-300'}>{match.player1?.full_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <PaymentStatusManager matchId={match.id} playerId={match.player2_id} status={match.payment_status_p2} playerName={match.player2?.full_name || "P2"} />
                                                                <span className={match.winner_id === match.player2_id ? 'text-primary font-bold' : 'text-gray-300'}>{match.player2?.full_name}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                                            ${match.status === 'finalized' ? 'bg-success/20 text-success' : 'bg-surface text-gray-500'}`}>
                                                            {match.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex items-center gap-2">
                                                            {(match.status === 'in_progress' || match.status === 'finalized') && (
                                                                <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded">
                                                                    {match.points_8ball_p1}-{match.points_8ball_p2}
                                                                </span>
                                                            )}
                                                            {(league.status === 'active' || league.status === 'completed') && (
                                                                <Link href={`/dashboard/operator/leagues/${id}/matches/${match.id}/score`} className="btn text-xs px-2 py-1 bg-surface border border-border hover:border-white">
                                                                    View
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 italic">
                                    No matches scheduled.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Leaderboard & Pending */}
                    <div className="space-y-8">
                        {hasPending && !isCompleted && (
                            <div className="card-glass p-6 border-primary/30">
                                <h3 className="text-lg font-bold text-primary mb-4">Pending Requests</h3>
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
                                                    <button className="btn w-full bg-success text-black text-xs py-1 hover:bg-success/90">Approve</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    const { rejectPlayer } = await import("@/app/actions/league-actions");
                                                    await rejectPlayer(id, request.player_id);
                                                }} className="flex-1">
                                                    <button className="btn w-full bg-error/10 text-error border border-error text-xs py-1 hover:bg-error hover:text-white">Reject</button>
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
