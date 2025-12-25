import Navbar from '@/components/Navbar';
import OperatorApplicationForm from '@/components/OperatorApplicationForm';

export default function BecomeOperatorPage() {
    return (
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />

            <div className="container" style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center' }}>Become a League Operator</h1>
                <p style={{ textAlign: 'center', marginBottom: '3rem', color: '#888' }}>
                    Start your own Breakpoint Billiards league. Fill out the application below and an administrator will contact you shortly.
                </p>

                <OperatorApplicationForm />
            </div>
        </main>
    );
}
