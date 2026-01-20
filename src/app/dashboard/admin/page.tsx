import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPlayerFilters from "@/components/AdminPlayerFilters";
import Navbar from "@/components/Navbar";
import { approveOperator, rejectOperator, createLeagueForOperator, updateSessionFeeStatus, approveApplication, rejectApplication, deleteApplication, deleteLeague, archiveLeague } from "@/app/actions/admin-actions";
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

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {

    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const resolvedSearchParams = await searchParams;
    const playerView = (typeof resolvedSearchParams.player_status === 'string' ? resolvedSearchParams.player_status : 'active') as 'active' | 'deactivated';
    const roleFilter = (typeof resolvedSearchParams.role_filter === 'string' ? resolvedSearchParams.role_filter : 'all');

    const supabase = await createClient();

    // Verify Admin Role (Double check)
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profile?.role !== 'admin') {
        redirect("/dashboard/operator");
    }

    // Fetch Financial Settings
    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_session_fee", "default_creation_fee", "default_match_fee", "leaderboard_limit"]);

    const sessionFee = settings?.find(s => s.key === "default_session_fee")?.value || "25";
    const creationFee = settings?.find(s => s.key === "default_creation_fee")?.value || "100";
    const matchFee = settings?.find(s => s.key === "default_match_fee")?.value || "20";
    const leaderboardLimit = settings?.find(s => s.key === "leaderboard_limit")?.value || "25";

    // Application View Logic
    const showAllApps = resolvedSearchParams.app_view === 'all';
    const adminSupabase = createAdminClient();

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
        .select("*, profiles(full_name, email), league_operators(profiles(full_name, email))")
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
        <main className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <div className="container py-12 pb-24">
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold font-sans text-white">Admin Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-1">System Overview & Management</p>
                    </div>
                </div>

                {/* Account Deletion Requests */}
                {deletionRequests && deletionRequests.length > 0 && (
                    <DeletionRequestManager requests={deletionRequests as any[]} />
                )}

                {/* Operator Applications */}
                <div className="card-glass mb-16 border-primary/30">
                    <div className="flex justify-between items-center mb-8 pb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {showAllApps ? "All Operator Applications" : "Pending Operator Applications"}
                            {!showAllApps && applications && applications.length > 0 && (
                                <span className="bg-primary text-black text-xs px-2 py-0.5 rounded-full">{applications.length}</span>
                            )}
                        </h2>
                        <Link
                            href={showAllApps ? "/dashboard/admin" : "/dashboard/admin?app_view=all"}
                            className="btn bg-[#D4AF37] text-black hover:bg-[#b0902c] border-transparent font-bold text-xs px-4 py-2 uppercase tracking-wide"
                        >
                            {showAllApps ? "View Pending Only" : "View Application Archive"}
                        </Link>
                    </div>

                    {applications && applications.length > 0 ? (
                        <div className="grid gap-8">
                            {applications.map((app) => (
                                <div key={app.id} className="bg-surface/50 p-6 rounded border border-transparent flex flex-col md:flex-row justify-between gap-8">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 flex-wrap mb-4">
                                            <div className="font-bold text-lg text-white">{app.first_name} {app.last_name}</div>
                                            <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wide
                                                ${app.status === 'approved' ? 'bg-success/20 text-success' :
                                                    app.status === 'rejected' ? 'bg-error/20 text-error' :
                                                        'bg-warning/20 text-warning'}`}>
                                                {app.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 mb-4">
                                            <span className="text-gray-300">{app.email}</span> • {app.phone}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                                            <div><span className="text-gray-500">Location:</span> {app.location}</div>
                                            <div><span className="text-gray-500">Target Area:</span> {app.desired_league_location}</div>
                                        </div>
                                        {app.notes && (
                                            <div className="mt-4 text-sm text-gray-400 italic bg-black/20 p-4 rounded">
                                                "{app.notes}"
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-4 min-w-[140px]">
                                        {app.status === 'pending' && (
                                            <>
                                                <form action={async () => {
                                                    'use server';
                                                    await approveApplication(app.id);
                                                }}>
                                                    <button type="submit" className="btn w-full bg-success hover:bg-success/90 text-black font-bold text-sm py-3">Approve</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    await rejectApplication(app.id);
                                                }}>
                                                    <button type="submit" className="btn w-full bg-error/10 hover:bg-error border border-error text-error hover:text-white text-sm py-3">Reject</button>
                                                </form>
                                            </>
                                        )}
                                        <DeleteApplicationButton applicationId={app.id} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 italic">No applications found.</div>
                    )}
                </div>

                <div className="h-5"></div>

                {/* League Management */}
                <div className="card-glass mb-16">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-transparent pb-4">League Management</h2>
                    <p className="mb-6 text-gray-400 text-sm">Create Organization for Approved Operator</p>

                    <div className="bg-surface/50 p-10 rounded border border-transparent">
                        <form action={async (formData) => {
                            'use server';
                            const operatorId = formData.get("operatorId") as string;
                            const name = formData.get("name") as string;
                            const location = formData.get("location") as string;
                            const city = formData.get("city") as string;
                            const state = formData.get("state") as string;
                            const schedule = formData.get("schedule") as string;

                            if (!operatorId) return;

                            await createLeagueForOperator(operatorId, name, location, city, state, schedule);
                        }}>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">League Name</label>
                                    <input name="name" placeholder="e.g. Tarrant County Billiards" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Operator</label>
                                    <select name="operatorId" required className="input bg-black/50 border-transparent focus:border-primary text-sm py-3">
                                        <option value="">Select an Operator...</option>
                                        {approvedOperators?.map(op => (
                                            <option key={op.id} value={op.id}>
                                                {op.full_name} ({op.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-16">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Venue</label>
                                    <input name="location" placeholder="e.g. Rusty's Billiards" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">City</label>
                                    <input name="city" placeholder="e.g. Fort Worth" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">State</label>
                                    <select name="state" required className="input bg-black/50 border-transparent focus:border-primary text-sm py-3">
                                        <option value="">State</option>
                                        {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-16 items-end">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Primary Schedule Day</label>
                                    <select name="schedule" required className="input bg-black/50 border-transparent focus:border-primary text-sm py-3">
                                        <option value="Monday">Monday</option>
                                        <option value="Tuesday">Tuesday</option>
                                        <option value="Wednesday">Wednesday</option>
                                        <option value="Thursday">Thursday</option>
                                        <option value="Friday">Friday</option>
                                        <option value="Saturday">Saturday</option>
                                        <option value="Sunday">Sunday</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary h-12 px-10 text-lg">Create League</button>
                            </div>
                        </form>
                    </div>

                    <div className="h-24 w-full">{/* Spacer */}</div>

                    <h3 className="text-xl font-bold text-gray-300 mb-8">Active Organizations</h3>
                    <div className="grid gap-6">
                        {leagues?.map((l) => (
                            <div key={l.id} className="p-6 border border-transparent rounded bg-surface/30">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="font-bold text-white text-lg">
                                        {l.name} <span className="font-normal text-gray-500">- {
                                            l.league_operators && l.league_operators.length > 0
                                                ? l.league_operators.map((op: any) => op.profiles?.full_name).join(", ")
                                                : l.profiles?.full_name
                                        } ({l.location})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-white uppercase font-bold tracking-wider mr-2">{l.schedule_day}s</div>
                                        <form action={async () => {
                                            'use server';
                                            await archiveLeague(l.id);
                                        }}>
                                            <button className="btn h-8 text-[10px] uppercase tracking-widest px-3 border !border-yellow-500/50 !text-yellow-500 hover:!bg-yellow-500/10 hover:!text-yellow-400 hover:!border-yellow-400 transition-colors">Archive</button>
                                        </form>
                                        <form action={async () => {
                                            'use server';
                                            await deleteLeague(l.id);
                                        }}>
                                            <button className="btn h-8 text-[10px] uppercase tracking-widest px-3 border !border-red-500/50 !text-red-500 hover:!bg-red-500/10 hover:!text-red-400 hover:!border-red-400 transition-colors">Delete</button>
                                        </form>
                                    </div>
                                </div>
                                <SuspenseSessions leagueId={l.id} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="h-5"></div>

                {/* Pre-registrations */}
                {preregs && preregs.length > 0 && (
                    <PreregistrationManager preregs={preregs as any[]} />
                )}

                <div className="h-5"></div>

                {/* Financial Settings */}
                <div className="card-glass mb-16 border-primary/30">
                    <h2 className="text-xl font-bold text-white mb-6 border-b border-transparent pb-4">Financial Settings</h2>
                    <FinancialSettingsForm sessionFee={sessionFee} creationFee={creationFee} matchFee={matchFee} leaderboardLimit={leaderboardLimit} />
                </div>

                <div className="h-5"></div>

                {/* Player Database */}
                <div className="card-glass">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                        <h2 className="text-xl font-bold text-white m-0">Player Database</h2>
                        <AdminPlayerFilters currentRole={roleFilter} currentStatus={playerView} />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-[3px]">
                            <thead>
                                <tr className="border-b border-transparent text-gray-500 text-sm uppercase">
                                    <th className="p-3 font-semibold">Name</th>
                                    <th className="p-3 font-semibold">Email</th>
                                    <th className="p-3 font-semibold">Role</th>
                                    <th className="p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedPlayers?.map((player) => (
                                    <tr key={player.id} className="bg-white/5 hover:bg-white/10 transition-colors">
                                        <td className="p-3 font-medium text-white">{player.full_name}</td>
                                        <td className="p-3 text-gray-400">{player.email}</td>
                                        <td className="p-3">
                                            <RoleSelector userId={player.id} currentRole={player.role} />
                                        </td>
                                        <td className="p-3 flex gap-2">
                                            <Link href={`/dashboard/admin/players/${player.id}`} className="btn bg-[#D4AF37] text-black hover:bg-[#b0902c] border-transparent font-bold text-xs px-4 py-2 uppercase tracking-wide">
                                                View
                                            </Link>
                                            {(player.role === 'operator' || player.role === 'admin') && (
                                                <AssignLeagueButton operatorId={player.id} availableLeagues={leagues || []} />
                                            )}
                                            <PlayerActions playerId={player.id} isActive={player.is_active !== false} />
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
