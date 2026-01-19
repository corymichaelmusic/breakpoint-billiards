'use client';

import { useState } from "react";
import { updateSessionFeeStatus } from "@/app/actions/admin-actions";

interface SessionFeeToggleProps {
    sessionId: string;
    initialStatus: string;
}

export default function SessionFeeToggle({ sessionId, initialStatus }: SessionFeeToggleProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState(initialStatus);

    const handleSelect = async (newStatus: 'paid' | 'unpaid' | 'waived') => {
        setIsOpen(false);
        if (newStatus === status) return;

        // Optimistic update
        const oldStatus = status;
        setStatus(newStatus);

        const result = await updateSessionFeeStatus(sessionId, newStatus);
        if (result.error) {
            alert(result.error);
            setStatus(oldStatus);
        }
    };

    const getInlineStyle = (s: string): React.CSSProperties => {
        switch (s) {
            case 'paid': return { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderColor: 'rgba(34, 197, 94, 0.3)' };
            case 'unpaid': return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.5)' };
            case 'waived': return { backgroundColor: 'rgba(212, 175, 55, 0.1)', color: '#D4AF37', borderColor: 'rgba(212, 175, 55, 0.5)' };
            default: return { backgroundColor: 'rgba(212, 175, 55, 0.1)', color: '#D4AF37', borderColor: 'rgba(212, 175, 55, 0.5)' };
        }
    };

    return (
        <div className="relative inline-block">
            {/* Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity"
                style={getInlineStyle(status)}
            >
                Fee: {status || 'unpaid'}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 z-50 bg-[#121212] border border-white/10 rounded shadow-xl overflow-hidden min-w-[100px] flex flex-col">
                        <button
                            onClick={() => handleSelect('paid')}
                            className="px-3 py-2 text-left text-xs !text-[#4ade80] hover:bg-white/5 uppercase font-bold"
                            style={{ color: '#4ade80' }}
                        >
                            Paid
                        </button>
                        <button
                            onClick={() => handleSelect('unpaid')}
                            className="px-3 py-2 text-left text-xs !text-[#ef4444] hover:bg-white/5 uppercase font-bold"
                            style={{ color: '#ef4444' }}
                        >
                            Unpaid
                        </button>
                        <button
                            onClick={() => handleSelect('waived')}
                            className="px-3 py-2 text-left text-xs !text-[#D4AF37] hover:bg-white/5 uppercase font-bold"
                            style={{ color: '#D4AF37' }}
                        >
                            Waived
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
