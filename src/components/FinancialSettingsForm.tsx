'use client';

import { useState } from 'react';
import { updateSystemSetting } from '@/app/actions/admin-actions';

interface FinancialSettingsFormProps {
    sessionFee: string;
    creationFee: string;
    leaderboardLimit: string;
}

export default function FinancialSettingsForm({ sessionFee, creationFee, leaderboardLimit }: FinancialSettingsFormProps) {
    const [loading, setLoading] = useState(false);

    const handleUpdate = async (formData: FormData) => {
        setLoading(true);
        const key = formData.get("key") as string;
        const value = formData.get("value") as string;

        const res = await updateSystemSetting(key, value);

        if (res?.error) {
            alert(res.error);
        } else {
            alert("Setting updated successfully.");
        }
        setLoading(false);
    };

    return (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--primary)" }}>Player Session Fee ($)</h3>
                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "1.5rem" }}>
                    Amount players pay to join a session.
                </p>
                <form action={handleUpdate} style={{ display: "flex", gap: "1rem" }}>
                    <input type="hidden" name="key" value="default_session_fee" />
                    <input
                        name="value"
                        defaultValue={sessionFee}
                        type="number"
                        step="0.01"
                        required
                        className="input"
                        style={{ maxWidth: "120px" }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Update Fee"}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--primary)" }}>Operator Creation Fee ($)</h3>
                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "1.5rem" }}>
                    Amount operators pay to create a session.
                </p>
                <form action={handleUpdate} style={{ display: "flex", gap: "1rem" }}>
                    <input type="hidden" name="key" value="default_creation_fee" />
                    <input
                        name="value"
                        defaultValue={creationFee}
                        type="number"
                        step="0.01"
                        required
                        className="input"
                        style={{ maxWidth: "120px" }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Update Fee"}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "var(--primary)" }}>Leaderboard Limit</h3>
                <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: "1.5rem" }}>
                    Max number of players to show on "View Top X".
                </p>
                <form action={handleUpdate} style={{ display: "flex", gap: "1rem" }}>
                    <input type="hidden" name="key" value="leaderboard_limit" />
                    <input
                        name="value"
                        defaultValue={leaderboardLimit}
                        type="number"
                        min="5"
                        max="100"
                        required
                        className="input"
                        style={{ maxWidth: "120px" }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Update Limit"}
                    </button>
                </form>
            </div>
        </div>
    );
}
