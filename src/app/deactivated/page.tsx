import { SignOutButton } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";

export default function DeactivatedPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
            <Navbar />
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: 'calc(100vh - 60px)', // Adjust for Navbar height
                textAlign: 'center',
                padding: '2rem',
                color: 'var(--foreground)'
            }}>
                <div style={{
                    padding: '2rem',
                    background: 'var(--surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--error, #ff4444)',
                    maxWidth: '500px'
                }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--error, #ff4444)' }}>Account Deactivated</h1>
                    <p style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
                        Your account has been deactivated by an administrator.
                        You can no longer access the application.
                    </p>

                    <div style={{ padding: '0.5rem 1rem', background: '#333', borderRadius: '4px', display: 'inline-block' }}>
                        <SignOutButton>
                            <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>
                                Sign Out
                            </button>
                        </SignOutButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
