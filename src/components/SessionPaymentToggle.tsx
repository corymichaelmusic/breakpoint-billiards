'use client';

import { useState } from 'react';
import { updateSessionPaymentStatus } from '@/app/actions/league-actions';

export default function SessionPaymentToggle({
    sessionId,
    playerId,
    initialStatus
}: {
    sessionId: string,
    playerId: string,
    initialStatus: string
}) {
    const [status, setStatus] = useState(initialStatus);
    const [loading, setLoading] = useState(false);

    const handleUpdate = async (newStatus: string) => {
        setLoading(true);
        // Optimistic update
        setStatus(newStatus);

        const res = await updateSessionPaymentStatus(sessionId, playerId, newStatus);
        if (res?.error) {
            // Revert on error
            setStatus(initialStatus);
            alert("Failed to update payment status");
        }
        setLoading(false);
    };

    const isPaid = ['paid', 'paid_cash', 'paid_online'].includes(status);
    const isWaived = status === 'waived';
    const isUnpaid = status === 'unpaid';

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.8rem",
                fontWeight: "bold",
                background: isPaid ? "var(--success)" : (isUnpaid ? "var(--error)" : "#888"),
                color: isPaid ? "#000" : "#fff",
                minWidth: "80px",
                textAlign: "center"
            }}>
                {isPaid ? "PAID" : (isUnpaid ? "UNPAID" : "WAIVED")}
            </div>

            <div style={{ display: 'flex', gap: '0.25rem' }}>
                {!isPaid && (
                    <button
                        onClick={() => handleUpdate('paid')}
                        disabled={loading}
                        className="btn"
                        style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.7rem",
                            background: "var(--surface-hover)",
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        Mark Paid
                    </button>
                )}
                {!isUnpaid && (
                    <button
                        onClick={() => handleUpdate('unpaid')}
                        disabled={loading}
                        className="btn"
                        style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.7rem",
                            background: "var(--surface-hover)",
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        Mark Unpaid
                    </button>
                )}
                {!isWaived && (
                    <button
                        onClick={() => handleUpdate('waived')}
                        disabled={loading}
                        className="btn"
                        style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.7rem",
                            background: "var(--surface-hover)",
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        Waive
                    </button>
                )}
            </div>
        </div>
    );
}
