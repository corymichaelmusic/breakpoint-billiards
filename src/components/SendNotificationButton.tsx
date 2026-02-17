'use client';

import { useState } from 'react';
import SendNotificationModal from './SendNotificationModal';

interface SendNotificationButtonProps {
    sessionId: string;
}

export default function SendNotificationButton({ sessionId }: SendNotificationButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn w-full bg-surface border border-border text-center block hover:bg-surface-hover transition-all"
                style={{ color: '#D4AF37', marginTop: '0.5rem' }}
            >
                📢 Send Announcement
            </button>
            <SendNotificationModal
                sessionId={sessionId}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
}
