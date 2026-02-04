import Image from "next/image";
import { createClient } from "@/utils/supabase/server";

export default async function PosterPage() {
    const supabase = await createClient();

    const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["landing_page_box_title_line_1", "landing_page_box_title_line_2", "landing_page_box_text", "landing_page_box_location"]);

    const titleLine1 = settings?.find(s => s.key === "landing_page_box_title_line_1")?.value || "MONEY MONDAYS @ FAT'S BILLIARDS";
    const titleLine2 = settings?.find(s => s.key === "landing_page_box_title_line_2")?.value || "STARTS FEBRUARY 16";
    const location = settings?.find(s => s.key === "landing_page_box_location")?.value || "Fort Worth, TX";
    const boxText = settings?.find(s => s.key === "landing_page_box_text")?.value || "Secure Your Spot Today! \nDownload the app to join.";

    return (
        <main className="min-h-screen bg-black text-foreground overflow-hidden flex flex-col items-center justify-center p-0 m-0"
            style={{
                width: '100vw',
                height: '100vh',
                // We'll use viewport units to ensure it fills screen, but design is for 2:3 aspect ratio
            }}
        >
            <div className="relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black w-full h-full flex flex-col items-center justify-between py-20 px-8">

                {/* Background Grid Pattern (copied from global css roughly) */}
                <div
                    className="absolute inset-0 z-0 opacity-40 pointer-events-none"
                    style={{
                        backgroundImage: `
                            radial-gradient(circle at 50% 0%, #1a1a1a 0%, transparent 80%),
                            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
                        `,
                        backgroundSize: '100% 100%, 80px 80px, 80px 80px'
                    }}
                />

                {/* Hero / Logo Section */}
                <div className="z-10 flex flex-col items-center text-center gap-8 mt-12">
                    <div className="relative w-[500px] h-[500px] filter drop-shadow-[0_0_80px_rgba(234,179,8,0.3)]">
                        <Image
                            src="/logo-main.png"
                            alt="Breakpoint Billiards"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>

                    <p className="text-4xl text-[#F5D061] font-bold tracking-[0.2em] uppercase font-cinzel drop-shadow-lg">
                        The premier individual billiard league experience
                    </p>
                    <div className="h-px w-64 bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent" />
                    <p className="text-3xl text-yellow-50 font-medium tracking-widest uppercase text-shadow-sm">
                        No Sandbagging. Pure Competition. Real Money.
                    </p>
                </div>

                {/* Headline */}
                <h1 className="z-10 text-[8rem] font-black tracking-tighter text-[#D4AF37] font-cinzel drop-shadow-[0_4px_20px_rgba(0,0,0,1)] leading-none bg-clip-text text-transparent bg-gradient-to-b from-[#F5D061] to-[#AD8A1F] my-12">
                    ELEVATE YOUR GAME
                </h1>

                {/* Info Box & QR Code */}
                <div className="z-10 w-full max-w-5xl bg-black/60 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl p-16 flex flex-col items-center text-center gap-10">
                    <div>
                        <h2 className="text-6xl font-bold text-white font-cinzel leading-tight tracking-wide mb-4">
                            {titleLine1}
                        </h2>
                        <p className="text-3xl text-gray-300 font-sans tracking-normal opacity-90 mb-2">{location}</p>
                        <p className="text-5xl text-[#D4AF37] font-bold font-cinzel">{titleLine2}</p>
                    </div>

                    <p className="text-gray-300 font-medium tracking-widest text-2xl uppercase leading-relaxed max-w-4xl">
                        {boxText}
                    </p>

                    <div className="flex items-center gap-16 mt-8">
                        {/* QR Code */}
                        <div className="relative w-64 h-64 bg-white p-4 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                            <Image
                                src="/assets/poster/qrcode.png"
                                alt="Scan to Download"
                                fill
                                className="object-contain p-2"
                            />
                        </div>

                        {/* Text Call to Action */}
                        <div className="text-left flex flex-col gap-2">
                            <p className="text-4xl font-bold text-white">SCAN TO JOIN</p>
                            <p className="text-xl text-[#D4AF37] uppercase tracking-wider">Available on iOS & Android</p>
                            <div className="flex gap-4 mt-4 opacity-80">
                                {/* Small Store Badges for recognition */}
                                <div className="relative w-32 h-10">
                                    <Image src="/app-store-badge.png" alt="App Store" fill className="object-contain" />
                                </div>
                                <div className="relative w-32 h-10">
                                    <Image src="/google-play-badge.png" alt="Google Play" fill className="object-contain" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer URL */}
                <div className="z-10 mb-8">
                    <p className="text-3xl text-slate-500 font-mono tracking-[0.3em] font-bold">
                        BREAKPOINTBILLIARDS.COM
                    </p>
                </div>
            </div>
        </main>
    );
}
