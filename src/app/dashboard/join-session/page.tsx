import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import JoinSessionForm from "@/components/JoinSessionForm";

export default async function JoinSessionPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    const supabase = await createClient();

    // 1. Fetch all active LEAGUES (Organizations)
    const { data: leagues } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("type", "league")
        .eq("status", "active");

    // 2. Fetch all setup SESSIONS (Active sessions cannot be joined)
    const { data: sessions } = await supabase
        .from("leagues")
        .select("id, name, status, parent_league_id")
        .eq("type", "session")
        .eq("status", "setup");

    // 3. Fetch user's existing memberships to filter them out
    const { data: myMemberships } = await supabase
        .from("league_players")
        .select("league_id")
        .eq("player_id", userId);

    const myLeagueIds = new Set(myMemberships?.map(m => m.league_id) || []);

    // 4. Group sessions by parent league and filter
    const formattedLeagues = leagues?.map(league => {
        const leagueSessions = sessions?.filter(s =>
            s.parent_league_id === league.id &&
            !myLeagueIds.has(s.id) // Filter out joined sessions
        ) || [];

        return {
            ...league,
            sessions: leagueSessions
        };
    }).filter(l => l.sessions.length > 0) || []; // Only show leagues with available sessions

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem" }}>
                <Link href="/dashboard" style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '2rem', textAlign: "center" }}>
                    &larr; Back to Dashboard
                </Link>
                <JoinSessionForm leagues={formattedLeagues} />
            </div>
        </main>
    );
}
