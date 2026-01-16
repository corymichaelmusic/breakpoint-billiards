import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: Request) {
    // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
        throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
    }

    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error occured -- no svix headers', {
            status: 400
        })
    }

    // Get the body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET)

    let evt: WebhookEvent

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent
    } catch (err) {
        console.error('Error verifying webhook:', err);
        return new Response('Error occured', {
            status: 400
        })
    }

    const eventType = evt.type

    if (eventType === 'user.created' || eventType === 'user.updated') {
        const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data
        const email = email_addresses[0]?.email_address
        const fullName = `${first_name || ''} ${last_name || ''}`.trim()
        // @ts-ignore
        const phone = phone_numbers && phone_numbers.length > 0 ? phone_numbers[0].phone_number : null;

        const supabase = createAdminClient()

        // Check if a profile with this email already exists (possibly with a different Clerk user ID)
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .neq('id', id)
            .single();

        if (existingProfile) {
            // An existing profile with this email but different ID exists
            // This can happen if user deleted their Clerk account and re-registered with the same email
            // Update the old profile's ID to the new Clerk user ID
            console.log(`Migrating profile from old ID ${existingProfile.id} to new ID ${id}`);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    id: id,
                    full_name: fullName,
                    avatar_url: image_url,
                    phone: phone,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingProfile.id);

            if (updateError) {
                console.error('Error migrating profile:', updateError);
                return new Response('Error migrating profile', { status: 500 });
            }
        } else {
            // No existing profile with this email, do a normal upsert
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: id,
                    email: email,
                    full_name: fullName,
                    avatar_url: image_url,
                    phone: phone,
                    updated_at: new Date().toISOString(),
                })

            if (error) {
                console.error('Error upserting profile:', error)
                return new Response('Error upserting profile', { status: 500 })
            }
        }
    }

    return new Response('', { status: 200 })
}
