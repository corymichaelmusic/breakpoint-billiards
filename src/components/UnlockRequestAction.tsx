'use client';

import { useState } from 'react';
import { approveRescheduleRequest } from '@/app/actions/match-actions';

interface Props {
    requestId: string;
}

export default function UnlockRequestAction({ requestId }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAction = async (approved: boolean) => {
        if (!confirm(approved ? "Unlocking this match will allow players to play immediately. Confirm?" : "Reject this request?")) return;
        setIsSubmitting(true);
        const res = await approveRescheduleRequest(requestId, approved);
        setIsSubmitting(false);

        if (res?.error) {
            alert(res.error);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
                onClick={() => handleAction(true)}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
                Approve (Unlock)
            </button>
            <button
                onClick={() => handleAction(false)}
                disabled={isSubmitting}
                className="btn"
                style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--error)'
                }}
            >
                Reject
            </button>
        </div>
    );
}
