import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { joinLeague } from "@/app/actions/league-actions";

export default async function JoinLeaguePage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Fetch all active leagues
    const { data: leagues } = await supabase
        .from("leagues")
        .select("*, profiles:operator_id(full_name)")
        .eq("status", "active")
        .eq("type", "league")
        .order("created_at", { ascending: false });

    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "800px" }}>
                <div style={{ textAlign: "center", marginBottom: "3rem" }}>
                    <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "1rem", color: "var(--primary)" }}>
                        Join a League
                    </h1>
                    <p style={{ color: "#888", fontSize: "1.1rem" }}>
                        Select a league to start your journey.
                    </p>
                </div>

                {leagues && leagues.length > 0 ? (
                    <div style={{ display: "grid", gap: "1.5rem" }}>
                        {leagues.map((league) => (
                            <div key={league.id} className="card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "2rem"
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>{league.name}</h3>
                                    <p style={{ color: "#888", marginBottom: "1rem" }}>Operator: {league.profiles?.full_name || 'Unknown'}</p>
                                    <form action={async () => {
                                        'use server';
                                        await joinLeague(league.id, userId);
                                        redirect('/dashboard');
                                    }}>
                                        <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1.5rem", fontSize: "0.9rem" }}>
                                            Request to Join
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
                        <h3 style={{ marginBottom: "1rem" }}>No Active Leagues Found</h3>
                        <p style={{ color: "#888" }}>Check back later or contact your league operator.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
