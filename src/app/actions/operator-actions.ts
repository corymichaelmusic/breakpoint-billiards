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



export async function updatePlayerBreakpointRating(leagueId: string, playerId: string, rating: number) {
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

    const adminClient = createAdminClient();

    console.log(`[updatePlayerBreakpointRating] Updating player ${playerId} in league ${leagueId} to rating: ${rating}`);

    // Update Profile (Global Rating) - Use Admin Client to bypass any RLS restrictions
    const { error: pError } = await adminClient
        .from("profiles")
        .update({ breakpoint_rating: rating })
        .eq("id", playerId);

    if (pError) {
        console.error("[updatePlayerBreakpointRating] Error updating profiles:", pError);
        return { error: "Failed to update Rating." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}/players`);
    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    return { success: true };
}

export async function updatePlayerStatus(leagueId: string, playerId: string, status: 'active' | 'inactive' | 'pending' | 'rejected') {
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

    const adminClient = createAdminClient();

    // If status is 'rejected', we might want to delete the record so they can request again, OR keep it as rejected.
    // For now, let's treat 'rejected' as 'pending' deletion or just 'inactive'.
    // Actually, simply updating status is safest.

    // Allow deleting the row if 'rejected' is passed?
    // Let's stick to status updates for now.

    const { error } = await adminClient
        .from("league_players")
        .update({ status: status })
        .eq("league_id", leagueId)
        .eq("player_id", playerId);

    if (error) {
        console.error("Error updating player status:", error);
        return { error: "Failed to update status." };
    }

    revalidatePath(`/dashboard/operator/leagues/${leagueId}`);
    revalidatePath(`/dashboard/operator/leagues/${leagueId}/players`);
    return { success: true };
}
