'use client';

import { useState } from 'react';
import { archiveLeague, deleteLeague } from '@/app/actions/admin-actions';
import EditLeagueModal from './EditLeagueModal';
import DeleteSessionButton from './DeleteSessionButton';
import SessionFeeToggle from './SessionFeeToggle';

interface AdminLeagueCardProps {
    league: any;
    operators: any[];
    children?: React.ReactNode; // For SuspenseSessions
}

export default function AdminLeagueCard({ league, operators, children }: AdminLeagueCardProps) {
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this league? This action cannot be undone.")) {
            await deleteLeague(league.id);
        }
    };

    const handleArchive = async () => {
        if (confirm("Are you sure you want to archive this league?")) {
            await archiveLeague(league.id);
        }
    };

    return (
        <>
            <div className="p-6 border border-transparent rounded bg-surface/30">
                <div className="flex justify-between items-center mb-4">
                    <div className="font-bold text-white text-lg">
                        {league.name} <span className="font-normal text-gray-500">- {
                            league.league_operators && league.league_operators.length > 0
                                ? league.league_operators.map((op: any) => op.profiles?.full_name).join(", ")
                                : league.profiles?.full_name
                        } ({league.location})</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-white uppercase font-bold tracking-wider mr-2">{league.schedule_day}s</div>

                        <button
                            onClick={() => setIsEditOpen(true)}
                            className="btn h-8 text-[10px] uppercase tracking-widest px-3 border !border-blue-500/50 !text-blue-500 hover:!bg-blue-500/10 hover:!text-blue-400 hover:!border-blue-400 transition-colors"
                        >
                            Edit
                        </button>

                        <button
                            onClick={handleArchive}
                            className="btn h-8 text-[10px] uppercase tracking-widest px-3 border !border-yellow-500/50 !text-yellow-500 hover:!bg-yellow-500/10 hover:!text-yellow-400 hover:!border-yellow-400 transition-colors"
                        >
                            Archive
                        </button>

                        <button
                            onClick={handleDelete}
                            className="btn h-8 text-[10px] uppercase tracking-widest px-3 border !border-red-500/50 !text-red-500 hover:!bg-red-500/10 hover:!text-red-400 hover:!border-red-400 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
                {children}
            </div>

            {isEditOpen && (
                <EditLeagueModal
                    league={league}
                    operators={operators}
                    onClose={() => setIsEditOpen(false)}
                />
            )}
        </>
    );
}
