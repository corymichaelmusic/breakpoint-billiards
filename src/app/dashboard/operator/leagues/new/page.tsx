import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

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
            // Handle error (in a real app, use useFormState)
        } else {
            redirect("/dashboard/operator");
        }
    }

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", maxWidth: "600px" }}>
                <h1>Create New League</h1>
                <div className="card" style={{ marginTop: "1rem" }}>
                    <form action={createLeague} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name">League Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                required
                                placeholder="e.g. Monday Night 8-Ball"
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.actions}>
                            <button type="submit" className="btn btn-primary">Create League</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
