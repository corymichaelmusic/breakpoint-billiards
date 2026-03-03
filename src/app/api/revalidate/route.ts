import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
    revalidatePath('/dashboard/operator/leagues/[id]', 'page');
    revalidatePath('/dashboard/operator/leagues/[id]', 'layout');
    return new Response('Revalidated', { status: 200 });
}
