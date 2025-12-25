'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinSession } from "@/app/actions/league-actions";

interface League {
    id: string;
    name: string;
    sessions: Session[];
}

interface Session {
    id: string;
    name: string;
    status: string;
}

export default function JoinSessionForm({ leagues }: { leagues: League[] }) {
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

    const handleJoin = async () => {
        if (!selectedSessionId) return;
        setLoading(true);
        setError("");

        try {
            const result = await joinSession(selectedSessionId);
            if (result.success) {
                // Show success message and redirect after a delay
                setError(""); // Clear any errors
                alert("Request sent successfully! Redirecting to dashboard...");
                router.push("/dashboard?view=player");
            } else {
                setError(result.message || "Failed to join session");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ padding: "2rem", maxWidth: "500px", margin: "0 auto" }}>
            <h2 style={{ marginBottom: "1.5rem", color: "var(--primary)" }}>Join a Session</h2>

            {error && (
                <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", borderRadius: "var(--radius)", marginBottom: "1rem", border: "1px solid var(--error)" }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">Select League</label>
                <select
                    value={selectedLeagueId}
                    onChange={(e) => {
                        setSelectedLeagueId(e.target.value);
                        setSelectedSessionId(""); // Reset session
                    }}
                    className="input"
                >
                    <option value="">-- Choose a League --</option>
                    {leagues.map(league => (
                        <option key={league.id} value={league.id}>{league.name}</option>
                    ))}
                </select>
            </div>

            {selectedLeague && (
                <div style={{ marginBottom: "2rem" }}>
                    <label className="label">Select Session</label>
                    <select
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        className="input"
                    >
                        <option value="">-- Choose a Session --</option>
                        {selectedLeague.sessions.length > 0 ? (
                            selectedLeague.sessions.map(session => (
                                <option key={session.id} value={session.id}>
                                    {session.name}
                                </option>
                            ))
                        ) : (
                            <option value="" disabled>No upcoming sessions available</option>
                        )}
                    </select>
                </div>
            )}

            <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "1rem" }}
                disabled={!selectedSessionId || loading}
                onClick={handleJoin}
            >
                {loading ? "Joining..." : "Join Session"}
            </button>
        </div>
    );
}
