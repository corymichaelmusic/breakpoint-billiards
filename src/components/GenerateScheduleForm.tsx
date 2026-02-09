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
    const [useTimeSlots, setUseTimeSlots] = useState(false);
    // Initialize with 2 slots defaulting to 7:00 PM (19:00)
    const [timeSlots, setTimeSlots] = useState<string[]>(["19:00", "19:00"]);
    const [useTables, setUseTables] = useState(false);
    const [tableNames, setTableNames] = useState<string[]>(["", ""]);
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

            // 2. Generate Schedule with Skip Dates and Config
            const timeSlotsArray = useTimeSlots ? timeSlots.map(s => s.trim()).filter(s => s) : [];
            const tableNamesArray = useTables ? tableNames.map(s => s.trim()).filter(s => s) : [];

            // Pass startDate to ensure we use the client-side value even if updateLeague hasn't propagated
            const res = await generateSchedule(leagueId, skipDates, timeSlotsArray, tableNamesArray, startDate);

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
                <div className="bg-red-900/20 border border-red-500 text-red-500 text-sm p-2 rounded mb-4 font-bold">
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
                        style={{ colorScheme: 'dark', accentColor: '#D4AF37' }}
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
                        style={{ colorScheme: 'dark', accentColor: '#D4AF37' }}
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

            {/* Session Config Section */}
            <div className="mb-6 border-t border-gray-800 pt-4">
                <h3 className="text-xs font-bold mb-4" style={{ color: '#D4AF37' }}>Session Configuration</h3>

                <div className="space-y-6">
                    {/* Time Slots */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="useTimeSlots"
                                checked={useTimeSlots}
                                onChange={(e) => setUseTimeSlots(e.target.checked)}
                                className="accent-[#D4AF37]"
                            />
                            <label htmlFor="useTimeSlots" className="text-sm font-bold text-gray-300 select-none cursor-pointer">
                                Configure Time Slots
                            </label>
                        </div>

                        {useTimeSlots && (
                            <div className="pl-6 space-y-2">
                                <p className="text-[10px] text-gray-500 mb-2">Select start times for matches.</p>
                                {timeSlots.map((slot, index) => {
                                    // Parse HH:MM (24h) to separate components
                                    // Default to 19:00 if empty or invalid
                                    let [h, m] = (slot || "19:00").split(':').map(Number);
                                    if (isNaN(h)) h = 19;
                                    if (isNaN(m)) m = 0;

                                    const period = h >= 12 ? 'PM' : 'AM';
                                    const displayH = h % 12 || 12; // Convert 0 -> 12, 13 -> 1, etc.
                                    const displayM = m.toString().padStart(2, '0');

                                    const updateSlot = (newH: number, newM: number, newPeriod: string) => {
                                        let finalH = newH;
                                        if (newPeriod === 'PM' && newH !== 12) finalH += 12;
                                        if (newPeriod === 'AM' && newH === 12) finalH = 0;

                                        const finalSlot = `${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
                                        const newSlots = [...timeSlots];
                                        newSlots[index] = finalSlot;
                                        setTimeSlots(newSlots);
                                    };

                                    return (
                                        <div key={index} className="flex gap-2 items-center">
                                            {/* Hour */}
                                            <select
                                                value={displayH}
                                                onChange={(e) => updateSlot(parseInt(e.target.value), m, period)}
                                                className="input w-20 text-sm bg-black/50 border-gray-700 p-2"
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-400">:</span>
                                            {/* Minute */}
                                            <select
                                                value={displayM}
                                                onChange={(e) => updateSlot(displayH, parseInt(e.target.value), period)}
                                                className="input w-20 text-sm bg-black/50 border-gray-700 p-2"
                                            >
                                                {['00', '15', '30', '45'].map(min => (
                                                    <option key={min} value={min}>{min}</option>
                                                ))}
                                            </select>
                                            {/* Period */}
                                            <select
                                                value={period}
                                                onChange={(e) => updateSlot(displayH, m, e.target.value)}
                                                className="input w-20 text-sm bg-black/50 border-gray-700 p-2"
                                            >
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newSlots = timeSlots.filter((_, i) => i !== index);
                                                    setTimeSlots(newSlots);
                                                }}
                                                className="px-2 font-bold hover:opacity-80 transition-opacity"
                                                style={{ color: '#ef4444' }} // Force Tailwind red-500
                                                aria-label="Remove time slot"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setTimeSlots([...timeSlots, "19:00"])}
                                    className="btn btn-sm mt-4 border-none text-black font-bold flex items-center gap-2 hover:opacity-90"
                                    style={{ backgroundColor: '#D4AF37' }}
                                >
                                    + Add Time Slot
                                </button>
                                {/* Spacer */}
                                <div className="h-4"></div>
                            </div>
                        )}
                    </div>

                    {/* Table Names */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="useTables"
                                checked={useTables}
                                onChange={(e) => setUseTables(e.target.checked)}
                                className="accent-[#D4AF37]"
                            />
                            <label htmlFor="useTables" className="text-sm font-bold text-gray-300 select-none cursor-pointer">
                                Configure Tables
                            </label>
                        </div>

                        {useTables && (
                            <div className="pl-6 space-y-2">
                                {tableNames.map((name, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => {
                                                const newTables = [...tableNames];
                                                newTables[index] = e.target.value;
                                                setTableNames(newTables);
                                            }}
                                            placeholder={`Table ${index + 1}`}
                                            className="input flex-1 text-sm bg-black/50 border-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newTables = tableNames.filter((_, i) => i !== index);
                                                setTableNames(newTables);
                                            }}
                                            className="px-2 font-bold hover:opacity-80 transition-opacity"
                                            style={{ color: '#ef4444' }} // Force Tailwind red-500
                                            aria-label="Remove table"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setTableNames([...tableNames, ""])}
                                    className="btn btn-sm mt-4 border-none text-black font-bold flex items-center gap-2 hover:opacity-90"
                                    style={{ backgroundColor: '#D4AF37' }}
                                >
                                    + Add Table
                                </button>
                                {/* Spacer */}
                                <div className="h-4"></div>
                            </div>
                        )}
                    </div>
                </div>
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
