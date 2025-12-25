import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { userId } = await auth();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Hero Section */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 1rem',
        background: 'radial-gradient(circle at center, #222 0%, #000 70%)'
      }}>
        <div className="container">
          <div style={{ marginBottom: '4rem', position: 'relative', width: '100%', maxWidth: '800px', height: '400px', margin: '0 auto 4rem' }}>
            <Image
              src="/logo-gold.png"
              alt="Breakpoint Billiards Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <p style={{
            fontSize: '1.25rem',
            color: '#888',
            maxWidth: '800px',
            margin: '0 auto 3rem',
            fontFamily: 'var(--font-cinzel), serif',
            lineHeight: '1.8'
          }}>
            A premium individual billiard league experience.<br />Become your best.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href={userId ? "/dashboard" : "/sign-up"} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
              {userId ? "Go to Dashboard" : "Join the League"}
            </Link>
            {!userId && (
              <Link href="/sign-in" className="btn" style={{
                border: '1px solid var(--border)',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                color: 'var(--foreground)'
              }}>
                Sign In
              </Link>
            )}
          </div>

          {(await searchParams)?.applicationSubmitted === 'true' && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '0.5rem',
              color: '#10B981',
              maxWidth: '600px',
              animation: 'fadeIn 0.5s ease-in'
            }}>
              <strong>Application Submitted!</strong><br />
              Thank you for your interest. An administrator will review your application and contact you shortly.
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <Link href="/become-operator" style={{
              fontSize: '0.9rem',
              color: '#666',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}>
              Become a League Operator
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.9rem',
        marginTop: 'auto'
      }}>
        <p>&copy; {new Date().getFullYear()} Breakpoint Billiards. All rights reserved.</p>
      </footer>
    </main>
  );
}


