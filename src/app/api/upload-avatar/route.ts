
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        // Client might send userId, but we MUST ignore it and use authenticated userId
        // const userIdFormatted = formData.get('userId') as string; 

        if (!file) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }

        // VALIDATION
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File size too large (Max 5MB)' }, { status: 400 });
        }

        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WEBP, GIF allowed.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (!fileExt || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt)) {
            return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 });
        }

        // 0. Cleanup Helper: Remove old avatars for this user
        const { data: listData } = await supabaseAdmin.storage.from('avatars').list(userId);
        if (listData && listData.length > 0) {
            const filesToRemove = listData.map(f => `${userId}/${f.name}`);
            await supabaseAdmin.storage.from('avatars').remove(filesToRemove);
        }

        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        // 1. Upload to Storage (As Admin - Bypasses owner column issue)
        const { error: uploadError } = await supabaseAdmin.storage
            .from('avatars')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            throw uploadError;
        }

        // 2. Get Public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // 3. Update Profile
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateError) throw updateError;

        return NextResponse.json({ publicUrl });

    } catch (error: any) {
        console.error('Avatar Upload Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
