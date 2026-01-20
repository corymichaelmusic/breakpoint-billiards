'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function submitOperatorApplication(formData: FormData) {
    const supabase = await createClient();

    const rawData = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        location: formData.get('location') as string,
        desired_league_location: formData.get('desiredLeagueLocation') as string,
        notes: formData.get('notes') as string,
    };

    // Validation
    if (!rawData.first_name || !rawData.last_name || !rawData.email || !rawData.phone) {
        return { error: 'Please fill in all required fields.' };
    }

    try {
        const { error } = await supabase
            .from('operator_applications')
            .insert([rawData]);

        if (error) {
            console.error('Error submitting application:', error);
            return { error: 'Failed to submit application. Please try again.' };
        }

    } catch (e) {
        console.error('Unexpected error:', e);
        return { error: 'An unexpected error occurred.' };
    }

    // Redirect on success
    redirect('/?applicationSubmitted=true');
}

export async function updatePlayerFargo(playerId: string, fargoRating: number) {
    const { userId } = await auth();
    if (!userId) return { error: "Unauthorized" };

    const supabase = await createClient();

    // Verify Caller is Operator or Admin
    const { data: callerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (callerProfile?.role !== 'operator' && callerProfile?.role !== 'admin') {
        return { error: "Unauthorized: Operator privileges required." };
    }

    // Use Admin Client (bypasses RLS) for the actual update
    const adminClient = createAdminClient();

    const { error } = await adminClient
        .from("profiles")
        .update({ fargo_rating: fargoRating })
        .eq("id", playerId);

    if (error) {
        console.error("Error updating fargo:", error);
        return { error: "Failed to update Fargo Rating." };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/admin/players/${playerId}`);
    revalidatePath("/dashboard/admin/players");
    revalidatePath("/dashboard/operator", "layout");
    return { success: true };
}
