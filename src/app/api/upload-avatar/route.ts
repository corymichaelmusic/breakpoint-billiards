
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Admin Client (Service Role)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file || !userId) {
            return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExt = file.name.split('.').pop();

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
                contentType: file.type || 'image/jpeg',
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
