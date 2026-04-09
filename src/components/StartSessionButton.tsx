"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startSession } from "@/app/actions/league-actions";

interface StartSessionButtonProps {
    leagueId: string;
    disabled?: boolean;
    disabledLabel: string;
}

export default function StartSessionButton({
    leagueId,
    disabled = false,
    disabledLabel
}: StartSessionButtonProps) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleStart = () => {
        if (disabled || isPending) return;

        const confirmed = window.confirm(
            "Start this session now? Once started, the session schedule will be live for players."
        );

        if (!confirmed) return;

        const doubleConfirmed = window.confirm(
            "Please confirm again: do you want to make this session live right now?"
        );

        if (!doubleConfirmed) return;

        setError(null);

        startTransition(async () => {
            const res = await startSession(leagueId);

            if (res?.error) {
                setError(res.error);
                window.alert(`Error: ${res.error}`);
                return;
            }

            router.refresh();
        });
    };

    return (
        <div className="space-y-2">
            {error && (
                <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-500/10">
                    {error}
                </div>
            )}
            <button
                type="button"
                onClick={handleStart}
                disabled={disabled || isPending}
                className={`btn w-full ${disabled || isPending ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}`}
                style={!(disabled || isPending) ? { backgroundColor: '#22c55e', color: 'black' } : {}}
            >
                {isPending ? "Starting Session..." : disabledLabel}
            </button>
        </div>
    );
}
