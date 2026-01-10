import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { getLeagueStats, getSessionStats, PlayerStats } from "@/app/actions/stats-actions";
import StatsTable from "./StatsTable";

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    const { data: league } = await supabase
        .from("leagues")
        .select("id, name, type")
        .eq("id", id)
        .single();

    if (!league) return <div className="text-white p-8">League not found</div>;

    let stats: PlayerStats[] = [];
    let title = "";

    if (league.type === 'league') {
        title = "All Time Stats";
        stats = await getLeagueStats(id);
    } else {
        title = "Session Stats";
        stats = await getSessionStats(id);
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="w-full flex justify-center">
                <div className="w-full max-w-5xl px-4 pb-16" style={{ marginTop: '60px' }}>
                    <div className="mb-8">
                        <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm !text-[#D4AF37] hover:!text-white transition-colors flex items-center gap-1" style={{ color: '#D4AF37' }}>
                            <span>&larr;</span> Back to Dashboard
                        </Link>
                    </div>

                    {/* Header Text left-aligned */}
                    <div className="w-full mb-6 text-left">
                        <h1 className="text-4xl font-bold font-sans text-[#D4AF37] mb-1">{league.name}</h1>
                        <p className="text-white text-lg">{title}</p>
                    </div>

                    <div className="card-glass p-6">
                        <div className="overflow-x-auto">
                            <StatsTable stats={stats} leagueId={id} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
