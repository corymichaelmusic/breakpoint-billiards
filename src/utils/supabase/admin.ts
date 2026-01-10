import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbKey) throw new Error("Missing Supabase Admin Env Vars");

    return createClient(sbUrl, sbKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
    )
}
