import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import CreateSessionForm from "@/components/CreateSessionForm";

export default async function NewSessionPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "4rem", maxWidth: "600px" }}>
                <Link href="/dashboard/operator" style={{ marginBottom: "1rem", display: "inline-block", opacity: 0.7 }}>
                    &larr; Back to Dashboard
                </Link>
                <div className="card">
                    <h1 style={{ marginBottom: "2rem" }}>Start New Session</h1>
                    <CreateSessionForm leagueId={id} />
                </div>
            </div>
        </main>
    );
}
