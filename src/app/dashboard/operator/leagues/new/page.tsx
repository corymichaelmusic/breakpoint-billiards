import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function CreateLeaguePage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    async function createLeague(formData: FormData) {
        "use server";
        const name = formData.get("name") as string;
        const { userId } = await auth();

        if (!userId || !name) return;

        const supabase = createAdminClient();
        const { error } = await supabase.from("leagues").insert({
            name,
            operator_id: userId,
            status: "setup",
        });

        if (error) {
            console.error("Error creating league:", error);
            // In a real app, handle error
        } else {
            redirect("/dashboard/operator");
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container max-w-lg mt-20">
                <div className="card-glass p-8">
                    <h1 className="text-2xl font-bold text-primary mb-6">Create New League</h1>
                    <form action={createLeague} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-bold text-gray-400 uppercase tracking-wide">League Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                required
                                placeholder="e.g. Monday Night 8-Ball"
                                className="input w-full bg-black/50 border-gray-700 focus:border-primary text-white"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="btn btn-primary w-full md:w-auto px-8">Create League</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
