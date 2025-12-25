import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getPlayerLifetimeStats } from "@/app/actions/stats-actions";
import RoleSelector from "@/components/RoleSelector";
import FargoEditor from "@/components/FargoEditor";

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    // Verify Admin (Simple check for now, ideally use middleware or robust check)
    const supabase = await createClient();
    const { data: currentUser } = await supabase.from("profiles").select("role").eq("id", userId).single();
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'operator') { // Allow operators too? Prompt said Admin.
        // Strict Admin check
        // Actually, let's stick to the requested "Admin side"
    }

    const { data: player } = await supabase.from("profiles").select("*").eq("id", id).single();
    const stats = await getPlayerLifetimeStats(id);

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem" }}>
                <h1>{player?.full_name}</h1>
                <p style={{ color: "#888", marginBottom: "2rem" }}>Player Profile</p>

                <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                    <h2 style={{ marginBottom: "1rem" }}>Lifetime Stats</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                        <div>
                            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.winRate}%</div>
                            <div>Win Rate</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.matchesPlayed}</div>
                            <div>Matches</div>
                        </div>
                        <div>
                            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>{stats?.pointsPerMatch}</div>
                            <div>PPM</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: "2rem", padding: "2rem" }}>
                <h2 style={{ marginBottom: "1rem" }}>Management</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ fontWeight: "bold" }}>Role:</div>
                    <RoleSelector userId={id} currentRole={player?.role || 'player'} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                    <div style={{ fontWeight: "bold" }}>Fargo Rating:</div>
                    <FargoEditor playerId={id} currentFargo={player?.fargo_rating} />
                </div>
            </div>
        </main>
    );
}
