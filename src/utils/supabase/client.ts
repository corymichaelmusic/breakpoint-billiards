import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!sbUrl || !sbKey) throw new Error("Missing Supabase Env Vars");

    return createBrowserClient(sbUrl, sbKey);
}
