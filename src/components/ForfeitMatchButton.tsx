'use client';

import { useState } from 'react';
import { forfeitMatch } from '@/app/actions/game-actions';
import { useRouter } from 'next/navigation';

interface ForfeitMatchButtonProps {
    matchId: string;
    leagueId: string;
    player1: { id: string, name: string };
    player2: { id: string, name: string };
    isFinalized: boolean;
    isForfeit: boolean;
}

export default function ForfeitMatchButton({ matchId, leagueId, player1, player2, isFinalized, isForfeit }: ForfeitMatchButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    if (isFinalized && !isForfeit) return null;
    if (isForfeit) {
        return (
            <span className="text-[10px] text-red-500 font-bold uppercase ml-2">Forfeited</span>
        );
    }

    const handleForfeit = async (forfeitedByPlayerId: string, opponentId: string) => {
        if (!confirm(`Are you sure you want to forfeit this match for ${forfeitedByPlayerId === player1.id ? player1.name : player2.name}?`)) return;

        setIsSubmitting(true);
        try {
            const result = await forfeitMatch(matchId, leagueId, forfeitedByPlayerId, opponentId);
            if (result?.error) {
                alert(result.error);
            } else {
                setShowModal(false);
                router.refresh();
            }
        } catch (error) {
            console.error('Error forfeiting match:', error);
            alert('Failed to forfeit match');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-0.5 rounded transition-colors uppercase font-bold"
                disabled={isSubmitting}
            >
                Forfeit
            </button>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-surface border border-white/10 p-6 rounded-xl shadow-2xl max-w-sm w-full">
                        <h3 className="text-xl font-bold text-white mb-4">Forfeit Match</h3>
                        <p className="text-gray-400 text-sm mb-6">Select the player who is forfeiting this match. This action will finalize the match and record a win for the opponent.</p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleForfeit(player1.id, player2.id)}
                                className="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition-colors"
                                disabled={isSubmitting}
                            >
                                {player1.name} Forfeits
                            </button>
                            <button
                                onClick={() => handleForfeit(player2.id, player1.id)}
                                className="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition-colors"
                                disabled={isSubmitting}
                            >
                                {player2.name} Forfeits
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="mt-2 text-gray-500 hover:text-white text-sm transition-colors"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
