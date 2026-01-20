'use client';

import { resetMatch } from "@/app/actions/league-actions";
import { useState } from "react";

interface ResetMatchButtonProps {
    matchId: string;
    gameType: '8ball' | '9ball';
    isFinalized: boolean;
}

export default function ResetMatchButton({ matchId, gameType, isFinalized }: ResetMatchButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    if (!isFinalized) return null;

    const handleReset = async () => {
        if (!confirm(`Are you sure you want to RESET the ${gameType} results? This will reverse rating changes and stats.`)) {
            return;
        }

        setIsLoading(true);
        try {
            const res = await resetMatch(matchId, gameType);
            if (res?.error) {
                alert(res.error);
            }
        } catch (e) {
            alert("An error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleReset}
            disabled={isLoading}
            className="text-[10px] text-error border border-error/50 px-1 rounded hover:bg-error hover:text-white transition-colors disabled:opacity-50"
            title={`Reset ${gameType} results`}
        >
            {isLoading ? "..." : "Reset"}
        </button>
    );
}
