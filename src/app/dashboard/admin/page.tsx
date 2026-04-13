import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import AdminPlayerFilters from "@/components/AdminPlayerFilters";
import Navbar from "@/components/Navbar";
import { approveOperator, rejectOperator, updateSessionFeeStatus, approveApplication, rejectApplication, deleteApplication } from "@/app/actions/admin-actions";
import { createAdminClient } from "@/utils/supabase/admin";
import PlayerActions from "@/components/PlayerActions";
import RoleSelector from "@/components/RoleSelector";
import FinancialSettingsForm from "@/components/FinancialSettingsForm";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";
import SessionFeeToggle from "@/components/SessionFeeToggle";
import AssignLeagueButton from "@/components/AssignLeagueButton";
import PreregistrationManager from "@/components/PreregistrationManager";
import DeletionRequestManager from "@/components/DeletionRequestManager";
import DeleteSessionButton from "@/components/DeleteSessionButton";
import LandingPageSettingsForm from "@/components/LandingPageSettingsForm";
import AdminLeagueCard from "@/components/AdminLeagueCard";
import AdminLeagueCreateForm from "@/components/AdminLeagueCreateForm";

import { verifyAdmin } from "@/utils/auth-helpers";

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {

    const { userId } = await verifyAdmin();

    const resolvedSearchParams = await searchParams;
    const playerView = (typeof resolvedSearchParams.player_status === 'string' ? resolvedSearchParams.player_status : 'active') as 'active' | 'deactivated';
    const roleFilter = (typeof resolvedSearchParams.role_filter === 'string' ? resolvedSearchParams.role_filter : 'all');

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Fetch Financial Settings
    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", [
            "default_session_fee", "default_creation_fee", "default_match_fee", "leaderboard_limit",
            "landing_page_box_title_line_1", "landing_page_box_title_line_2", "landing_page_box_text", "landing_page_box_location"
        ]);

    const sessionFee = settings?.find(s => s.key === "default_session_fee")?.value || "25";
    const creationFee = settings?.find(s => s.key === "default_creation_fee")?.value || "100";
    const matchFee = settings?.find(s => s.key === "default_match_fee")?.value || "20";
    const leaderboardLimit = settings?.find(s => s.key === "leaderboard_limit")?.value || "25";

    const lpTitle1 = settings?.find(s => s.key === "landing_page_box_title_line_1")?.value || "MONEY MONDAYS @ FAT'S BILLIARDS";
    const lpTitle2 = settings?.find(s => s.key === "landing_page_box_title_line_2")?.value || "STARTS FEBRUARY 16";
    const lpLocation = settings?.find(s => s.key === "landing_page_box_location")?.value || "Fort Worth, TX";
    const lpText = settings?.find(s => s.key === "landing_page_box_text")?.value || "Secure Your Spot Today! \nDownload the app, create an account and join the session!";

    // Application View Logic
    const showAllApps = resolvedSearchParams.app_view === 'all';

    let applicationsQuery = adminSupabase
        .from("operator_applications")
        .select("*")
        .order("created_at", { ascending: false });

    if (!showAllApps) {
        applicationsQuery = applicationsQuery.eq("status", "pending");
    }

    const { data: applications } = await applicationsQuery;

    // Fetch Approved Operators and Admins (to assign leagues)
    const { data: approvedOperatorsRaw } = await supabase
        .from("profiles")
        .select("*")
        .eq("operator_status", "approved");

    const { data: admins } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "admin");

    // Combine operators and admins, avoiding duplicates
    const approvedOperators = [...(approvedOperatorsRaw || []), ...(admins || []).filter(admin => !approvedOperatorsRaw?.some(op => op.id === admin.id))];

    // Fetch All Leagues (to see who has one)
    const { data: leagues } = await adminSupabase
        .from("leagues")
        .select("*, profiles:operator_id(full_name, email), league_operators(profiles(full_name, email))")
        .eq("type", "league")
        .in("status", ["active", "setup"]);

    // Fetch Pre-registrations
    const { data: preregs } = await adminSupabase
        .from("preregistrations")
        .select("*")
        .order("created_at", { ascending: false });

    // Fetch Deletion Requests
    const { data: deletionRequests } = await adminSupabase
        .from("deletion_requests")
        .select("*, profiles:profiles!deletion_requests_user_id_fkey(full_name, email)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

    // Fetch users based on filter
    let query = adminSupabase
        .from("profiles")
        .select("id, full_name, email, role, is_active");

    if (roleFilter !== 'all') {
        query = query.eq("role", roleFilter);
    }

    // Always order by name
    const { data: allPlayers } = await query.order("full_name");

    const displayedPlayers = allPlayers?.filter(p => playerView === 'deactivated' ? (p.is_active === false) : (p.is_active !== false));


    return (
        <main className="console-page flex flex-col">
            <Navbar />
            <div className="console-container">
                <div className="console-header">
                    <div>
                        <div className="console-kicker">Administration</div>
                        <h1 className="console-title">Admin Dashboard</h1>
                        <p className="console-subtitle">System settings, operator applications, leagues, players, and account requests.</p>
                    </div>
                    <div className="console-toolbar">
                        <Link href="/dashboard/admin/deleted-players" className="btn btn-danger text-sm">
                            View Deleted Accounts
                        </Link>
                    </div>
                </div>

                <div className="console-stat-grid">
                    <div className="console-stat">
                        <div className="console-stat-label">Applications</div>
                        <div className="console-stat-value">{applications?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Leagues</div>
                        <div className="console-stat-value">{leagues?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Players</div>
                        <div className="console-stat-value">{displayedPlayers?.length || 0}</div>
                    </div>
                    <div className="console-stat">
                        <div className="console-stat-label">Deletion Requests</div>
                        <div className="console-stat-value">{deletionRequests?.length || 0}</div>
                    </div>
                </div>

                {/* Account Deletion Requests */}
                {deletionRequests && deletionRequests.length > 0 && (
                    <DeletionRequestManager requests={deletionRequests as any[]} />
                )}

                {/* Operator Applications */}
                <div className="card-glass mb-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                        <h2 className="console-section-title flex items-center gap-2">
                            {showAllApps ? "All Operator Applications" : "Pending Operator Applications"}
                            {!showAllApps && applications && applications.length > 0 && (
                                <span className="console-pill console-pill-warning">{applications.length}</span>
                            )}
                        </h2>
                        <Link
                            href={showAllApps ? "/dashboard/admin" : "/dashboard/admin?app_view=all"}
                            className="btn btn-primary text-sm"
                        >
                            {showAllApps ? "View Pending Only" : "View Application Archive"}
                        </Link>
                    </div>

                    {applications && applications.length > 0 ? (
                        <div className="console-table-wrap">
                            <table className="console-table">
                                <thead>
                                    <tr>
                                        <th>Applicant</th>
                                        <th>Contact</th>
                                        <th>Location</th>
                                        <th>Target Area</th>
                                        <th>Status</th>
                                        <th>Notes</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {applications.map((app) => (
                                        <tr key={app.id}>
                                            <td className="font-bold text-white">{app.first_name} {app.last_name}</td>
                                            <td>
                                                <div>{app.email}</div>
                                                <div className="text-xs text-gray-500">{app.phone}</div>
                                            </td>
                                            <td>{app.location}</td>
                                            <td>{app.desired_league_location}</td>
                                            <td>
                                                <span className={`console-pill
                                                    ${app.status === 'approved' ? 'console-pill-success' :
                                                        app.status === 'rejected' ? 'console-pill-danger' :
                                                            'console-pill-warning'}`}>
                                                {app.status}
                                            </span>
                                            </td>
                                            <td className="max-w-xs text-gray-400">{app.notes || "None"}</td>
                                            <td>
                                                <div className="console-toolbar">
                                                    {app.status === 'pending' && (
                                                        <>
                                                            <form action={async () => {
                                                                'use server';
                                                                await approveApplication(app.id);
                                                            }}>
                                                                <button type="submit" className="btn bg-success hover:bg-success/90 text-black text-sm">Approve</button>
                                                            </form>
                                                            <form action={async () => {
                                                                'use server';
                                                                await rejectApplication(app.id);
                                                            }}>
                                                                <button type="submit" className="btn btn-danger text-sm">Reject</button>
                                                            </form>
                                                        </>
                                                    )}
                                                    <DeleteApplicationButton applicationId={app.id} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 italic">No applications found.</div>
                    )}
                </div>

                {/* League Management */}
                <div className="card-glass mb-4">
                    <h2 className="console-section-title">League Management</h2>
                    <p className="mb-4 text-gray-400 text-sm">Create an organization for an approved operator.</p>

                    <div className="bg-black/20 p-4 rounded border border-border">
                        <AdminLeagueCreateForm approvedOperators={approvedOperators || []} />
                    </div>

                    <h3 className="console-section-title mt-5">Active Organizations</h3>
                    <div className="grid gap-6">
                        {leagues?.map((l) => (
                            <AdminLeagueCard key={l.id} league={l} operators={approvedOperators}>
                                <SuspenseSessions leagueId={l.id} />
                            </AdminLeagueCard>
                        ))}
                    </div>
                </div>

                <div className="h-5"></div>

                {/* Pre-registrations */}
                {preregs && preregs.length > 0 && (
                    <PreregistrationManager preregs={preregs as any[]} />
                )}

                {/* Landing Page Settings */}
                <div className="card-glass mb-4">
                    <h2 className="console-section-title mb-4">Landing Page Announcement</h2>
                    <LandingPageSettingsForm
                        titleLine1={lpTitle1}
                        titleLine2={lpTitle2}
                        location={lpLocation}
                        boxText={lpText}
                    />
                </div>

                {/* Financial Settings */}
                <div className="card-glass mb-4">
                    <h2 className="console-section-title mb-4">Financial Settings</h2>
                    <FinancialSettingsForm sessionFee={sessionFee} creationFee={creationFee} matchFee={matchFee} leaderboardLimit={leaderboardLimit} />
                </div>

                {/* Player Database */}
                <div className="card-glass">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                        <h2 className="console-section-title m-0">Player Database</h2>
                        <AdminPlayerFilters currentRole={roleFilter} currentStatus={playerView} />
                    </div>

                    <div className="console-table-wrap">
                        <table className="console-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedPlayers?.map((player) => (
                                    <tr key={player.id}>
                                        <td className="font-medium text-white">{player.full_name}</td>
                                        <td className="text-gray-400">{player.email}</td>
                                        <td>
                                            <RoleSelector userId={player.id} currentRole={player.role} />
                                        </td>
                                        <td>
                                            <div className="console-toolbar">
                                            <Link href={`/dashboard/admin/players/${player.id}`} className="btn btn-primary text-sm">
                                                View
                                            </Link>
                                            {(player.role === 'operator' || player.role === 'admin') && (
                                                <AssignLeagueButton operatorId={player.id} availableLeagues={leagues || []} />
                                            )}
                                            <PlayerActions playerId={player.id} isActive={player.is_active !== false} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {displayedPlayers?.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                                            No {playerView} players found matching criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main >
    );
}

async function SuspenseSessions({ leagueId }: { leagueId: string }) {
    const supabase = createAdminClient();
    const { data: sessions } = await supabase
        .from("leagues")
        .select("*")
        .eq("parent_league_id", leagueId)
        .order("created_at", { ascending: false });

    if (!sessions || sessions.length === 0) {
        return <div className="text-sm text-gray-600 ml-4 italic">No sessions yet.</div>;
    }

    return (
        <div className="ml-4 border-l border-transparent pl-4 mt-2 space-y-2">
            {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{s.name}</span>
                        <span className={`text-[10px] px-1.5 rounded uppercase font-bold
                            ${s.status === 'active' ? 'bg-[#22c55e]/20 text-[#4ade80]' :
                                s.status === 'inactive' ? 'bg-yellow-500/20 text-yellow-500' :
                                    'bg-gray-800 text-gray-500'}`}>
                            {s.status}
                        </span>
                        <SessionFeeToggle sessionId={s.id} initialStatus={s.creation_fee_status} />
                    </div>
                    <DeleteSessionButton sessionId={s.id} sessionName={s.name} />
                </div>
            ))}
        </div>
    );
}
