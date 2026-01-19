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

    const getBadgeStyle = (s: string) => {
        switch (s) {
            case 'paid': return 'bg-[#22c55e]/20 text-[#4ade80] border-[#22c55e]/30';
            case 'unpaid': return 'bg-error/20 text-[#ef4444] border-[#ef4444]/50';
            case 'waived': return 'bg-[#D4AF37]/10 !text-[#D4AF37] !border-[#D4AF37]/50';
            default: return 'bg-[#D4AF37]/10 border-[#D4AF37]/50';
        }
    };

    return (
        <div className="relative inline-block">
            {/* Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${getBadgeStyle(status)}`}
                style={(status === 'waived' || !['paid', 'unpaid'].includes(status)) ? { color: '#D4AF37', borderColor: '#D4AF37' } : {}}
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
