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
    const { data: players } = await adminClient
        .from("league_players")
        .select("*, profiles(*), leagues(name)")
        .in("league_id", allLeagueIds)
        .order("joined_at", { ascending: false });

    // Deduplicate players
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

        if (p.league_id === id) {
            player.leagueStatus = p.status;
            player.payment_status = p.payment_status;
        } else {
            player.sessions.push({
                name: p.leagues?.name,
                status: p.status,
                payment: p.payment_status
            });
        }
    });

    const playerList = Array.from(uniquePlayers.values());

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container py-8 max-w-6xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Back to League</Link>
                        <h1 className="text-3xl font-bold font-sans text-primary mt-2">Player Database</h1>
                        <p className="text-gray-400">Total Players: {playerList.length}</p>
                    </div>
                </div>

                <div className="card-glass p-6">
                    {playerList.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-gray-500 text-xs uppercase">
                                        <th className="p-3 font-semibold">Name</th>
                                        <th className="p-3 font-semibold">Contact</th>
                                        <th className="p-3 font-semibold">Fargo</th>
                                        <th className="p-3 font-semibold">Org Status</th>
                                        <th className="p-3 font-semibold">Active Sessions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {playerList.map((p) => (
                                        <tr key={p.player_id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-medium">
                                                <Link href={`/dashboard/operator/leagues/${id}/players/${p.player_id}`} className="text-white hover:text-primary transition-colors font-bold">
                                                    {p.profiles?.full_name || "Unknown"}
                                                </Link>
                                            </td>
                                            <td className="p-3 text-sm text-gray-400">
                                                <div>{p.profiles?.email}</div>
                                                <div className="text-xs opacity-70">{p.profiles?.phone || "No Phone"}</div>
                                            </td>
                                            <td className="p-3">
                                                <FargoEditor playerId={p.player_id} currentFargo={p.profiles?.fargo_rating} />
                                            </td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wide border
                                                    ${p.leagueStatus === 'active' ? 'bg-success/20 text-success border-success/30' : 'bg-surface text-gray-400 border-border'}`}>
                                                    {p.leagueStatus}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.sessions.map((s: any, idx: number) => {
                                                        const isPaid = ['paid', 'paid_cash', 'paid_online'].includes(s.payment);
                                                        const isUnpaid = s.payment === 'unpaid';

                                                        return (
                                                            <span key={idx} className={`text-[10px] px-2 py-0.5 rounded border font-semibold
                                                                ${isPaid ? 'bg-success/10 text-success border-success/30' :
                                                                    isUnpaid ? 'bg-error/10 text-error border-error/50' :
                                                                        'bg-surface text-gray-400 border-gray-600'}`}>
                                                                {s.name}
                                                            </span>
                                                        );
                                                    })}
                                                    {p.sessions.length === 0 && <span className="text-gray-600 text-xs italic">None</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 italic">No players found in database.</div>
                    )}
                </div>
            </div>
        </main>
    );
}
