'use client';

import { createSession } from "@/app/actions/league-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateSessionForm({
    leagueId,
    defaultBounties = { bounty8Run: 0, bounty9Run: 0, bounty9Snap: 0, bountyShutout: 0 }
}: {
    leagueId: string,
    defaultBounties?: {
        bounty8Run: number,
        bounty9Run: number,
        bounty9Snap: number,
        bountyShutout: number
    }
}) {
    const router = useRouter();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        setError("");

        const name = formData.get("name") as string;
        const startDate = formData.get("startDate") as string || null;

        const bounties = {
            bounty8Run: Number(formData.get("bounty8Run") || 0),
            bounty9Run: Number(formData.get("bounty9Run") || 0),
            bounty9Snap: Number(formData.get("bounty9Snap") || 0),
            bountyShutout: Number(formData.get("bountyShutout") || 0)
        };

        const res = await createSession(leagueId, name, startDate, bounties);

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
                        style={{ colorScheme: 'dark', accentColor: '#D4AF37' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
                <h3 className="text-white font-bold mb-4" style={{ color: "#D4AF37" }}>Bounty Configuration</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                        <label className="label">8-Ball Break & Run ($)</label>
                        <input
                            name="bounty8Run"
                            type="number"
                            defaultValue={defaultBounties.bounty8Run}
                            min="0"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">9-Ball Break & Run ($)</label>
                        <input
                            name="bounty9Run"
                            type="number"
                            defaultValue={defaultBounties.bounty9Run}
                            min="0"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">9-Ball On the Snap ($)</label>
                        <input
                            name="bounty9Snap"
                            type="number"
                            defaultValue={defaultBounties.bounty9Snap}
                            min="0"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">Shutout ($)</label>
                        <input
                            name="bountyShutout"
                            type="number"
                            defaultValue={defaultBounties.bountyShutout}
                            min="0"
                            className="input"
                        />
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Default values are loaded from the parent league organization settings.
                </p>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Creating..." : "Create Session"}
            </button>
        </form>
    );
}
