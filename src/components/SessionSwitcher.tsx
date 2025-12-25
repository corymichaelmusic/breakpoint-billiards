'use client';

import { useRouter, useSearchParams } from "next/navigation";

interface Session {
    league_id: string;
    leagues: {
        name: string;
    };
}

export default function SessionSwitcher({ sessions, currentSessionId }: { sessions: Session[], currentSessionId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSessionId = e.target.value;
        const params = new URLSearchParams(searchParams);
        params.set('sessionId', newSessionId);
        router.push(`/dashboard?${params.toString()}`);
    };

    if (!sessions || sessions.length <= 1) return null;

    return (
        <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.9rem", color: "#888", marginRight: "0.5rem" }}>Switch Session:</label>
            <select
                value={currentSessionId}
                onChange={handleChange}
                style={{
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)"
                }}
            >
                {sessions.map(session => (
                    <option key={session.league_id} value={session.league_id}>
                        {session.leagues.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
