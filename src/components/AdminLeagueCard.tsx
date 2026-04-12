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
            <div className="border border-border rounded bg-black/20 overflow-hidden">
                <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                        <div className="font-bold text-white text-base">
                            {league.name}
                        </div>
                        <div className="text-sm text-gray-400">
                            {
                                league.league_operators && league.league_operators.length > 0
                                    ? league.league_operators.map((op: any) => op.profiles?.full_name).join(", ")
                                    : league.profiles?.full_name
                            } • {league.location || "No venue"} • {league.schedule_day ? `${league.schedule_day}s` : "No schedule"}
                        </div>
                    </div>
                    <div className="console-toolbar">
                        <button
                            onClick={() => setIsEditOpen(true)}
                            className="btn h-8 text-xs border !border-blue-500/50 !text-blue-400 hover:!bg-blue-500/10 transition-colors"
                        >
                            Edit
                        </button>

                        <button
                            onClick={handleArchive}
                            className="btn h-8 text-xs border !border-yellow-500/50 !text-yellow-400 hover:!bg-yellow-500/10 transition-colors"
                        >
                            Archive
                        </button>

                        <button
                            onClick={handleDelete}
                            className="btn h-8 text-xs border !border-red-500/50 !text-red-400 hover:!bg-red-500/10 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
                <div className="border-t border-border bg-black/10 p-4">
                    {children}
                </div>
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
