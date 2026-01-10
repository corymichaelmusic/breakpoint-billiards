import { supabase } from './supabase'

export async function applyRealtimeAuth(token?: string | null) {
    try {
        if (token) {
            console.log('[RealtimeAuth] Setting auth token for Realtime connection');
            await supabase.realtime.setAuth(token)
        } else {
            console.log('[RealtimeAuth] Clearing auth token');
            // Clear token and optionally disconnect current channels
            await supabase.realtime.setAuth('' as unknown as string)
        }
    } catch (e) {
        console.warn('[RealtimeAuth] Error setting/clearing auth (safe to ignore):', e);
    }
}
