import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import Navbar from "@/components/Navbar";
import { createClient } from "@/utils/supabase/server";


export default async function Home() {
  const { userId } = await auth();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["landing_page_box_title_line_1", "landing_page_box_title_line_2", "landing_page_box_text", "landing_page_box_location"]);

  const titleLine1 = settings?.find(s => s.key === "landing_page_box_title_line_1")?.value || "MONEY MONDAYS @ FAT'S BILLIARDS";
  const titleLine2 = settings?.find(s => s.key === "landing_page_box_title_line_2")?.value || "STARTS FEBRUARY 16";
  const location = settings?.find(s => s.key === "landing_page_box_location")?.value || "Fort Worth, TX";
  const boxText = settings?.find(s => s.key === "landing_page_box_text")?.value || "Secure Your Spot Today! \nDownload the app, create an account and join the session!";

  return (
    <main className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black z-0 pointer-events-none" />

      {/* Navigation Overlay */}
      <nav className="relative z-10 w-full p-6 flex justify-end items-center container mx-auto">
        <div>
          {userId && (
            <Link href="/dashboard" className="flex items-center justify-center w-[160px] h-[34px] rounded-full bg-[#D4AF37] text-black hover:bg-[#b0902c] transition-all text-[11px] font-bold tracking-[0.1em] uppercase shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]">
              Go to Dashboard
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-start text-center px-4 pt-40 pb-40">
        <div className="animate-fade-in-up flex flex-col items-center justify-center gap-12 w-full max-w-6xl mx-auto">

          {/* Logo Hero */}
          <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto filter drop-shadow-[0_0_60px_rgba(234,179,8,0.25)] hover:scale-105 transition-transform duration-700">
            <Image
              src="/logo-main.png"
              alt="Breakpoint Billiards"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Subtext Group */}
          <div className="flex flex-col gap-3">
            <p className="text-xl md:text-2xl text-[#F5D061] font-bold tracking-widest uppercase font-cinzel drop-shadow-md">
              The premier individual billiard league experience
            </p>
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent mx-auto my-2" />
            <p className="text-xl md:text-2xl text-yellow-50 font-medium tracking-wider uppercase text-shadow-sm">
              No Sandbagging. Pure Competition. Real Money.
            </p>
          </div>

          {/* Badges Container */}
          <div className="flex flex-wrap justify-center gap-6">
            {/* Proving Grounds Badge */}
            <div className="group relative inline-flex items-center gap-3 px-8 py-4 bg-black/40 border border-yellow-600/30 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.1)] hover:border-yellow-500/60 hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_#EAB308]" />
              <span className="text-xs md:text-sm font-bold tracking-[0.2em] text-yellow-500 uppercase">Proving Grounds for Serious Players</span>
            </div>

            {/* Learning Grounds Badge */}
            <div className="group relative inline-flex items-center gap-3 px-8 py-4 bg-black/40 border border-blue-600/30 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:border-blue-500/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3B82F6]" />
              <span className="text-xs md:text-sm font-bold tracking-[0.2em] text-blue-500 uppercase">Learning Grounds for Improving Players</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-[#D4AF37] font-cinzel drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-none bg-clip-text text-transparent bg-gradient-to-b from-[#F5D061] to-[#AD8A1F] mt-24 mb-12">
            ELEVATE YOUR GAME
          </h1>

          {/* Pre-registration */}
          {/* Pre-registration */}
          <div className="w-full max-w-2xl mx-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl text-center">

            {/* Spacer */}
            <div className="h-12 md:h-16 w-full" />

            <div className="px-6 md:px-12">
              <h2 className="text-xl md:text-3xl font-bold text-white font-cinzel leading-relaxed tracking-wide">
                {titleLine1}<br />
                <span className="text-sm md:text-lg text-gray-300 block my-1 font-sans tracking-normal opacity-80">{location}</span>
                <span className="text-[#D4AF37]">{titleLine2}</span>
              </h2>

              {/* Spacer */}
              <div className="h-8 md:h-12 w-full" />

              <p className="text-gray-300 font-medium tracking-widest text-xs md:text-sm uppercase leading-relaxed whitespace-pre-line px-4">
                {boxText}
              </p>

              {/* Spacer */}
              <div className="h-8 md:h-10 w-full" />

              <div className="flex flex-wrap justify-center gap-6">
                {/* iOS Store Button */}
                <a href="https://apps.apple.com/us/app/breakpoint-billiards/id6757766853" target="_blank" rel="noopener noreferrer" className="relative w-44 h-14 cursor-pointer hover:scale-105 transition-transform duration-300 block">
                  <Image
                    src="/app-store-badge.png"
                    alt="Download on the App Store"
                    fill
                    className="object-contain"
                  />
                </a>

                {/* Android Store Button */}
                <a href="https://play.google.com/store/apps/details?id=com.breakpoint.billiards&hl=en_US" target="_blank" rel="noopener noreferrer" className="relative w-44 h-14 cursor-pointer hover:scale-105 transition-transform duration-300 block">
                  <Image
                    src="/google-play-badge.png"
                    alt="Get it on Google Play"
                    fill
                    className="object-contain"
                  />
                </a>
              </div>
            </div>

            {/* Spacer */}
            <div className="h-12 md:h-16 w-full" />

          </div>

        </div>
      </section>

      {/* Explicit Spacer to prevent layout collision */}
      <div className="h-32 w-full" />

      {/* Features Grid */}
      <section className="relative z-10 pt-12 pb-24 bg-black/40 backdrop-blur-sm border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 md:gap-20 text-center max-w-7xl mx-auto">

            {/* Feature 1 */}
            <div className="group p-10 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-yellow-600/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-2">
              <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-slate-900 to-black rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-yellow-500/50 group-hover:shadow-[0_0_40px_rgba(234,179,8,0.15)] transition-all">
                <svg className="w-10 h-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-cinzel">Dynamic Ratings</h3>
              <p className="text-slate-400 leading-relaxed text-sm md:text-base">
                Our proprietary <strong>Breakpoint Billiards Rating System (BBRS)</strong> focuses on your wins and loses, giving players an accurate rating and ensuring fair handicap races every time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-10 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-emerald-600/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-2">
              <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-slate-900 to-black rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all">
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-cinzel">Money Leagues</h3>
              <p className="text-slate-400 leading-relaxed text-sm md:text-base">
                Compete for real cash prizes. All session fees and payouts are handled securely via Stripe, so you can focus on running racks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-10 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-purple-600/30 hover:bg-white/[0.05] transition-all duration-500 hover:-translate-y-2">
              <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-slate-900 to-black rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-purple-500/50 group-hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] transition-all">
                <svg className="w-10 h-10 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-cinzel">Live Bounties</h3>
              <p className="text-slate-400 leading-relaxed text-sm md:text-base">
                Earn extra cash instantly for <strong>Break & Runs</strong>, <strong>9-on-the-Snap</strong>, and <strong>Shutouts</strong>. Track your bounty throughout the session and watch it grow.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Spacer for consistent rhythm */}
      <div className="h-32 w-full" />

      {/* Download CTA */}
      <section className="relative z-10 pt-0 pb-32 text-center bg-gradient-to-t from-yellow-900/10 to-transparent">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-900/5 to-transparent pointer-events-none" />

        {/* Content Wrapper with Flex Gap to prevent collapse */}
        <div className="flex flex-col items-center gap-16 w-full px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-white font-cinzel leading-tight text-center">
            Ready to Break?
          </h2>

          {/* CTA Text Group */}
          <div className="flex flex-col items-center gap-6">
            <p className="text-xl md:text-2xl font-cinzel text-slate-300">
              <Link href="/become-operator" className="text-yellow-500 hover:text-yellow-400 transition-colors border-b border-yellow-500/30 hover:border-yellow-500">
                Become an Operator
              </Link>
            </p>

            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto text-center">
              Download the Breakpoint Billiards app to join a league near you.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {/* iOS Store Button */}
            <a href="https://apps.apple.com/us/app/breakpoint-billiards/id6757766853" target="_blank" rel="noopener noreferrer" className="relative w-48 h-16 cursor-pointer hover:scale-105 transition-transform duration-300 block">
              <Image
                src="/app-store-badge.png"
                alt="Download on the App Store"
                fill
                className="object-contain"
              />
            </a>

            {/* Android Store Button */}
            <a href="https://play.google.com/store/apps/details?id=com.breakpoint.billiards&hl=en_US" target="_blank" rel="noopener noreferrer" className="relative w-48 h-16 cursor-pointer hover:scale-105 transition-transform duration-300 block">
              <Image
                src="/google-play-badge.png"
                alt="Get it on Google Play"
                fill
                className="object-contain"
              />
            </a>
          </div>
        </div>
      </section>

      {/* Spacer before footer */}
      <div className="h-40 w-full" />

      {/* Footer */}
      <footer className="relative z-10 py-10 border-t border-white/5 bg-black text-center">
        <p className="text-slate-600 text-sm">
          &copy; {new Date().getFullYear()} Breakpoint Billiards. All rights reserved.
        </p>
      </footer>
    </main>
  );
}


