import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();

        // Check if there's already a pending request
        const { data: existingRequest } = await supabase
            .from("deletion_requests")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "pending")
            .single();

        if (existingRequest) {
            return NextResponse.json({ error: "You already have a pending deletion request." }, { status: 400 });
        }

        // Parse optional reason from body
        let reason = null;
        try {
            const body = await req.json();
            reason = body.reason || null;
        } catch {
            // No body or invalid JSON is fine
        }

        const { error } = await supabase
            .from("deletion_requests")
            .insert({
                user_id: userId,
                reason: reason,
                status: 'pending'
            });

        if (error) {
            console.error("Error creating deletion request:", error);
            return NextResponse.json({ error: "Failed to submit deletion request." }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("Deletion request error:", e);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
