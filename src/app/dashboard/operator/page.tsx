import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { redirect } from "next/navigation";
import UnlockRequestAction from "@/components/UnlockRequestAction";
import { createAdminClient } from "@/utils/supabase/admin";

import { verifyOperator } from "@/utils/auth-helpers";

export const dynamic = 'force-dynamic';

export default async function OperatorDashboard() {
    const { userId } = await verifyOperator();

    const supabase = createAdminClient();

    // Check Operator Status
    const { data: profile } = await supabase
        .from("profiles")
        .select("operator_status")
        .eq("id", userId)
        .single();

    if (profile?.operator_status === 'pending') {
        return (
            <main className="console-page flex flex-col">
                <Navbar />
                <div className="container max-w-xl mt-20 text-center">
                    <div className="card-glass p-12">
                        <h1 className="text-3xl text-white mb-4 font-serif">Application Pending</h1>
                        <p className="text-lg text-gray-400">
                            Your application to become a League Operator is under review.
                        </p>
                        <p className="text-sm text-gray-300 mt-4">
                            An administrator will review your request shortly.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (profile?.operator_status === 'rejected') {
        return (
            <main className="console-page flex flex-col">
                <Navbar />
                <div className="container max-w-xl mt-20 text-center">
                    <div className="card-glass p-12 border-error/50">
                        <h1 className="text-3xl text-error mb-4 font-serif">Application Rejected</h1>
                        <p className="text-lg text-gray-400">
                            Your application to become a League Operator was not approved.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // Fetch Operator's League Organizations (All of them)
    // Fetch Operator's League Organizations (via junction table)
    const { data: assignments } = await supabase
        .from("league_operators")
        .select("league_id")
        .eq("user_id", userId);

    const assignedLeagueIds = assignments?.map(a => a.league_id) || [];

    const { data: leagueOrgs, error: orgError } = await supabase
        .from("leagues")
        .select("*")
        .in("id", assignedLeagueIds)
        .eq("type", "league")
        .order("created_at", { ascending: true });

    // Fetch All Sessions for these leagues to check for pending requests
    const leagueIds = leagueOrgs?.map(l => l.id) || [];

    // Fetch pending requests for these leagues AND their sessions
    const { data: allSessions } = await supabase
        .from("leagues")
        .select("id, parent_league_id")
        .in("parent_league_id", leagueIds);

    const sessionIds = allSessions?.map(s => s.id) || [];
    const allRelevantIds = [...leagueIds, ...sessionIds];

    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("league_id")
        .in("league_id", allRelevantIds)
        .eq("status", "pending");

    // Map pending counts to Parent League ID
    const pendingCounts: Record<string, number> = {};

    pendingRequests?.forEach(req => {
        // Check if it's a direct league request
        if (leagueIds.includes(req.league_id)) {
            pendingCounts[req.league_id] = (pendingCounts[req.league_id] || 0) + 1;
        } else {
            // It's a session request, find the parent
            const session = allSessions?.find(s => s.id === req.league_id);
            if (session && session.parent_league_id) {
                pendingCounts[session.parent_league_id] = (pendingCounts[session.parent_league_id] || 0) + 1;
            }
        }
    });

    const { data: pendingUnlockRequestRows } = await supabase
        .from("reschedule_requests")
        .select("id, match_id, team_match_id, requester_id, reason, status, created_at, dismissed")
        .eq("status", "pending_operator");

    const requesterIds = [...new Set((pendingUnlockRequestRows || []).map((req) => req.requester_id).filter(Boolean))];
    const matchIds = [...new Set((pendingUnlockRequestRows || []).map((req) => req.match_id).filter(Boolean))];
    const teamMatchIds = [...new Set((pendingUnlockRequestRows || []).map((req) => req.team_match_id).filter(Boolean))];

    const { data: requesters } = requesterIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", requesterIds)
        : { data: [] as any[] };

    const { data: singleMatches } = matchIds.length > 0
        ? await supabase
            .from("matches")
            .select(`
                id,
                league_id,
                week_number,
                player1:player1_id(full_name),
                player2:player2_id(full_name),
                league:league_id(
                    name,
                    parent_league:parent_league_id(name)
                )
            `)
            .in("id", matchIds)
            .in("league_id", allRelevantIds)
        : { data: [] as any[] };

    const { data: teamMatches } = teamMatchIds.length > 0
        ? await supabase
            .from("team_matches")
            .select(`
                id,
                league_id,
                week_number,
                team_a:team_a_id(name),
                team_b:team_b_id(name),
                league:league_id(
                    name,
                    parent_league:parent_league_id(name)
                )
            `)
            .in("id", teamMatchIds)
            .in("league_id", allRelevantIds)
        : { data: [] as any[] };

    const requesterMap = new Map((requesters || []).map((requester: any) => [requester.id, requester]));
    const singleMatchMap = new Map((singleMatches || []).map((match: any) => [match.id, match]));
    const teamMatchMap = new Map((teamMatches || []).map((match: any) => [match.id, match]));

    const unlockRequests = (pendingUnlockRequestRows || [])
        .map((req: any) => {
            if (req.match_id) {
                const match = singleMatchMap.get(req.match_id);
                if (!match) return null;

                return {
                    ...req,
                    match,
                    requester: requesterMap.get(req.requester_id) || null,
                    request_type: 'singles'
                };
            }

            if (req.team_match_id) {
                const teamMatch = teamMatchMap.get(req.team_match_id);
                if (!teamMatch) return null;

                return {
                    ...req,
                    team_match: teamMatch,
                    requester: requesterMap.get(req.requester_id) || null,
                    request_type: 'team'
                };
            }

            return null;
        })
        .filter(Boolean);

    return (
        <main className="console-page flex flex-col">
            <Navbar />
            <div className="console-container">

                <div className="console-header">
                    <div>
                        <div className="console-kicker">Operations</div>
                        <h1 className="console-title">Operator Dashboard</h1>
                        <p className="console-subtitle">Manage leagues, sessions, requests, schedules, and tournaments.</p>
                    </div>
                </div>

                <div className="console-stat-grid">
                    <div className="console-stat">
                        <div className="console-stat-label">Leagues</div>
                        <div className="console-stat-value">{leagueOrgs?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Sessions</div>
                        <div className="console-stat-value">{allSessions?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Join Requests</div>
                        <div className="console-stat-value">{pendingRequests?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Unlock Requests</div>
                        <div className="console-stat-value">{unlockRequests?.length || 0}</div>
                    </div>
                </div>

                {/* Unlock Requests Section */}
                {/* @ts-ignore */}
                {unlockRequests && unlockRequests.length > 0 && (
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
                                        <th>League</th>
                                        <th>Session</th>
                                        <th>Match</th>
                                        <th>Requester</th>
                                        <th>Reason</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                            {unlockRequests.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                            {/* @ts-ignore */}
                                            {req.request_type === 'team'
                                                ? req.team_match?.league?.parent_league?.name || 'Unknown League'
                                                : req.match?.league?.parent_league?.name || 'Unknown League'}
                                    </td>
                                    <td>
                                            {req.request_type === 'team'
                                                ? `${req.team_match?.league?.name || 'Unknown Session'} • Week ${req.team_match?.week_number ?? '-'}`
                                                : `${req.match?.league?.name || 'Unknown Session'} • Week ${req.match?.week_number ?? '-'}`
                                            }
                                    </td>
                                    <td className="font-semibold text-white">
                                            {req.request_type === 'team'
                                                ? `${req.team_match?.team_a?.name || 'Team A'} vs ${req.team_match?.team_b?.name || 'Team B'}`
                                                : `${req.match?.player1?.full_name || 'Player 1'} vs ${req.match?.player2?.full_name || 'Player 2'}`
                                            }
                                    </td>
                                    <td>{req.requester?.full_name}</td>
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

                {/* League Grid */}
                <h2 className="console-section-title">Your Leagues</h2>

                {leagueOrgs && leagueOrgs.length > 0 ? (
                    <div className="console-table-wrap">
                        <table className="console-table">
                            <thead>
                                <tr>
                                    <th>League</th>
                                    <th>Venue</th>
                                    <th>Schedule</th>
                                    <th>Location</th>
                                    <th>Requests</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leagueOrgs.map(leagueOrg => {
                                    const pendingCount = pendingCounts[leagueOrg.id] || 0;

                                    return (
                                        <tr key={leagueOrg.id}>
                                            <td>
                                                <Link href={`/dashboard/operator/leagues/${leagueOrg.id}`} className="console-row-link">
                                                    {leagueOrg.name}
                                                </Link>
                                            </td>
                                            <td>{leagueOrg.location || "No venue"}</td>
                                            <td>{leagueOrg.schedule_day ? `${leagueOrg.schedule_day}s` : "No schedule"}</td>
                                            <td>{leagueOrg.city}, {leagueOrg.state}</td>
                                            <td>
                                                {pendingCount > 0 ? (
                                                    <span className="console-pill console-pill-danger">{pendingCount} pending</span>
                                                ) : (
                                                    <span className="console-pill">Clear</span>
                                                )}
                                            </td>
                                            <td>
                                                <Link href={`/dashboard/operator/leagues/${leagueOrg.id}`} className="btn btn-primary text-sm">
                                                    Manage
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card-glass p-16 text-center">
                        <h3 className="text-3xl font-bold mb-4">No Leagues Assigned</h3>
                        <p className="text-gray-400 mb-6 max-w-lg mx-auto">You haven't been assigned to any leagues yet.</p>
                        <p className="text-sm text-gray-500">Contact an administrator to get access to your organization.</p>
                    </div>
                )}

                {/* Tournament Section */}
                <h2 className="console-section-title mt-6">Tournaments</h2>
                <div className="console-grid mb-12">
                    <Link href="/dashboard/tournaments">
                        <div className="card-glass cursor-pointer group">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">
                                    Manage Tournaments
                                </h3>
                                <p className="text-sm text-gray-400">
                                    Run single and double elimination events with automated brackets and Fargo handicaps.
                                </p>
                                </div>
                                <span className="text-sm font-semibold text-[#D4AF37] group-hover:underline">
                                    Open Dashboard &rarr;
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </main>
    );
}
