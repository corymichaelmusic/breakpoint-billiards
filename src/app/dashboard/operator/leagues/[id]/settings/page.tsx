import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import LeagueSettingsForm from "@/components/LeagueSettingsForm";

export const dynamic = 'force-dynamic';

export default async function LeagueSettingsPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    const { data: league } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", id)
        .single();

    if (!league) {
        return <div>League not found</div>;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = profile?.role === 'admin';

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", maxWidth: "600px" }}>
                <Link href={`/dashboard/operator/leagues/${id}`} style={{ fontSize: "0.9rem", opacity: 0.7, display: 'block', marginBottom: '1rem' }}>
                    &larr; Back to League
                </Link>

                <div className="card" style={{ padding: "2rem" }}>
                    <h1 style={{ marginBottom: "2rem" }}>Edit League Details</h1>
                    <LeagueSettingsForm league={league} isAdmin={isAdmin} />
                </div>
            </div>
        </main>
    );
}
