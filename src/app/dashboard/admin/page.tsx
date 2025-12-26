import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { approveOperator, rejectOperator, createLeagueForOperator, updateSessionFeeStatus, approveApplication, rejectApplication, deleteApplication } from "@/app/actions/admin-actions";
import { createAdminClient } from "@/utils/supabase/admin";
import PlayerActions from "@/components/PlayerActions";
import RoleSelector from "@/components/RoleSelector";
import FinancialSettingsForm from "@/components/FinancialSettingsForm";

import { deactivatePlayer, reactivatePlayer, deletePlayer } from "@/app/actions/admin-actions";
import DeleteApplicationButton from "@/components/DeleteApplicationButton";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    // ... (signature)
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const resolvedSearchParams = await searchParams;
    const playerView = (typeof resolvedSearchParams.player_status === 'string' ? resolvedSearchParams.player_status : 'active') as 'active' | 'deactivated';
    const roleFilter = (typeof resolvedSearchParams.role_filter === 'string' ? resolvedSearchParams.role_filter : 'all');

    const supabase = await createClient();

    // Verify Admin Role (Double check)
    // ...

    // Fetch Financial Settings
    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["default_session_fee", "default_creation_fee", "leaderboard_limit"]);

    const sessionFee = settings?.find(s => s.key === "default_session_fee")?.value || "25";
    const creationFee = settings?.find(s => s.key === "default_creation_fee")?.value || "100";
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

    // Fetch Approved Operators (to assign leagues)
    const { data: approvedOperators } = await supabase
        .from("profiles")
        .select("*")
        .eq("operator_status", "approved");

    // Fetch All Leagues (to see who has one)
    const { data: leagues } = await supabase
        .from("leagues")
        .select("*, profiles(full_name, email)")
        .eq("type", "league");

    // Fetch users based on filter
    let query = supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active");

    if (roleFilter !== 'all') {
        query = query.eq("role", roleFilter);
    }

    // Always order by name
    const { data: allPlayers } = await query.order("full_name");

    const displayedPlayers = allPlayers?.filter(p => playerView === 'deactivated' ? (p.is_active === false) : (p.is_active !== false));


    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                    <h1>Admin Dashboard</h1>
                    <Link href="/dashboard?view=player" className="btn" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        Go to App Dashboard
                    </Link>
                </div>

                {/* Operator Applications */}
                <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--primary)" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
                        <h2 style={{ color: "var(--primary)", marginBottom: 0 }}>
                            {showAllApps ? "All Operator Applications" : "Pending Operator Applications"}
                        </h2>
                        <Link
                            href={showAllApps ? "/dashboard/admin" : "/dashboard/admin?app_view=all"}
                            className="btn"
                            style={{ fontSize: '0.8rem', background: 'var(--surface)', border: '1px solid var(--border)' }}
                        >
                            {showAllApps ? "View Pending Only" : "View Application Archive"}
                        </Link>
                    </div>
                    {applications && applications.length > 0 ? (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            {applications.map((app) => (
                                <div key={app.id} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    padding: "1rem",
                                    background: "var(--background)",
                                    borderRadius: "0.5rem",
                                    flexWrap: "wrap",
                                    gap: "1rem"
                                }}>
                                    <div style={{ flex: "1 1 300px" }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: "bold", fontSize: '1.1rem' }}>{app.first_name} {app.last_name}</div>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '0.5rem',
                                                background: app.status === 'approved' ? 'var(--success)' : app.status === 'rejected' ? 'var(--error)' : 'var(--warning)',
                                                color: app.status === 'pending' ? '#000' : '#fff',
                                                fontWeight: 'bold'
                                            }}>
                                                {app.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#888", marginBottom: '0.5rem' }}>
                                            {app.email} • {app.phone}
                                        </div>
                                        <div style={{ fontSize: "0.9rem" }}>
                                            <strong>Location:</strong> {app.location} <br />
                                            <strong>Target:</strong> {app.desired_league_location}
                                        </div>
                                        {app.notes && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ccc', fontStyle: 'italic' }}>
                                                "{app.notes}"
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: 'column', gap: "0.5rem", flex: "1 1 150px" }}>

                                        {app.status === 'pending' && (
                                            <>
                                                <form action={async () => {
                                                    'use server';
                                                    await approveApplication(app.id);
                                                }}>
                                                    <button type="submit" className="btn" style={{ background: "var(--success)", color: "#000", width: '100%' }}>Mark Approved</button>
                                                </form>
                                                <form action={async () => {
                                                    'use server';
                                                    await rejectApplication(app.id);
                                                }}>
                                                    <button type="submit" className="btn" style={{ background: "var(--error)", color: "#fff", width: '100%' }}>Reject</button>
                                                </form>
                                            </>
                                        )}
                                        <DeleteApplicationButton applicationId={app.id} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: "#888", fontStyle: "italic" }}>No applications found.</p>
                    )}
                </div>

                {/* League Management */}
                <div className="card" style={{ marginBottom: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>League Management</h2>
                    <p style={{ marginBottom: "1rem", color: "#888" }}>Assign League Organizations to Approved Operators.</p>

                    {/* ... (Existing League Management Code omitted from replacement for brevity, wait, I must preserve it if I replace the whole block) ... */}
                    {/* Actually, I am replacing a huge chunk. I should be careful not to delete League Management logic. */}
                    {/* I will use the tool to replace only relevant parts or ensure I copy everything back. */}
                    {/* The prompt asks for START LINE 11 and END LINE 257 (nearly whole file). */}
                    {/* I MUST include the League Management code I am overwriting. */}

                    <div style={{ padding: "1.5rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Create New League Organization</h3>
                        <form action={async (formData) => {
                            'use server';
                            const operatorId = formData.get("operatorId") as string;
                            const name = formData.get("name") as string;
                            const location = formData.get("location") as string;
                            const city = formData.get("city") as string;
                            const state = formData.get("state") as string;
                            const schedule = formData.get("schedule") as string;

                            if (!operatorId) return; // Should handle error better in real app

                            await createLeagueForOperator(operatorId, name, location, city, state, schedule);
                        }} style={{ display: "grid", gap: "1rem" }}>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>League Name</label>
                                    <input name="name" placeholder="e.g. Tarrant County Billiards" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>Operator</label>
                                    <select name="operatorId" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }}>
                                        <option value="">Select an Operator...</option>
                                        {approvedOperators?.map(op => (
                                            <option key={op.id} value={op.id}>
                                                {op.full_name} ({op.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>Venue / Location</label>
                                    <input name="location" placeholder="e.g. Rusty's Billiards" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>City</label>
                                    <input name="city" placeholder="e.g. Fort Worth" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>State</label>
                                    <select name="state" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }}>
                                        <option value="">State</option>
                                        {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "end" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    <label style={{ fontSize: "0.9rem", fontWeight: "bold" }}>Schedule Day (Primary)</label>
                                    <select name="schedule" required style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #ccc" }}>
                                        <option value="Monday">Monday</option>
                                        <option value="Tuesday">Tuesday</option>
                                        <option value="Wednesday">Wednesday</option>
                                        <option value="Thursday">Thursday</option>
                                        <option value="Friday">Friday</option>
                                        <option value="Saturday">Saturday</option>
                                        <option value="Sunday">Sunday</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ height: "38px" }}>Create League</button>
                            </div>
                        </form>
                    </div>

                    <h3 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Active Organizations & Sessions</h3>
                    <div style={{ display: "grid", gap: "1rem" }}>
                        {leagues?.map((l) => (
                            <div key={l.id} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
                                <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
                                    {l.name} <span style={{ fontWeight: "normal", color: "#888" }}>- {l.profiles?.full_name} ({l.location})</span>
                                </div>

                                {/* Fetch and display sessions for this league */}
                                <SuspenseSessions leagueId={l.id} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Financial Settings */}
                <div className="card" style={{ marginBottom: "2rem", border: "1px solid var(--primary)" }}>
                    <h2 style={{ color: "var(--primary)", marginBottom: "1rem" }}>Financial Settings</h2>
                    <FinancialSettingsForm sessionFee={sessionFee} creationFee={creationFee} leaderboardLimit={leaderboardLimit} />
                </div>

                {/* Player Database */}
                <div className="card" style={{ marginTop: "2rem" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ marginBottom: 0 }}>Player Database</h2>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ marginRight: "1rem", display: "flex", gap: "0.25rem", fontSize: "0.9rem" }}>
                                <span style={{ marginRight: "0.5rem", color: "#888" }}>Role:</span>
                                <Link href={`/dashboard/admin?player_status=${playerView}&role_filter=player`} style={{ fontWeight: roleFilter === 'player' ? 'bold' : 'normal', textDecoration: 'underline' }}>Player</Link>
                                <span>|</span>
                                <Link href={`/dashboard/admin?player_status=${playerView}&role_filter=operator`} style={{ fontWeight: roleFilter === 'operator' ? 'bold' : 'normal', textDecoration: 'underline' }}>Operator</Link>
                                <span>|</span>
                                <Link href={`/dashboard/admin?player_status=${playerView}&role_filter=admin`} style={{ fontWeight: roleFilter === 'admin' ? 'bold' : 'normal', textDecoration: 'underline' }}>Admin</Link>
                                <span>|</span>
                                <Link href={`/dashboard/admin?player_status=${playerView}&role_filter=all`} style={{ fontWeight: roleFilter === 'all' ? 'bold' : 'normal', textDecoration: 'underline' }}>All</Link>
                            </div>
                            <Link
                                href={`/dashboard/admin?player_status=active&role_filter=${roleFilter}`}
                                className="btn"
                                style={{
                                    background: playerView === 'active' ? 'var(--primary)' : 'transparent',
                                    color: playerView === 'active' ? 'var(--primary-foreground)' : 'var(--foreground)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                Active
                            </Link>
                            <Link
                                href={`/dashboard/admin?player_status=deactivated&role_filter=${roleFilter}`}
                                className="btn"
                                style={{
                                    background: playerView === 'deactivated' ? 'var(--primary)' : 'transparent',
                                    color: playerView === 'deactivated' ? 'var(--primary-foreground)' : 'var(--foreground)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                Deactivated
                            </Link>
                        </div>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                <th style={{ padding: "0.5rem" }}>Name</th>
                                <th style={{ padding: "0.5rem" }}>Email</th>
                                <th style={{ padding: "0.5rem" }}>Role</th>
                                <th style={{ padding: "0.5rem" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedPlayers?.map((player) => (
                                <tr key={player.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.5rem" }}>{player.full_name}</td>
                                    <td style={{ padding: "0.5rem" }}>{player.email}</td>
                                    <td style={{ padding: "0.5rem" }}>
                                        <RoleSelector userId={player.id} currentRole={player.role} />
                                    </td>
                                    <td style={{ padding: "0.5rem", display: 'flex', gap: '0.5rem' }}>
                                        <Link href={`/dashboard/admin/players/${player.id}`} className="btn" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", border: "1px solid var(--border)" }}>
                                            View
                                        </Link>
                                        <PlayerActions playerId={player.id} isActive={player.is_active !== false} />
                                    </td>
                                </tr>
                            ))}
                            {displayedPlayers?.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#888" }}>
                                        No {playerView} players found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
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
        return <div style={{ fontSize: "0.9rem", color: "#888", marginLeft: "1rem" }}>No sessions yet.</div>;
    }

    return (
        <div style={{ marginLeft: "1rem", borderLeft: "2px solid var(--border)", paddingLeft: "1rem" }}>
            {sessions.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div>
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                        <span style={{ fontSize: "0.8rem", marginLeft: "0.5rem", color: s.status === 'active' ? 'var(--success)' : '#888' }}>
                            {s.status.toUpperCase()}
                        </span>
                        <span style={{
                            fontSize: "0.8rem",
                            marginLeft: "0.5rem",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "0.5rem",
                            background: s.creation_fee_status === 'unpaid' ? 'var(--error)' : 'var(--success)',
                            color: s.creation_fee_status === 'unpaid' ? '#fff' : '#000'
                        }}>
                            Fee: {s.creation_fee_status}
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {s.creation_fee_status === 'unpaid' && (
                            <>
                                <form action={async () => {
                                    'use server';
                                    await updateSessionFeeStatus(s.id, 'paid');
                                }}>
                                    <button className="btn" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", background: "var(--success)", color: "#000" }}>Mark Paid</button>
                                </form>
                                <form action={async () => {
                                    'use server';
                                    await updateSessionFeeStatus(s.id, 'waived');
                                }}>
                                    <button className="btn" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", background: "var(--surface)", border: "1px solid var(--border)" }}>Waive</button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
