'use client';

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function UnauthorizedPage() {
    const { signOut } = useClerk();

    useEffect(() => {
        // Automatically sign out users who land here (Players accessing admin area)
        const performSignOut = async () => {
            try {
                await signOut();
            } catch (e) {
                console.error("Sign out failed", e);
            }
        };
        performSignOut();
    }, [signOut]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
            <div className="max-w-md w-full animate-fade-in-up">
                <div className="mb-8 relative w-32 h-32 mx-auto opacity-50">
                    <Image src="/logo-gold.png" alt="Logo" fill className="object-contain" />
                </div>

                <h1 className="text-3xl font-bold mb-4 font-cinzel text-yellow-500">Mobil App Required</h1>

                <p className="text-slate-400 mb-8 leading-relaxed">
                    The web dashboard is exclusively for League Operators. <br />
                    As a player, please use the Breakpoint Billiards mobile app to view stats, matches, and payments.
                </p>

                <div className="p-4 rounded-lg bg-yellow-900/10 border border-yellow-700/20 mb-8">
                    <p className="text-xs text-yellow-600 font-mono uppercase tracking-widest">
                        Status: Signed Out
                    </p>
                </div>

                <div className="space-y-4">
                    {/* iOS Store Button Placeholder */}
                    <div className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-xl cursor-not-allowed opacity-80 hover:opacity-100 transition-opacity w-full justify-center">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.96 1.07-3.11-1.05.05-2.31.74-3.03 1.59-.67.79-1.25 2.05-1.07 3.12 1.17.09 2.33-.74 3.03-1.6" /></svg>
                        <div className="text-left">
                            <div className="text-[10px] font-bold uppercase tracking-wider">Download on</div>
                            <div className="text-sm font-bold">App Store</div>
                        </div>
                    </div>

                    {/* Android Store Button Placeholder */}
                    <div className="flex items-center gap-3 bg-transparent border border-white/20 text-white px-6 py-3 rounded-xl cursor-not-allowed hover:bg-white/10 transition-colors w-full justify-center">
                        <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.152-.5676.416.416 0 00-.5676.152l-2.0223 3.503C15.5902 8.2439 13.8533 7.8449 12 7.8449c-1.8532 0-3.5898.399-5.1364 1.1047L4.8413 5.4465a.416.416 0 00-.5676-.152.416.416 0 00-.152.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" /></svg>
                        <div className="text-left">
                            <div className="text-[10px] font-bold uppercase tracking-wider">Get it on</div>
                            <div className="text-sm font-bold">Google Play</div>
                        </div>
                    </div>
                </div>

                <div className="mt-12">
                    <Link href="/" className="text-sm text-slate-500 hover:text-white transition-colors">
                        &larr; Back to Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
