'use client';

import { useState } from 'react';
import { updateMatchDate, toggleMatchLock } from '@/app/actions/match-actions';

interface Props {
    matchId: string;
    initialDate: string | null;
    isUnlocked: boolean;
}

export default function MatchDateManager({ matchId, initialDate, isUnlocked }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [date, setDate] = useState(initialDate ? new Date(initialDate).toISOString().slice(0, 16) : '');
    const [loading, setLoading] = useState(false);

    const handleDateUpdate = async () => {
        setLoading(true);
        await updateMatchDate(matchId, date);
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ padding: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '4px' }}
                    />
                    <button onClick={handleDateUpdate} disabled={loading} style={{ fontSize: '0.8rem', color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Save
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={loading} style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        X
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>
                        {initialDate ? new Date(initialDate).toLocaleDateString() : 'No Date'}
                    </span>
                    <button
                        onClick={() => setIsEditing(true)}
                        style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Edit
                    </button>
                </div>
            )}



            {/* Logic: Unlocked if Manually Unlocked OR Date has passed (or is today) */}
            {(() => {
                const now = new Date();
                let isAutoUnlocked = false;
                let isExpired = false;

                if (initialDate) {
                    // Window: 8AM on scheduled date -> 8AM next day
                    // Assuming initialDate is ISO string from DB (e.g., UTC).
                    // We need to treat it as "Local Date" 8 AM.
                    // The simplest way given likely data format (YYYY-MM-DD):

                    const scheduled = new Date(initialDate);

                    // Construct 8 AM Window Start (Locally)
                    // If initialDate already has time, we might override it, or if it's just date.
                    // Let's ensure we target the *Day* at 08:00.
                    const windowStart = new Date(scheduled);
                    windowStart.setHours(8, 0, 0, 0);

                    // If the original date string was UTC midnight (e.g. 2025-12-15T00:00:00Z), 
                    // converting to local might shift it. 
                    // Let's trust the day/month/year of 'scheduled' object relative to browser context 
                    // OR specifically parse the YYYY-MM-DD string part.
                    // Best effort:

                    const windowEnd = new Date(windowStart);
                    windowEnd.setDate(windowEnd.getDate() + 1); // +24 hours

                    isAutoUnlocked = now >= windowStart && now < windowEnd;
                    isExpired = now >= windowEnd;
                }

                const isEffectiveUnlocked = isUnlocked || (isAutoUnlocked && !isExpired);

                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '1rem',
                            background: isEffectiveUnlocked ? 'rgba(34, 197, 94, 0.1)' : '#333',
                            color: isEffectiveUnlocked ? 'var(--success)' : '#888',
                            border: isEffectiveUnlocked ? '1px solid var(--success)' : '1px solid var(--border)'
                        }}>
                            {isUnlocked ? 'MANUALLY UNLOCKED' : isEffectiveUnlocked ? 'OPEN (TIME)' : isExpired ? 'LOCKED (EXPIRED)' : 'LOCKED (FUTURE)'}
                        </span>
                        <button
                            onClick={handleToggleLock}
                            disabled={loading}
                            style={{
                                fontSize: '0.7rem',
                                color: isUnlocked ? '#888' : 'var(--warning)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            {isUnlocked ? 'Re-Lock' : 'Force Unlock'}
                        </button>
                    </div>
                );
            })()}
        </div>
    );
}
