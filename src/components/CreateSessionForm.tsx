'use client';

import { createSession } from "@/app/actions/league-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateSessionForm({ leagueId }: { leagueId: string }) {
    const router = useRouter();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError("");

        const name = formData.get("name") as string;
        const startDate = formData.get("startDate") as string || null;

        const res = await createSession(leagueId, name, startDate);

        if (res?.error) {
            setError(res.error);
            setLoading(false);
        } else if (res?.sessionId) {
            router.push(`/dashboard/operator/leagues/${leagueId}/sessions/${res.sessionId}/pay-fee`);
            router.refresh();
        } else {
            // Fallback if no ID returned (shouldn't happen with updated action)
            router.push("/dashboard/operator");
            router.refresh();
        }
    }

    return (
        <form action={handleSubmit}>
            {error && (
                <div style={{
                    padding: "0.75rem",
                    background: "rgba(255, 0, 0, 0.1)",
                    border: "1px solid var(--error)",
                    color: "var(--error)",
                    borderRadius: "var(--radius)",
                    marginBottom: "1rem"
                }}>
                    {error}
                </div>
            )}
            <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">Session Name</label>
                <input
                    name="name"
                    type="text"
                    placeholder="e.g. Fall 2025"
                    required
                    className="input"
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                    <label className="label">Session Fee</label>
                    <div className="input" style={{ background: "rgba(255,255,255,0.05)", cursor: "not-allowed", opacity: 0.7 }}>
                        $25.00 (Fixed)
                    </div>
                </div>
                <div>
                    <label className="label">Start Date</label>
                    <input
                        name="startDate"
                        type="date"
                        className="input"
                    />
                </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Creating..." : "Create Session"}
            </button>
        </form>
    );
}
