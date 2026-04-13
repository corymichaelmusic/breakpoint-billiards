import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import CreateSessionForm from "@/components/CreateSessionForm";

export default async function NewSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { data: parentLeague } = await createAdminClient()
        .from("leagues")
        .select("bounty_val_8_run, bounty_val_8_rack_run, bounty_val_9_run, bounty_val_9_snap, bounty_val_shutout, is_team_league")
        .eq("id", id)
        .single();

    const isTeamLeague = !!parentLeague?.is_team_league;

    const defaultBounties = {
        bounty8Run: parentLeague?.bounty_val_8_run || 0,
        bounty8RackRun: parentLeague?.bounty_val_8_rack_run || 2,
        bounty9Run: parentLeague?.bounty_val_9_run || 0,
        bounty9Snap: parentLeague?.bounty_val_9_snap || 0,
        bountyShutout: isTeamLeague ? 0 : (parentLeague?.bounty_val_shutout || 0)
    };

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "600px" }}>
                <Link href="/dashboard/operator" style={{ marginBottom: "1rem", display: "inline-block", color: "#D4AF37" }}>
                    &larr; Back to Dashboard
                </Link>
                <div className="card">
                    <h1 style={{ marginBottom: "2rem", color: "#D4AF37" }}>Start New Session</h1>
                    <CreateSessionForm leagueId={id} defaultBounties={defaultBounties} isTeamLeague={isTeamLeague} />
                </div>
            </div>
        </main>
    );
}
