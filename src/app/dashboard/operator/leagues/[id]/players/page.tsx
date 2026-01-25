import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import BreakpointRatingEditor from "@/components/BreakpointRatingEditor";
import RatingConversionCalculator from "@/components/RatingConversionCalculator";
import BackButton from "@/components/BackButton";
import PlayerStatusControl from "@/components/PlayerStatusControl";

export default async function LeaguePlayersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params; // League Org ID
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify ownership
    // Verify ownership or access
    const { data: league } = await adminClient
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) redirect("/dashboard/operator");

    // Check permissions
    let hasAccess = league.operator_id === userId;

    if (!hasAccess) {
        // Check if assigned operator
        const { count } = await adminClient
            .from("league_operators")
            .select("*", { count: 'exact', head: true })
            .eq("league_id", id)
            .eq("user_id", userId);

        if (count && count > 0) hasAccess = true;
    }

    if (!hasAccess) {
        // Check if global admin
        const { data: profile } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profile?.role === 'admin') hasAccess = true;
    }

    if (!hasAccess) redirect("/dashboard/operator");

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

            // FIX: If we are viewing a specific Session, include it in the Active Sessions list
            if (league.type === 'session') {
                player.sessions.push({
                    name: p.leagues?.name,
                    status: p.status,
                    payment: p.payment_status
                });
            }
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
                        <div className="h-[10px]" />
                        <BackButton label="Back" className="!text-[#D4AF37] hover:!text-white" />
                        <h1 className="text-3xl font-bold font-sans text-[#D4AF37] mt-2">{league.name} Player Database</h1>
                        <p className="text-gray-400">Total Players: {playerList.length}</p>
                    </div>
                </div>

                <RatingConversionCalculator />

                <div className="card-glass p-6">
                    {playerList.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-gray-500 text-xs uppercase">
                                        <th className="p-3 font-semibold">Name</th>
                                        <th className="p-3 font-semibold">Contact</th>
                                        <th className="p-3 font-semibold">Rating</th>
                                        <th className="p-3 font-semibold">Org Status</th>
                                        <th className="p-3 font-semibold">Active Sessions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {playerList.map((p) => {
                                        // Safely extract profile
                                        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                                        const rating = profile?.breakpoint_rating;

                                        return (
                                            <tr key={p.player_id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium">
                                                    <Link href={`/dashboard/operator/leagues/${id}/players/${p.player_id}`} className="!text-white hover:!text-[#D4AF37] transition-colors font-bold" style={{ color: 'white' }}>
                                                        {profile?.full_name || "Unknown"}
                                                    </Link>
                                                </td>
                                                <td className="p-3 text-sm text-gray-400">
                                                    <div>{profile?.email}</div>
                                                    <div className="text-xs opacity-70">{profile?.phone || "No Phone"}</div>
                                                </td>
                                                <td className="p-3">
                                                    <BreakpointRatingEditor
                                                        leagueId={id}
                                                        playerId={p.player_id}
                                                        currentRating={rating}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    {league.type === 'league' ? (
                                                        // For Org level, we generally don't have a direct "join request" flow yet, usually it's per session.
                                                        // But the table logic uses `p.leagueStatus` which is correct for the current context (id).
                                                        <PlayerStatusControl leagueId={id} playerId={p.player_id} currentStatus={p.leagueStatus} />
                                                    ) : (
                                                        // If we are in a session context, usually the ID is the session ID.
                                                        // The logic above sets p.leagueStatus based on p.league_id === id.
                                                        <PlayerStatusControl leagueId={id} playerId={p.player_id} currentStatus={p.leagueStatus} />
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {p.sessions.map((s: any, idx: number) => {
                                                            const isPaid = ['paid', 'paid_cash', 'paid_online'].includes(s.payment);
                                                            const isUnpaid = s.payment === 'unpaid';

                                                            return (
                                                                <span key={idx} className={`text-[10px] px-2 py-0.5 rounded border font-semibold
                                                                ${isPaid ? 'bg-[#22c55e]/10 text-[#4ade80] border-[#22c55e]/30' :
                                                                        isUnpaid ? 'bg-error/10 text-[#ef4444] border-[#ef4444]/50' :
                                                                            'bg-surface text-gray-300 border-gray-600'}`}>
                                                                    {s.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {p.sessions.length === 0 && <span className="text-gray-600 text-xs italic">None</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
