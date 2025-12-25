import { supabase } from './supabase'

export async function applyRealtimeAuth(token?: string | null) {
    if (token) {
        console.log('[RealtimeAuth] Setting auth token for Realtime connection');
        await supabase.realtime.setAuth(token)
    } else {
        console.log('[RealtimeAuth] Clearing auth token');
        // Clear token and optionally disconnect current channels
        // Casting to string to satisfy type checker if it expects string, though usually takes string
        await supabase.realtime.setAuth('' as unknown as string)
        // Optional: supabase.getChannels().forEach((ch) => supabase.removeChannel(ch))
    }
}
