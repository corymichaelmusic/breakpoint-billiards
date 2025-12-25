import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getPlayerLeagueStats } from "@/app/actions/stats-actions";
import Link from 'next/link';

export default async function OperatorPlayerLeaguePage({ params }: { params: Promise<{ id: string, playerId: string }> }) {
    const { id: sessionId, playerId } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Verify Operator Role
    const { data: currentUser } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (currentUser?.role !== 'operator' && currentUser?.role !== 'admin') {
        redirect("/dashboard");
    }

    // Fetch Player Profile
    const { data: player } = await supabase.from("profiles").select("*").eq("id", playerId).single();

    // Fetch Target League Name
    // We used sessionId as the entry point, but we want stats for the "League Organization" if possible.
    // getPlayerLeagueStats handles the parent lookup logic internally if we pass the session ID?
    // Wait, my implementation of getPlayerLeagueStats calculates parent ID internally.
    // So passing sessionId is fine.

    // 1. Fetch Current Session Info
    const { data: currentLeague } = await supabase.from("leagues").select("*").eq("id", sessionId).single();

    let displayLeagueName = currentLeague?.name;
    let rankTargetLeagueId = sessionId;

    // 2. Resolve Parent League (if applicable)
    if (currentLeague?.type === 'session' && currentLeague?.parent_league_id) {
        rankTargetLeagueId = currentLeague.parent_league_id;
        const { data: parentLeague } = await supabase.from("leagues").select("name").eq("id", rankTargetLeagueId).single();
        if (parentLeague) {
            displayLeagueName = parentLeague.name;
        }
    }

    const stats = await getPlayerLeagueStats(playerId, sessionId);

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <Link href={`/dashboard/operator/leagues/${sessionId}`} style={{ fontSize: "0.9rem", opacity: 0.7, textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
                    &larr; Back to Session
                </Link>

                <h1 style={{ marginTop: 0 }}>
                    <span style={{ color: "var(--primary)" }}>{displayLeagueName}</span> Lifetime Stats for {player?.full_name}
                </h1>

                <div style={{ marginBottom: "2rem" }}>
                    <p style={{ color: "#888", margin: 0 }}>
                        Player Profile
                    </p>
                </div>

                <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr) 1fr 1fr", gap: "2rem", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "3rem", fontWeight: "bold", color: "var(--primary)" }}>{stats?.winRate}%</div>
                            <div style={{ color: "#888" }}>Win Rate</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "3rem", fontWeight: "bold" }}>{stats?.pointsPerMatch}</div>
                            <div style={{ color: "#888" }}>PPM</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{stats?.matchesPlayed}</div>
                            <div style={{ color: "#888" }}>Matches</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                                {stats?.matchesWon} - {stats?.matchesLost}
                            </div>
                            <div style={{ color: "#888" }}>W - L</div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: "2rem", padding: "2rem" }}>
                    <h3 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Breakdown</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                        <div>
                            <h4 style={{ color: "var(--primary)" }}>8-Ball</h4>
                            <p>Win Rate: <strong>{stats?.winRate_8ball}%</strong></p>
                            <p>Matches: {stats?.matchesPlayed_8ball} ({stats?.matchesWon_8ball} - {stats?.matchesLost_8ball})</p>
                            <p>Break & Runs: {stats?.breakAndRuns_8ball}</p>
                            <p>Rack & Runs: {stats?.rackAndRuns_8ball}</p>
                        </div>
                        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "2rem" }}>
                            <h4 style={{ color: "var(--primary)" }}>9-Ball</h4>
                            <p>Win Rate: <strong>{stats?.winRate_9ball}%</strong></p>
                            <p>Matches: {stats?.matchesPlayed_9ball} ({stats?.matchesWon_9ball} - {stats?.matchesLost_9ball})</p>
                            <p>Break & Runs: {stats?.breakAndRuns_9ball}</p>
                            <p>9 on Snap: {stats?.nineOnSnaps_9ball}</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
