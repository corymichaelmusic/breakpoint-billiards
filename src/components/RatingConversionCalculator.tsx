'use client';

import { useState } from 'react';

export default function RatingConversionCalculator() {
    const [fargo, setFargo] = useState<string>('');
    const [breakpoint, setBreakpoint] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const calculate = (val: string) => {
        setFargo(val);
        const f = parseInt(val);
        if (!isNaN(f)) {
            // Factor 1.25
            setBreakpoint(Math.round(f * 1.25));
        } else {
            setBreakpoint(null);
        }
    };

    return (
        <div className="bg-black/40 border border-[#D4AF37]/30 rounded-lg p-4 mb-6 backdrop-blur-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 !text-[#D4AF37] font-bold text-sm uppercase tracking-wide w-full"
                style={{ color: '#D4AF37' }}
            >
                <span className="text-xl">{isOpen ? '−' : '+'}</span>
                rating conversion calculator (Fargo → Breakpoint)
            </button>

            {isOpen && (
                <div className="mt-4 flex flex-col md:flex-row gap-6 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1 uppercase">Enter Fargo Rating</label>
                        <input
                            type="number"
                            value={fargo}
                            onChange={(e) => calculate(e.target.value)}
                            placeholder="e.g. 500"
                            className="w-full !bg-[#222] border border-white/20 rounded p-2 !text-white font-mono text-lg focus:border-[#D4AF37] outline-none transition-colors placeholder:text-gray-500"
                            style={{ color: 'white', backgroundColor: '#222222' }}
                        />
                    </div>

                    <div className="text-center pb-2 text-gray-500 font-bold text-xl">
                        →
                    </div>

                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1 uppercase">Breakpoint Rating</label>
                        <div className="w-full bg-[#D4AF37]/10 border border-[#D4AF37] rounded p-2 text-[#D4AF37] font-mono text-lg font-bold">
                            {breakpoint !== null ? breakpoint : '-'}
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 max-w-[200px] leading-tight pb-1">
                        * Multiplies Fargo by 1.25 to map 800 (Pro) to 1000 (Breakpoint Max).
                    </div>
                </div>
            )}
        </div>
    );
}
