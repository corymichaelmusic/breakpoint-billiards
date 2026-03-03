'use client';

import { useState } from 'react';
import SendNotificationModal from './SendNotificationModal';

interface SendNotificationButtonProps {
    sessionId: string;
    notificationPlayers?: { id: string; full_name: string; is_enrolled: boolean }[];
}

export default function SendNotificationButton({ sessionId, notificationPlayers = [] }: SendNotificationButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const totalPlayers = notificationPlayers.length;
    const enrolledCount = notificationPlayers.filter(p => p.is_enrolled).length;

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

            {totalPlayers > 0 ? (
                <div className="bg-surface/30 rounded-lg overflow-hidden border border-border">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex justify-between items-center px-4 py-2 text-xs hover:bg-white/5 transition-colors focus:outline-none bg-transparent border-0"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
                            <span className="font-semibold" style={{ color: '#4ade80' }}>
                                {enrolledCount}/{totalPlayers} Players Enrolled in Notifications
                            </span>
                        </div>
                        <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isExpanded && (
                        <div className="px-4 py-3 border-t border-white/5 bg-black/20">
                            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {notificationPlayers.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((player) => (
                                    <li key={player.id} className="text-xs flex items-center gap-2">
                                        {player.is_enrolled ? (
                                            <>
                                                <span className="text-[#4ade80]">✓</span>
                                                <span className="text-gray-200">{player.full_name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-red-400 opacity-70">✕</span>
                                                <span className="text-gray-500 line-through opacity-70">{player.full_name}</span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center px-4 py-2 text-xs text-gray-500">
                    No players in this session yet.
                </div>
            )}
        </div>
    );
}
