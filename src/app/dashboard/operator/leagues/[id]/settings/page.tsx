import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import LeagueSettingsForm from "@/components/LeagueSettingsForm";

export const dynamic = 'force-dynamic';

export default async function LeagueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) {
        return <div className="text-white p-8">League not found</div>;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = profile?.role === 'admin';

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container max-w-2xl mt-20">
                <Link href={`/dashboard/operator/leagues/${id}`} className="text-sm text-gray-500 hover:text-white transition-colors mb-4 block">
                    &larr; Back to League
                </Link>

                <div className="card-glass p-8">
                    <h1 className="text-2xl font-bold font-sans text-primary mb-6">Edit League Details</h1>
                    <LeagueSettingsForm league={league} isAdmin={isAdmin} />
                </div>
            </div>
        </main>
    );
}
