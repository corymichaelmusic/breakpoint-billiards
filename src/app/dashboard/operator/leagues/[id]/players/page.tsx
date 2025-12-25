import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import FargoEditor from "@/components/FargoEditor";

export default async function LeaguePlayersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params; // League Org ID
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify ownership
    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .eq("operator_id", userId)
        .single();

    if (!league) redirect("/dashboard/operator");

    // Fetch all sessions for this league org
    const { data: sessions } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("parent_league_id", id);

    const sessionIds = sessions?.map(s => s.id) || [];
    const allLeagueIds = [id, ...sessionIds];

    // Fetch players from Organization AND all sessions
    // We need to join league_players with profiles
    const { data: players } = await adminClient
        .from("league_players")
        .select("*, profiles(*), leagues(name)")
        .in("league_id", allLeagueIds)
        .in("league_id", allLeagueIds)
        .order("joined_at", { ascending: false });

    console.log(`[LeaguePlayersPage] Fetched ${players?.length} records. Revalidating...`);

    // Deduplicate players and aggregate session info
    const uniquePlayers = new Map<string, any>();

    players?.forEach(p => {
        if (!uniquePlayers.has(p.player_id)) {
            uniquePlayers.set(p.player_id, {
                ...p,
                sessions: [],
                leagueStatus: 'inactive' // Default
            });
        }

        const player = uniquePlayers.get(p.player_id);

        // If this record is for the parent league, set main status
        if (p.league_id === id) {
            player.leagueStatus = p.status;
            player.payment_status = p.payment_status; // Use league payment status as primary or show both?
            // Let's keep the league payment status as the main one for now
        } else {
            // It's a session
            player.sessions.push({
                name: p.leagues?.name,
                status: p.status,
                payment: p.payment_status
            });
        }
    });

    const playerList = Array.from(uniquePlayers.values());

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <Link href="/dashboard/operator" style={{ marginBottom: "1rem", display: "inline-block", opacity: 0.7 }}>
                    &larr; Back to Dashboard
                </Link>
                <h1 style={{ marginBottom: "2rem" }}>Player Database ({playerList.length})</h1>

                <div className="card">
                    {playerList.length > 0 ? (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ padding: "0.5rem" }}>Name</th>
                                    <th style={{ padding: "0.5rem" }}>Email</th>
                                    <th style={{ padding: "0.5rem" }}>Phone</th>
                                    <th style={{ padding: "0.5rem" }}>Fargo</th>
                                    <th style={{ padding: "0.5rem" }}>League Status</th>
                                    <th style={{ padding: "0.5rem" }}>Active Sessions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {playerList.map((p) => (
                                    <tr key={p.player_id} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "0.5rem" }}>
                                            <Link href={`/dashboard/operator/leagues/${id}/players/${p.player_id}`} style={{ fontWeight: "bold", color: "var(--primary)" }}>
                                                {p.profiles?.full_name || "Unknown"}
                                            </Link>
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>{p.profiles?.email}</td>
                                        <td style={{ padding: "0.5rem" }}>{p.profiles?.phone || "N/A"}</td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <FargoEditor playerId={p.player_id} currentFargo={p.profiles?.fargo_rating} />
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <span style={{
                                                padding: "0.25rem 0.5rem",
                                                borderRadius: "1rem",
                                                fontSize: "0.8rem",
                                                background: p.leagueStatus === 'active' ? 'var(--success)' : 'var(--surface)',
                                                color: p.leagueStatus === 'active' ? '#000' : 'inherit'
                                            }}>
                                                {p.leagueStatus}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.5rem" }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {p.sessions.map((s: any, idx: number) => {
                                                    const isPaid = ['paid', 'paid_cash', 'paid_online'].includes(s.payment);
                                                    const isWaived = s.payment === 'waived';
                                                    const isUnpaid = s.payment === 'unpaid';

                                                    let bg = "var(--surface)";
                                                    let color = "inherit";
                                                    let border = "1px solid var(--border)";

                                                    if (isPaid) {
                                                        bg = "rgba(34, 197, 94, 0.2)";
                                                        color = "var(--success)";
                                                        border = "1px solid var(--success)";
                                                    } else if (isUnpaid) {
                                                        bg = "rgba(239, 68, 68, 0.2)";
                                                        color = "var(--error)";
                                                        border = "1px solid var(--error)";
                                                    } else if (isWaived) {
                                                        bg = "transparent";
                                                        color = "#888";
                                                        border = "1px solid #666";
                                                    }

                                                    return (
                                                        <span key={idx} style={{
                                                            padding: "0.25rem 0.5rem",
                                                            borderRadius: "0.5rem",
                                                            fontSize: "0.75rem",
                                                            border: border,
                                                            background: bg,
                                                            color: color
                                                        }}>
                                                            {s.name}
                                                        </span>
                                                    );
                                                })}
                                                {p.sessions.length === 0 && <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>None</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: "#888", fontStyle: "italic" }}>No players found in database.</p>
                    )}
                </div>
            </div>
        </main>
    );
}
