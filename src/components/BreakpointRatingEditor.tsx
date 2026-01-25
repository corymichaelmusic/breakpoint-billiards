'use client';

import { useState } from "react";
import { updatePlayerBreakpointRating } from "@/app/actions/operator-actions";

interface BreakpointRatingEditorProps {
    leagueId: string;
    playerId: string;
    currentRating: number | null;
}

export default function BreakpointRatingEditor({ leagueId, playerId, currentRating }: BreakpointRatingEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempRating, setTempRating] = useState(currentRating ? String(currentRating) : "");
    const [displayRating, setDisplayRating] = useState(currentRating);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        const rating = parseFloat(tempRating);
        if (isNaN(rating)) {
            alert("Please enter a valid number.");
            return;
        }

        // Clamp? Maybe 0-1000 check?
        if (rating < 0 || rating > 1200) { // Allow slight overage for edge cases but generally warn
            if (!confirm("Rating is outside typical 0-1000 range. Continue?")) return;
        }

        setIsLoading(true);
        try {
            const result = await updatePlayerBreakpointRating(leagueId, playerId, rating);
            if (result.error) {
                alert(result.error);
            } else {
                setDisplayRating(rating);
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
                    value={tempRating}
                    onChange={(e) => setTempRating(e.target.value)}
                    className="bg-black/20 border border-white/20 rounded px-2 py-1 w-20 text-white text-sm"
                    autoFocus
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="btn !bg-green-600 hover:!bg-green-500 !text-white px-3 py-1 text-xs font-bold rounded shadow-md"
                >
                    Save
                </button>
                <button
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading}
                    className="btn bg-transparent border border-white hover:bg-white/20 !text-white px-3 py-1 text-xs rounded shadow-md"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="text-white font-bold text-lg w-12 text-right">
                {displayRating !== null && displayRating !== undefined ? (Math.round(displayRating * 10) / 10).toFixed(0) : 'N/A'}
            </span>
            <button
                onClick={() => setIsEditing(true)}
                className="!bg-[#D4AF37] hover:!bg-[#c4a030] !text-black text-xs font-bold rounded px-2 py-1 ml-2 transition-colors"
                style={{ color: 'black', backgroundColor: '#D4AF37' }}
            >
                Edit
            </button>
        </div>
    );
}
