'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTournament } from "@/app/actions/tournament";

export default function TournamentCard({ tournament }: { tournament: any }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCardClick = () => {
        router.push(`/dashboard/tournaments/${tournament.id}`);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this tournament? This cannot be undone.')) return;

        setIsDeleting(true);
        try {
            await deleteTournament(tournament.id);
        } catch (error) {
            alert('Failed to delete');
            setIsDeleting(false);
        }
    };

    if (isDeleting) return null;

    return (
        <div
            onClick={handleCardClick}
            className="card-glass hover-effect p-6 flex justify-between items-center cursor-pointer transition-all border border-border hover:border-primary/30 group"
        >
            <div>
                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                    {tournament.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <span className="capitalize px-2 py-0.5 rounded bg-surface border border-border">
                        {tournament.game_type === '8ball' ? '8-Ball' : '9-Ball'}
                    </span>
                    <span className={`capitalize px-2 py-0.5 rounded border ${tournament.status === 'active' ? 'bg-green-900/30 border-green-500/50 text-green-400' :
                        tournament.status === 'completed' ? 'bg-gray-800 border-gray-700 text-gray-400' :
                            tournament.status === 'archived' ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400' :
                                'bg-blue-900/30 border-blue-500/50 text-blue-400'
                        }`}>
                        {tournament.status}
                    </span>
                    <span>
                        {new Date(tournament.created_at).toLocaleDateString()}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Action Buttons (Inline) */}
                <div className="flex gap-2 mr-6 border-r border-white/10 pr-6">
                    <button
                        onClick={handleDelete}
                        className="p-3 rounded-2xl transition-all shadow-lg hover:brightness-115 active:scale-95"
                        style={{
                            background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                            color: '#ffffff',
                            border: '4px solid #b91c1c', // Dark Red Border
                            marginLeft: 'auto',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)' // Drop shadow + Top Highlight
                        }}
                        title="Delete"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                        >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>

                <span className="text-gray-500 group-hover:text-white transition-colors text-sm whitespace-nowrap">
                    Manage &rarr;
                </span>
            </div>
        </div>
    );
}
