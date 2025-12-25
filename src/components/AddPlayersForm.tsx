'use client';

import { syncSessionPlayers } from "@/app/actions/league-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Player = {
    id: string;
    name: string;
    email: string;
};

export default function AddPlayersForm({ sessionId, players, initialSelected = [] }: { sessionId: string, players: Player[], initialSelected?: string[] }) {
    const router = useRouter();
    const [selected, setSelected] = useState<string[]>(initialSelected);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const togglePlayer = (id: string) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(pid => pid !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const handleSelectAll = () => {
        if (selected.length === players.length) {
            setSelected([]);
        } else {
            setSelected(players.map(p => p.id));
        }
    };

    async function handleSubmit() {
        setLoading(true);
        setError("");

        const res = await syncSessionPlayers(sessionId, selected);

        if (res?.error) {
            setError(res.error);
            setLoading(false);
        } else {
            router.push(`/dashboard/operator/leagues/${sessionId}`);
            router.refresh();
        }
    }

    return (
        <div>
            {error && (
                <div style={{ padding: "1rem", background: "rgba(255,0,0,0.1)", color: "var(--error)", borderRadius: "0.5rem", marginBottom: "1rem" }}>
                    {error}
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <button type="button" onClick={handleSelectAll} className="btn" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    {selected.length === players.length ? "Deselect All" : "Select All"}
                </button>
                <div style={{ alignSelf: "center", color: "#888" }}>
                    {selected.length} selected
                </div>
            </div>

            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "0.5rem", marginBottom: "2rem" }}>
                {players.map(player => (
                    <div
                        key={player.id}
                        onClick={() => togglePlayer(player.id)}
                        style={{
                            padding: "1rem",
                            borderBottom: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            cursor: "pointer",
                            background: selected.includes(player.id) ? "rgba(255, 255, 255, 0.05)" : "transparent"
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(player.id)}
                            onChange={() => { }} // Handled by div click
                            style={{ width: "1.2rem", height: "1.2rem" }}
                        />
                        <div>
                            <div style={{ fontWeight: "bold" }}>{player.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "#888" }}>{player.email}</div>
                        </div>
                    </div>
                ))}
                {players.length === 0 && (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                        No players found in your organization.
                    </div>
                )}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
                <button
                    onClick={handleSubmit}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                    onClick={() => router.push(`/dashboard/operator/leagues/${sessionId}`)}
                    className="btn"
                    style={{ background: "transparent", border: "1px solid var(--border)" }}
                    disabled={loading}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
