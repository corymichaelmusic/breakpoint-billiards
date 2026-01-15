import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { redirect } from "next/navigation";
import TournamentCard from "@/components/TournamentCard";

export default async function TournamentDashboard() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Fetch Tournaments created by this operator
    const { data: tournaments } = await supabase
        .from("tournaments")
        .select("*")
        .eq("organizer_id", userId)
        .order("created_at", { ascending: false });

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="container py-12 pb-24">
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold font-sans text-white">Tournaments</h1>
                        <p className="text-sm text-gray-300 mt-1">Manage single and double elimination events</p>
                    </div>
                    <Link href="/dashboard/tournaments/create" className="btn btn-primary">
                        + Create Tournament
                    </Link>
                </div>

                {tournaments && tournaments.length > 0 ? (
                    <div className="grid gap-6">
                        {tournaments.map((tournament) => (
                            <TournamentCard key={tournament.id} tournament={tournament} />
                        ))}
                    </div>
                ) : (
                    <div className="card-glass p-16 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center mb-6 text-3xl">
                            🏆
                        </div>
                        <h3 className="text-2xl font-bold mb-2 text-[#D4AF37]">No Tournaments Yet</h3>
                        <p className="text-gray-400 max-w-md">
                            Create your first tournament to start managing brackets and matches.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
