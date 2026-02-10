import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default async function ScheduleMatchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Fetch all players
    const { data: players } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "player")
        .eq("is_active", true)
        .order("full_name");

    async function scheduleMatch(formData: FormData) {
        "use server";
        const player1_id = formData.get("player1_id") as string;
        const player2_id = formData.get("player2_id") as string;
        const week_number = parseInt(formData.get("week_number") as string);
        const { userId } = await auth();
        const { id: leagueId } = await params;

        if (!userId || !player1_id || !player2_id || !week_number) return;

        const supabase = createAdminClient();
        const { error } = await supabase.from("matches").insert({
            league_id: leagueId,
            player1_id,
            player2_id,
            week_number,
            status: "scheduled",
        });

        if (error) {
            console.error("Error scheduling match:", error);
        } else {
            redirect(`/dashboard/operator/leagues/${leagueId}`);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container py-8 max-w-lg mt-12">
                <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-gray-500 hover:text-white transition-colors mb-4 block">
                    &larr; Back to Session
                </Link>

                <div className="card-glass p-8">
                    <h1 className="text-2xl font-bold font-sans text-primary mb-6">Schedule Match</h1>
                    <form action={scheduleMatch} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="week_number" className="text-xs font-bold text-gray-400 uppercase">Week Number</label>
                            <input
                                type="number"
                                id="week_number"
                                name="week_number"
                                min="1"
                                defaultValue="1"
                                required
                                className="input w-full bg-black/50 border-gray-700 focus:border-primary text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="player1_id" className="text-xs font-bold text-gray-400 uppercase">Player 1</label>
                            <select id="player1_id" name="player1_id" required className="input w-full bg-black/50 border-gray-700 focus:border-primary text-white">
                                <option value="">Select Player 1</option>
                                {players?.map((player) => (
                                    <option key={player.id} value={player.id}>{player.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="player2_id" className="text-xs font-bold text-gray-400 uppercase">Player 2</label>
                            <select id="player2_id" name="player2_id" required className="input w-full bg-black/50 border-gray-700 focus:border-primary text-white">
                                <option value="">Select Player 2</option>
                                {players?.map((player) => (
                                    <option key={player.id} value={player.id}>{player.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-4">
                            <button type="submit" className="btn btn-primary w-full py-3 font-bold">Schedule Match</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
