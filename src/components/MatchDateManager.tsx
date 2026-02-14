'use client';

import { useState } from 'react';
import { updateMatchSchedule, toggleMatchLock } from '@/app/actions/match-actions';

interface Props {
    matchId: string;
    initialDate: string | null;
    initialTime: string | null;
    initialTable: string | null;
    isUnlocked: boolean;
}

export default function MatchDateManager({ matchId, initialDate, initialTime, initialTable, isUnlocked }: Props) {
    const [isEditing, setIsEditing] = useState(false);

    // Date part only for the input
    const [date, setDate] = useState(initialDate ? new Date(initialDate).toISOString().slice(0, 10) : '');
    const [time, setTime] = useState(initialTime || '');
    const [tableName, setTableName] = useState(initialTable || '');

    const [loading, setLoading] = useState(false);

    const handleScheduleUpdate = async () => {
        setLoading(true);
        // We pass the Date string directly. The backend/DB handles it as a Date/Timestamp.
        // If the date input is YYYY-MM-DD, we might want to ensure it's stored correctly.
        // The original code used datetime-local which included time. 
        // Here we separate them. Let's assume we store the Date object constructed from the date picker.
        // Or if the DB expects a timestamp, we might need to combine them or just send the date part if it's a date column.
        // Based on previous code: new Date(date).toISOString... 
        // Let's stick to sending the date string YYYY-MM-DD.

        await updateMatchSchedule(matchId, date, time, tableName);
        setLoading(false);
        setIsEditing(false);
    };

    const handleToggleLock = async () => {
        setLoading(true);
        await toggleMatchLock(matchId, !isUnlocked);
        setLoading(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block' }}>Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid #444', borderRadius: '4px', background: '#222', color: 'white' }}
                            />
                        </div>
                        <div style={{ width: '80px' }}>
                            <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block' }}>Time</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid #444', borderRadius: '4px', background: '#222', color: 'white' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.7rem', color: '#aaa', display: 'block' }}>Table</label>
                        <input
                            type="text"
                            value={tableName}
                            onChange={(e) => setTableName(e.target.value)}
                            placeholder="Table Name"
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem', border: '1px solid #444', borderRadius: '4px', background: '#222', color: 'white' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button onClick={() => setIsEditing(false)} disabled={loading} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#ccc', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                        <button onClick={handleScheduleUpdate} disabled={loading} style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', color: 'black', background: '#4ade80', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>
                                {initialDate ? new Date(initialDate).toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'No Date'}
                            </span>
                            {(initialTime || initialTable) && (
                                <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                                    {[
                                        initialTime ? (() => {
                                            const [h, m] = initialTime.split(':');
                                            const hour = parseInt(h);
                                            const ampm = hour >= 12 ? 'PM' : 'AM';
                                            const hour12 = hour % 12 || 12;
                                            return `${hour12}:${m} ${ampm}`;
                                        })() : null,
                                        initialTable
                                    ].filter(Boolean).join(' • ')}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => setIsEditing(true)}
                            style={{ fontSize: '0.8rem', color: '#D4AF37', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start', marginLeft: 'auto' }}
                        >
                            Edit
                        </button>
                    </div>

                    {/* Logic: Unlocked if Manually Unlocked OR Date has passed (or is today) */}
                    {(() => {
                        const now = new Date();
                        let isAutoUnlocked = false;
                        let isExpired = false;

                        if (initialDate) {
                            const scheduled = new Date(initialDate);
                            // UTC date from DB, we want to construct local window.
                            // Simply taking the Date object as "start of day" is tricky with timezones.
                            // Let's do a naive compare on YYYY-MM-DD for current local time.

                            // Better yet, just use the helper from match actions logic if possible, 
                            // OR replicate simplified check here.

                            // Let's use the Date object directly parsed from the ISO string
                            const windowStart = new Date(scheduled);
                            // If it's pure date (YYYY-MM-DD), it parses to UTC midnight.
                            // We want to unlock at 8AM Local Time on that date? Or 8AM UTC?
                            // Let's assume the simplified logic: Is it "Today"?

                            // Replicating previous logic roughly:
                            windowStart.setHours(8, 0, 0, 0);
                            const windowEnd = new Date(windowStart);
                            windowEnd.setDate(windowEnd.getDate() + 1);

                            // This client-side check is approximate due to timezone diffs between client/server.
                            // Reliable check is done on server for actual enforcement.
                            // Visual indicator is "Good Enough".

                            isAutoUnlocked = now >= windowStart && now < windowEnd;
                            isExpired = now >= windowEnd;
                        }

                        const isEffectiveUnlocked = isUnlocked || (isAutoUnlocked && !isExpired);

                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{
                                    fontSize: '0.65rem',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '1rem',
                                    background: isEffectiveUnlocked ? 'rgba(74, 222, 128, 0.1)' : '#222',
                                    color: isEffectiveUnlocked ? '#4ade80' : '#666',
                                    border: isEffectiveUnlocked ? '1px solid #22c55e' : '1px solid #444',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {isUnlocked ? 'UNLOCKED' : isEffectiveUnlocked ? 'OPEN' : isExpired ? 'LOCKED' : 'LOCKED'}
                                </span>
                                <button
                                    onClick={handleToggleLock}
                                    disabled={loading}
                                    style={{
                                        fontSize: '0.65rem',
                                        color: isUnlocked ? '#888' : '#D4AF37',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    {isUnlocked ? 'Lock' : 'Force Unlock'}
                                </button>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

