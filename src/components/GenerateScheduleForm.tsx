"use client";

import { useState } from "react";
import { generateSchedule, updateLeague } from "@/app/actions/league-actions";

interface GenerateScheduleFormProps {
    leagueId: string;
    initialStartDate?: string;
    initialTimezone?: string;
    creationFeeStatus: string;
    parentLeagueId: string;
}

export default function GenerateScheduleForm({
    leagueId,
    initialStartDate,
    initialTimezone,
    creationFeeStatus,
    parentLeagueId
}: GenerateScheduleFormProps) {
    const [startDate, setStartDate] = useState(initialStartDate || "");
    const [timezone, setTimezone] = useState(initialTimezone || "America/Chicago");
    const [skipDates, setSkipDates] = useState<string[]>([]);
    const [newSkipDate, setNewSkipDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddSkipDate = () => {
        if (!newSkipDate) return;
        if (skipDates.includes(newSkipDate)) return;

        // Sort dates chronologically
        const newDates = [...skipDates, newSkipDate].sort();
        setSkipDates(newDates);
        setNewSkipDate("");
    };

    const handleRemoveSkipDate = (dateToRemove: string) => {
        setSkipDates(skipDates.filter(d => d !== dateToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Update League Settings (Start Date / Timezone)
            if (startDate || timezone) {
                await updateLeague(leagueId, {
                    ...(startDate && { start_date: startDate }),
                    ...(timezone && { timezone })
                });
            }

            // 2. Generate Schedule with Skip Dates
            const res = await generateSchedule(leagueId, skipDates);

            if (res?.error) {
                if (res.error === 'NOT_ENOUGH_PLAYERS') {
                    // Redirect logic handled by component consumer or we can redirect here
                    // Since this is a client component, we use window.location or router
                    // But the original code had a server-side redirect. 
                    // Let's just show the error for now or handle client-side redirect.
                    window.location.href = `/dashboard/operator/leagues/${parentLeagueId}/sessions/${leagueId}/add-players`;
                    return;
                }
                setError(res.error);
            }
        } catch (err) {
            setError("An unexpected error occurred.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-surface/30 p-4 rounded border border-border">
            {error && (
                <div className="bg-error/10 border border-error text-error text-sm p-2 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-xs text-gray-400">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="input w-full text-sm bg-black/50 border-gray-700"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-gray-400">Timezone</label>
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="input w-full text-sm bg-black/50 border-gray-700"
                    >
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    </select>
                </div>
            </div>

            {/* Skip Dates Section */}
            <div className="mb-6 border-t border-gray-800 pt-4">
                <label className="text-xs font-bold mb-2 block" style={{ color: '#D4AF37' }}>Skip Weeks (Holidays/No-Play)</label>
                <div className="flex gap-2 mb-2">
                    <input
                        type="date"
                        value={newSkipDate}
                        onChange={(e) => setNewSkipDate(e.target.value)}
                        className="input flex-1 text-sm bg-black/50 border-gray-700"
                    />
                    <button
                        type="button"
                        onClick={handleAddSkipDate}
                        className="btn bg-surface border border-border hover:bg-surface-hover text-xs px-3"
                        style={{ color: '#D4AF37' }}
                    >
                        Add Skip Date
                    </button>
                </div>

                {skipDates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {skipDates.map((date) => (
                            <span key={date} className="bg-black/40 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded flex items-center gap-2">
                                {new Date(date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSkipDate(date)}
                                    className="text-gray-500 hover:text-error"
                                >
                                    &times;
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                    Add specific dates where matches normally fall but should be skipped (e.g., if you play on Tuesdays, add the specific Tuesday date to skip).
                    Matches will resume the following week, extending the season.
                </p>
            </div>

            <button
                type="submit"
                disabled={creationFeeStatus === 'unpaid' || loading}
                className={`btn w-full ${creationFeeStatus === 'unpaid' ? 'bg-gray-700 cursor-not-allowed' : 'btn-primary'} flex justify-center items-center gap-2`}
                style={creationFeeStatus === 'unpaid' ? { color: '#D4AF37' } : {}}
            >
                {loading && <span className="animate-spin h-3 w-3 border-2 border-black border-t-transparent rounded-full" />}
                {creationFeeStatus === 'unpaid' ? 'Pay Fee to Generate Schedule' : 'Generate Schedule'}
            </button>
        </form>
    );
}
