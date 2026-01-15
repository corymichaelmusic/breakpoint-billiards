
import Navbar from '@/components/Navbar';
import CreateTournamentForm from './CreateTournamentForm';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function CreateTournamentPage() {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <CreateTournamentForm />
        </main>
    );
}
