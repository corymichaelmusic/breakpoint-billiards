'use client';

import { useState } from 'react';
import { requestUnlock } from '@/app/actions/match-actions';

interface Props {
    matchId: string;
    isLocked: boolean;
    hasPendingRequest?: boolean;
}

export default function RequestUnlockButton({ matchId, isLocked, hasPendingRequest = false }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleRequestUnlock = async () => {
        if (!confirm("Request an unlock from the operator?")) return;
        setIsSubmitting(true);
        const res = await requestUnlock(matchId, "Player requested manual unlock");
        setIsSubmitting(false);

        if (res?.error) {
            alert(res.error);
            setStatus('error');
        } else {
            alert("Unlock request sent to operator.");
            setStatus('success');
        }
    };

    if (hasPendingRequest || status === 'success') {
        return (
            <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontStyle: 'italic' }}>
                Request Pending
            </span>
        );
    }

    // Only show button if locked
    if (!isLocked) return null;

    return (
        <button
            onClick={handleRequestUnlock}
            disabled={isSubmitting}
            className="btn-link"
            style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                opacity: isSubmitting ? 0.5 : 1
            }}
        >
            {isSubmitting ? 'Requesting...' : 'Request Unlock'}
        </button>
    );
}
