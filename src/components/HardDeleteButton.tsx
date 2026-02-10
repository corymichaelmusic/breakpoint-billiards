'use client';

import { useState } from 'react';
import { hardDeletePlayer } from '@/app/actions/admin-actions';
import { useRouter } from 'next/navigation';

export default function HardDeleteButton({ playerId, playerName }: { playerId: string, playerName: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleHardDelete = async () => {
        const confirmed = window.confirm(`DANGER: Are you sure you want to PERMANENTLY delete all data for ${playerName}? This cannot be undone and will remove all their match history and stats.`);

        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const result = await hardDeletePlayer(playerId);
            if (result.success) {
                alert(`Player ${playerName} and all associated data has been permanently removed.`);
                router.refresh();
            } else {
                alert(`Error: ${result.error || 'Failed to delete player.'}`);
            }
        } catch (err) {
            console.error(err);
            alert('An unexpected error occurred.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleHardDelete}
            disabled={isDeleting}
            className="btn bg-error/20 hover:bg-error text-error hover:text-white border-error border font-bold text-xs px-4 py-2 uppercase tracking-wide ml-2"
        >
            {isDeleting ? 'Deleting...' : 'Hard Delete'}
        </button>
    );
}
