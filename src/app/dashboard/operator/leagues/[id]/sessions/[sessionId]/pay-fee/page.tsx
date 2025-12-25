import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default async function PayFeePage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
    const { id, sessionId } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Verify ownership and get session details
    const { data: session } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", sessionId)
        .eq("operator_id", userId)
        .single();

    if (!session) redirect("/dashboard/operator");

    if (session.creation_fee_status === 'paid' || session.creation_fee_status === 'waived') {
        redirect(`/dashboard/operator/leagues/${sessionId}`);
    }

    const SESSION_FEE = 50.00; // Example fee

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "600px", textAlign: "center" }}>
                <div className="card" style={{ padding: "3rem" }}>
                    <h1 style={{ marginBottom: "1rem" }}>Activate Your Session</h1>
                    <p style={{ color: "#888", marginBottom: "2rem" }}>
                        To start scheduling matches and managing your league, a one-time session creation fee is required.
                    </p>

                    <div style={{
                        fontSize: "3rem",
                        fontWeight: "bold",
                        color: "var(--primary)",
                        marginBottom: "2rem"
                    }}>
                        ${SESSION_FEE.toFixed(2)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <button className="btn btn-primary" style={{ width: "100%", fontSize: "1.2rem", padding: "1rem" }}>
                            Pay Now via Polar
                        </button>

                        <Link
                            href={`/dashboard/operator/leagues/${sessionId}`}
                            className="btn"
                            style={{
                                width: "100%",
                                background: "transparent",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)"
                            }}
                        >
                            Pay Later
                        </Link>
                    </div>

                    <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "#666" }}>
                        You can pay this fee at any time from your session dashboard.
                    </p>
                </div>
            </div>
        </main>
    );
}
