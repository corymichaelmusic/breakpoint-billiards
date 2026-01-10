
'use client';

import { useTransition, useState } from "react";
import { submitPreregistration } from "@/app/actions/prereg-actions";

export default function PreregistrationForm() {
    const [isPending, startTransition] = useTransition();
    const [state, setState] = useState<{ message?: string; error?: string; success?: boolean }>({});

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await submitPreregistration({}, formData);
            setState(result);
        });
    };

    if (state.success) {
        return (
            <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-6 text-center animate-fade-in">
                <h3 className="text-xl font-bold text-green-500 mb-2">You're on the list!</h3>
                <p className="text-green-200">{state.message}</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <form action={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <input
                        name="name"
                        type="text"
                        placeholder="Full Name"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                    />
                </div>
                <div>
                    <input
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-[#D4AF37] text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-[#b0902c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-600 shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:shadow-[0_0_25px_rgba(212,175,55,0.6)]"
                    style={{ backgroundColor: '#D4AF37', color: 'black' }}
                >
                    {isPending ? 'Joining...' : 'NOTIFY ME'}
                </button>

                {state.error && (
                    <p className="text-red-400 text-sm text-center mt-2">{state.error}</p>
                )}
            </form>
            <p className="text-gray-500 text-xs text-center mt-4">
                We will only e-mail you when registration for this session opens.
            </p>
        </div>
    );
}
