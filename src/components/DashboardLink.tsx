'use client';

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

export default function DashboardLink({ className, role }: { className?: string, role?: string | null }) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const view = searchParams.get('view');

    const sessionId = searchParams.get('sessionId');

    let href = '/dashboard';

    if (role === 'operator') {
        // Check if we are currently in a "Player Context"
        // 1. Explicitly requested via query param
        // 2. Currently on a dashboard page that is NOT the operator dashboard
        const isPlayerContext = view === 'player' || (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/operator'));

        if (isPlayerContext) {
            href = '/dashboard?view=player&latest=true';
        } else {
            href = '/dashboard/operator';
        }
    } else {
        // Regular player
        href = '/dashboard?latest=true';
    }

    return (
        <Link href={href} className={className}>
            <span className="hidden-mobile">Dashboard</span>
            <span className="visible-mobile">Dash</span>
            <style jsx>{`
                .hidden-mobile { display: inline; }
                .visible-mobile { display: none; }
                @media (max-width: 600px) {
                    .hidden-mobile { display: none; }
                    .visible-mobile { display: inline; }
                }
            `}</style>
        </Link>
    );
}
