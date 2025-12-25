import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

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
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", maxWidth: "600px" }}>
                <h1>Schedule Match</h1>
                <div className="card" style={{ marginTop: "1rem" }}>
                    <form action={scheduleMatch} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="week_number">Week Number</label>
                            <input
                                type="number"
                                id="week_number"
                                name="week_number"
                                min="1"
                                defaultValue="1"
                                required
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="player1_id">Player 1</label>
                            <select id="player1_id" name="player1_id" required className={styles.select}>
                                <option value="">Select Player 1</option>
                                {players?.map((player) => (
                                    <option key={player.id} value={player.id}>{player.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="player2_id">Player 2</label>
                            <select id="player2_id" name="player2_id" required className={styles.select}>
                                <option value="">Select Player 2</option>
                                {players?.map((player) => (
                                    <option key={player.id} value={player.id}>{player.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.actions}>
                            <button type="submit" className="btn btn-primary">Schedule Match</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
