import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { auth } from '@clerk/nextjs/server'

export async function createClient() {
    const cookieStore = await cookies()
    const { getToken } = await auth()

    // The template name 'supabase' must match your Clerk -> Supabase integration setting
    let token;
    try {
        token = await getToken({ template: 'supabase' })
    } catch (error) {
        // Log as warning to avoid cluttering console with "Unhandled Runtime Error" if Next.js treats errors strictly
        // console.warn("Warning: Could not fetch 'supabase' JWT template from Clerk. RLS policies may fail.", error);
    }

    if (!token) {
        console.log("Supabase Client: No JWT token found. User may be unauthenticated or template missing.");
    } else {
        // console.log("Supabase Client: JWT token found.");
    }



    // Check Env
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) throw new Error("Missing Supabase Env Vars");

    return createServerClient(
        sbUrl,
        sbKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
            global: {
                headers: token ? {
                    Authorization: `Bearer ${token}`,
                } : {},
            },
        }
    )
}
