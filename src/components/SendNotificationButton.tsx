'use client';

import { useState } from 'react';
import SendNotificationModal from './SendNotificationModal';

interface SendNotificationButtonProps {
    sessionId: string;
    enrolledPlayers?: { id: string; full_name: string }[];
}

export default function SendNotificationButton({ sessionId, enrolledPlayers = [] }: SendNotificationButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="space-y-2 relative">
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

            {enrolledPlayers.length > 0 ? (
                <div className="bg-surface/30 rounded-lg overflow-hidden border border-border">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex justify-between items-center px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span>{enrolledPlayers.length} {enrolledPlayers.length === 1 ? 'Player' : 'Players'} Enrolled in Push Notifications</span>
                        </div>
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-white/5 bg-black/20">
                            <ul className="space-y-1">
                                {enrolledPlayers.map((player) => (
                                    <li key={player.id} className="text-xs text-gray-300 flex items-center gap-2">
                                        <span className="text-green-500/70">✓</span>
                                        {player.full_name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center px-4 py-2 text-xs text-gray-500">
                    No players enrolled in push notifications for this session yet.
                </div>
            )}
        </div>
    );
}
