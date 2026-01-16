'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const matchId = searchParams.get('match_id');
    const source = searchParams.get('source');
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        // If source is mobile, try to redirect to the app
        if (source === 'mobile') {
            setRedirecting(true);
            const appUrl = matchId
                ? `breakpoint-billiards://payment/success?match_id=${matchId}`
                : 'breakpoint-billiards://payment/success';

            // Small delay to ensure the page renders first
            const timer = setTimeout(() => {
                window.location.href = appUrl;
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [source, matchId]);

    // If from mobile, show a simple redirect message with fallback button
    if (source === 'mobile') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="bg-surface/50 p-8 rounded-2xl border border-border max-w-sm w-full text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                        <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-white text-2xl font-bold mb-2">Payment Successful!</h1>
                    <p className="text-gray-400 mb-6">
                        {redirecting ? 'Returning to the app...' : 'Your payment has been processed.'}
                    </p>

                    <a
                        href={matchId
                            ? `breakpoint-billiards://payment/success?match_id=${matchId}`
                            : 'breakpoint-billiards://payment/success'
                        }
                        className="block bg-primary text-black font-bold py-4 px-6 rounded-xl text-center uppercase tracking-wider hover:bg-primary/90 transition-colors"
                    >
                        Open App
                    </a>

                    <p className="text-gray-500 text-xs mt-4">
                        If the app doesn't open automatically, tap the button above.
                    </p>
                </div>
            </div>
        );
    }

    // Web user - show success and redirect to dashboard
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="bg-surface/50 p-8 rounded-2xl border border-border max-w-sm w-full text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-white text-2xl font-bold mb-2">Payment Successful!</h1>
                <p className="text-gray-400 mb-6">Your payment has been processed. You're all set!</p>

                <a
                    href={matchId ? `/match/${matchId}` : '/dashboard'}
                    className="block bg-primary text-black font-bold py-4 px-6 rounded-xl text-center uppercase tracking-wider hover:bg-primary/90 transition-colors"
                >
                    {matchId ? 'Go to Match' : 'Go to Dashboard'}
                </a>
            </div>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="bg-surface/50 p-8 rounded-2xl border border-border max-w-sm w-full text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 animate-pulse">
                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="text-white text-2xl font-bold mb-2">Processing...</h1>
            </div>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <PaymentSuccessContent />
        </Suspense>
    );
}
