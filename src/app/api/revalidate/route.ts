import { revalidatePath } from 'next/cache';

export async function GET() {
    revalidatePath('/', 'layout');
    return new Response('Revalidated All', { status: 200 });
}
