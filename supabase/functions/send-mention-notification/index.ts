import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        })
    }

    try {
        const { taggedPlayerIds, senderName, sessionName } = await req.json()

        if (!taggedPlayerIds || !Array.isArray(taggedPlayerIds) || taggedPlayerIds.length === 0) {
            return new Response(JSON.stringify({ success: true, count: 0, message: 'No tagged players' }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            })
        }

        // Create admin Supabase client using service role key
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Fetch push tokens for tagged players
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, full_name, push_token, notify_mentions')
            .in('id', taggedPlayerIds)
            .not('push_token', 'is', null)

        if (error) {
            console.error('Error fetching profiles:', error)
            throw new Error('Failed to fetch player profiles')
        }

        if (!profiles || profiles.length === 0) {
            return new Response(JSON.stringify({ success: true, count: 0, message: 'No push tokens found' }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            })
        }

        // Build Expo push messages
        const messages = profiles
            .filter((p: any) => p.push_token && p.push_token.startsWith('ExponentPushToken') && p.notify_mentions !== false)
            .map((p: any) => ({
                to: p.push_token,
                sound: 'default',
                title: `${sessionName || 'Session'} Chat`,
                body: `${senderName || 'Someone'} mentioned you`,
                data: { type: 'chat_mention' },
            }))

        if (messages.length === 0) {
            return new Response(JSON.stringify({ success: true, count: 0, message: 'No valid tokens' }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            })
        }

        // Send via Expo Push API
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        })

        const result = await response.json()
        console.log(`[MentionNotification] Sent ${messages.length} notifications. Result:`, JSON.stringify(result))

        return new Response(JSON.stringify({ success: true, count: messages.length }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })

    } catch (error) {
        console.error('Error in send-mention-notification:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
    }
})
