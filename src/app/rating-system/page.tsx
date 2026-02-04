import React from 'react';
import Link from 'next/link';

export default function RatingSystem() {
    return (
        <div className="min-h-screen flex flex-col items-center bg-background text-foreground overflow-x-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black z-0 pointer-events-none" />

            {/* Header */}
            <header className="fixed top-0 left-0 w-full z-50 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 flex justify-center">
                <div className="w-full max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="relative h-12 w-48">
                        <img
                            src="/breakpoint-logo.png"
                            alt="Breakpoint Billiards"
                            className="h-full w-full object-contain object-left"
                        />
                    </Link>
                    <Link href="/" className="text-sm font-medium text-[#D4AF37] !text-[#D4AF37] hover:text-white transition-colors uppercase tracking-widest" style={{ color: '#D4AF37' }}>
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="relative z-10 px-6 w-full max-w-6xl mx-auto flex flex-col items-center" style={{ paddingTop: '150px' }}>
                {/* Hero Section */}
                <div className="text-center w-full max-w-5xl mb-20">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#D4AF37] font-cinzel drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-tight mb-10 mx-auto">
                        BREAKPOINT BILLIARDS RATING SYSTEM (BBRS)
                    </h1>
                    <div className="h-1 w-40 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-10"></div>
                    <p className="text-xl md:text-3xl text-slate-300 leading-relaxed font-light">
                        The <strong className="text-white font-medium">Breakpoint Billiards Rating System (BBRS)</strong> is a dynamic, data-driven engine designed to measure true skill. No guesswork. Just performance.
                    </p>
                </div>

                {/* Spacer */}
                <div className="h-16 w-full" />

                <div className="w-full flex flex-col gap-0 items-center">

                    {/* The Scale */}
                    <section className="w-full group rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-[#D4AF37]/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-1 shadow-2xl backdrop-blur-sm text-center" style={{ padding: '40px' }}>
                        <div className="flex flex-col items-center gap-10">
                            <div className="flex items-center justify-center mb-2">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white font-mono tracking-tighter">10.0 (1000)</div>
                                    <div className="text-[10px] uppercase tracking-[0.3em] text-[#D4AF37] mt-2 font-bold">Max Rating</div>
                                </div>
                            </div>

                            <div className="max-w-3xl mx-auto">
                                <h2 className="text-4xl font-bold text-white mb-8 font-cinzel">The Scale</h2>
                                <p className="text-slate-300 text-xl leading-relaxed">
                                    Players are rated on a granular scale from <strong className="text-white">0 to 1000</strong>. This precision allows us to track even micro-improvements in your game and create fair matches regardless of skill level.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Spacer */}
                    <div className="h-24 md:h-32 w-full" />

                    {/* Elo System */}
                    <section className="w-full group rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-1 shadow-2xl backdrop-blur-sm text-center" style={{ padding: '40px' }}>
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="text-4xl font-bold text-white mb-8 font-cinzel">Dynamic Evolution</h2>
                            <p className="text-slate-300 text-xl leading-relaxed">
                                We use a modified <strong>Elo rating system</strong>. Your rating isn't static—it's alive. It adapts based on <em>who</em> you play and the outcome of every single match.
                            </p>
                        </div>

                        <div style={{ height: '20px' }} />

                        <div className="w-full flex flex-col md:flex-row justify-center items-center gap-8 mx-auto">
                            <div className="bg-emerald-900/10 p-10 rounded-3xl hover:bg-emerald-900/20 transition-all duration-300 flex flex-col items-center text-center group/card flex-1 w-full">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-500 group-hover/card:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <h3 className="text-emerald-500 text-2xl font-bold font-cinzel mb-4">Rising Up</h3>
                                <p className="text-base text-slate-300 leading-relaxed">
                                    Beating a higher-rated player proves you're undervalued. The system rewards this with a <strong className="text-white">significant rating boost</strong>.
                                </p>
                            </div>
                            <div className="bg-red-900/10 p-10 rounded-3xl hover:bg-red-900/20 transition-all duration-300 flex flex-col items-center text-center group/card flex-1 w-full">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500 group-hover/card:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                                <h3 className="text-red-500 text-2xl font-bold font-cinzel mb-4">Falling Down</h3>
                                <p className="text-base text-slate-300 leading-relaxed">
                                    Losing to a lower-rated player suggests you're overvalued. The system adjusts with a <strong className="text-white">larger decrease</strong>.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Spacer */}
                    <div className="h-24 md:h-32 w-full" />

                    {/* Rating Definitions & K-Factors */}
                    <section className="w-full group rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-1 shadow-2xl backdrop-blur-sm text-center" style={{ padding: '40px' }}>
                        <div className="flex flex-col items-center gap-12">
                            <div className="max-w-3xl mx-auto text-center">
                                <h2 className="text-4xl font-bold text-white mb-8 font-cinzel">Rating Definitions</h2>
                                <p className="text-slate-300 text-xl leading-relaxed">
                                    From beginner to world-class, every player has a place.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-12 w-full text-left">
                                {/* Skill Levels */}
                                <div className="bg-black/20 rounded-3xl p-5 border border-white/5">
                                    <h3 className="text-2xl font-bold text-white mb-6 font-cinzel text-center">Skill Levels</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">0 - 344</span>
                                            <span className="text-white font-bold">Beginner</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">345 - 436</span>
                                            <span className="text-white font-bold">Intermediate</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">437 - 499</span>
                                            <span className="text-white font-bold">Intermediate+</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">500 - 561</span>
                                            <span className="text-green-500 font-bold">Good League Player</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">562 - 624</span>
                                            <span className="text-green-500 font-bold">Advanced</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">625 - 686</span>
                                            <span className="text-purple-400 font-bold">Advanced+</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">687 - 749</span>
                                            <span className="text-purple-400 font-bold">Top Regional</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-slate-400">750 - 875</span>
                                            <span className="text-[#D4AF37] font-bold">Semi-Pro</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">876+</span>
                                            <span className="text-[#D4AF37] font-bold">World Class</span>
                                        </div>
                                    </div>
                                </div>

                                {/* K-Factors */}
                                <div className="flex flex-col gap-6">
                                    <div className="bg-black/20 rounded-3xl p-5 border border-white/5 flex-1">
                                        <h3 className="text-2xl font-bold text-white mb-6 font-cinzel text-center">Volatility</h3>
                                        <p className="text-slate-400 text-sm mb-6 text-center">
                                            Newer players have higher volatility to help them find their true rating faster.
                                        </p>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                <span className="text-slate-400">&lt; 100 Racks</span>
                                                <div className="text-right">
                                                    <span className="text-xs text-yellow-500 uppercase tracking-wider font-bold text-sm">Provisional</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                <span className="text-slate-400">100 - 300 Racks</span>
                                                <div className="text-right">
                                                    <span className="text-xs text-blue-500 uppercase tracking-wider font-bold text-sm">Established</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">&gt; 300 Racks</span>
                                                <div className="text-right">
                                                    <span className="text-xs text-green-500 uppercase tracking-wider font-bold text-sm">Stable</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#D4AF37]/10 rounded-3xl p-8 border border-[#D4AF37]/20 flex-1 flex flex-col justify-center items-center text-center">
                                        <div className="text-[#D4AF37] font-bold text-lg mb-2">Display Rating</div>
                                        <div className="text-3xl font-mono font-bold text-white">523 → 5.2</div>
                                        <p className="text-[#D4AF37]/80 text-xs mt-2 uppercase tracking-widest">Breakpoint Level</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Spacer */}
                    <div className="h-24 md:h-32 w-full" />

                    {/* The Race Matrix */}
                    <section className="w-full group rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-1 shadow-2xl backdrop-blur-sm text-center" style={{ padding: '40px' }}>
                        <div className="flex flex-col items-center gap-10">
                            <div className="flex flex-col items-center text-center justify-center mb-6">
                                <div className="text-5xl font-bold text-white mb-2 font-cinzel">50<span className="text-purple-500">/</span>50</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Probability</div>
                            </div>

                            <div className="max-w-3xl mx-auto">
                                <h2 className="text-4xl font-bold text-white mb-8 font-cinzel">Fair Play & Handicapping</h2>
                                <p className="text-slate-300 text-xl leading-relaxed mb-8">
                                    The core philosophy of Breakpoint Billiards is that <strong>anyone can compete with anyone</strong>. Our proprietary Race Matrix analyzes the skill gap before every match.
                                </p>
                                <p className="text-slate-300 text-xl leading-relaxed">
                                    It calculates a specific "Race Strategy" designed to give both players a mathematical <strong>50% chance of winning</strong>. This ensures that victory depends on your performance in the moment, not your resume.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>

                <div style={{ height: '20px' }} />

                {/* Conclusion */}
                <div className="text-center border-t border-white/5 pt-20">
                    <p className="text-slate-500 max-w-2xl mx-auto text-xl leading-relaxed">
                        By providing an objective standard for skill, BBRS removes the guesswork from the game. Track your progress. Set your goals. <br />
                        <span className="text-[#D4AF37] font-cinzel font-bold text-3xl mt-8 block drop-shadow-md">Elevate your game.</span>
                    </p>
                </div>

                <div style={{ height: '20px' }} />
            </main>

            {/* Footer */}
            <footer className="relative z-10 py-10 border-t border-white/5 bg-black text-center w-full">
                <p className="text-slate-600 text-sm">
                    &copy; {new Date().getFullYear()} Breakpoint Billiards. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
