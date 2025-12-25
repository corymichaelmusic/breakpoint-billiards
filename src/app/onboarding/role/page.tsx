import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { updateUserRole } from "@/app/actions/user-actions";

export default async function RoleSelectionPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "800px", textAlign: "center" }}>
                <h1 style={{ marginBottom: "1rem" }}>Welcome to Breakpoint Billiards</h1>
                <p style={{ fontSize: "1.2rem", color: "#888", marginBottom: "3rem" }}>
                    How would you like to use the platform?
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "2rem" }}>
                    {/* Player Option */}
                    <div className="card hover-effect" style={{ padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                            <h2 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Player</h2>
                            <p style={{ color: "#888", marginBottom: "2rem" }}>
                                Join leagues, view schedules, and track your stats.
                            </p>
                        </div>
                        <form action={async () => {
                            'use server';
                            await updateUserRole('player');
                        }}>
                            <button className="btn btn-primary" style={{ width: "100%" }}>Select Player</button>
                        </form>
                    </div>

                    {/* Operator Option */}
                    <div className="card hover-effect" style={{ padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                            <h2 style={{ marginBottom: "1rem", color: "var(--primary)" }}>League Operator</h2>
                            <p style={{ color: "#888", marginBottom: "2rem" }}>
                                Manage leagues, schedule matches, and handle payments.
                                <br /><span style={{ fontSize: "0.8rem", color: "var(--warning)" }}>(Requires Admin Approval)</span>
                            </p>
                        </div>
                        <form action={async () => {
                            'use server';
                            await updateUserRole('operator');
                        }}>
                            <button className="btn btn-primary" style={{ width: "100%" }}>Select Operator</button>
                        </form>
                    </div>

                    {/* Both Option */}
                    <div className="card hover-effect" style={{ padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                            <h2 style={{ marginBottom: "1rem", color: "var(--primary)" }}>Both</h2>
                            <p style={{ color: "#888", marginBottom: "2rem" }}>
                                Operate a league and participate as a player.
                                <br /><span style={{ fontSize: "0.8rem", color: "var(--warning)" }}>(Requires Admin Approval)</span>
                            </p>
                        </div>
                        <form action={async () => {
                            'use server';
                            await updateUserRole('both');
                        }}>
                            <button className="btn btn-primary" style={{ width: "100%" }}>Select Both</button>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    );
}
