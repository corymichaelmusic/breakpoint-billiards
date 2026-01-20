'use client';

import { useState } from "react";
import { updatePlayerFargo } from "@/app/actions/operator-actions";

interface FargoEditorProps {
    playerId: string;
    currentFargo: number | null;
}

export default function FargoEditor({ playerId, currentFargo }: FargoEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempFargo, setTempFargo] = useState(currentFargo ? String(currentFargo) : "");
    const [displayFargo, setDisplayFargo] = useState(currentFargo);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        const rating = parseInt(tempFargo);
        if (isNaN(rating)) {
            alert("Please enter a valid number.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await updatePlayerFargo(playerId, rating);
            if (result.error) {
                alert(result.error);
            } else {
                setDisplayFargo(rating);
                setIsEditing(false);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isEditing) {
        return (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                    type="number"
                    value={tempFargo}
                    onChange={(e) => setTempFargo(e.target.value)}
                    style={{
                        padding: "0.25rem",
                        borderRadius: "0.25rem",
                        border: "1px solid var(--border)",
                        width: "80px",
                        background: "var(--background)",
                        color: "var(--foreground)"
                    }}
                    autoFocus
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="btn"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "var(--success)", color: "#000" }}
                >
                    Save
                </button>
                <button
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading}
                    className="btn"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white" }}>{displayFargo || 'N/A'}</span>
            <button
                onClick={() => setIsEditing(true)}
                className="btn"
                style={{ padding: "0.1rem 0.4rem", fontSize: "0.7rem", border: "1px solid #D4AF37", background: "transparent", color: "#D4AF37" }}
            >
                Edit
            </button>
        </div>
    );
}
