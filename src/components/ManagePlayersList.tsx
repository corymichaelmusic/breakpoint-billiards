'use client';

import { useState } from 'react';
import { addPlayerToSession, removePlayerFromSession, togglePlayerFee } from '@/app/actions/league-actions';
import { useRouter } from 'next/navigation';

type Player = {
    id: string;
    name: string;
    email: string;
    isSelected: boolean;
    paymentStatus: string;
};

type Props = {
    sessionId: string;
    players: Player[];
    isSessionActive: boolean;
};

export default function ManagePlayersList({ sessionId, players, isSessionActive }: Props) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleToggleSelect = async (player: Player) => {
        if (isSessionActive) return;
        setLoadingId(player.id);
        if (player.isSelected) {
            await removePlayerFromSession(sessionId, player.id);
        } else {
            await addPlayerToSession(sessionId, player.id);
        }
        setLoadingId(null);
        router.refresh();
    };

    const handleToggleFee = async (player: Player) => {
        if (!player.isSelected) return;
        setLoadingId(player.id);
        const newStatus = player.paymentStatus === 'paid' ? false : true;
        await togglePlayerFee(sessionId, player.id, newStatus);
        setLoadingId(null);
        router.refresh();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {players.map(player => (
                <div
                    key={player.id}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        borderBottom: '1px solid var(--border)',
                        background: player.isSelected ? 'var(--surface-hover)' : 'transparent'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {!isSessionActive && player.paymentStatus !== 'paid' && (
                            <input
                                type="checkbox"
                                checked={player.isSelected}
                                onChange={() => handleToggleSelect(player)}
                                disabled={loadingId === player.id}
                                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                            />
                        )}
                        {player.paymentStatus === 'paid' && (
                            <div style={{ width: '1.2rem', height: '1.2rem' }} /> /* Spacer */
                        )}
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{player.name}</div>
                            <div style={{ fontSize: '0.9rem', color: '#888' }}>{player.email}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {player.isSelected && (
                            <button
                                onClick={() => handleToggleFee(player)}
                                disabled={loadingId === player.id}
                                title={player.paymentStatus === 'paid' ? "Mark as Unpaid" : "Mark as Paid"}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    borderRadius: '50%',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    borderRadius: '50%',
                                    border: `2px solid ${player.paymentStatus === 'paid' ? 'var(--success)' : '#ccc'}`,
                                    color: player.paymentStatus === 'paid' ? 'var(--success)' : '#ccc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem',
                                    boxShadow: player.paymentStatus === 'paid' ? '0 0 10px rgba(76, 175, 80, 0.3)' : 'none'
                                }}>
                                    $
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {players.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                    No players found.
                </div>
            )}
        </div>
    );
}
