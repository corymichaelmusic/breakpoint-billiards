'use client';

import { useState } from 'react';
import { assignTable, advanceMatch } from '@/app/actions/tournament';

interface MatchControlModalProps {
    match: any;
    tableConfig: string[]; // List of available table names
    onClose: () => void;
}

export default function MatchControlModal({ match, tableConfig, onClose }: MatchControlModalProps) {
    const [loading, setLoading] = useState(false);
    const [selectedTable, setSelectedTable] = useState(match.table_assigned || '');

    // Scoring State
    const [score1, setScore1] = useState(match.score1 || 0);
    const [score2, setScore2] = useState(match.score2 || 0);

    const getDisplayName = (player: any) => player?.guest_name || player?.player?.full_name || 'Bye';

    const handleAssignTable = async (tableName: string) => {
        setLoading(true);
        try {
            await assignTable(match.id, tableName);
            // Don't close, just save state locally if needed or rely on parent re-render
        } catch (e) {
            alert('Failed to assign table');
        } finally {
            setLoading(false);
        }
    };

    const handleEndMatch = async () => {
        if (score1 === score2) return alert("Matches cannot end in a tie.");

        setLoading(true);
        try {
            const winnerId = score1 > score2 ? match.player1_id : match.player2_id;
            await advanceMatch(match.id, winnerId, score1, score2);
            onClose();
        } catch (e) {
            alert('Failed to end match');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
            <div className="bg-[#1f2937] border border-[#D4AF37]/30 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/40">
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: '#D4AF37' }}>Match Control</h3>
                        <p className="text-xs text-gray-400 font-mono">{match.match_position_code}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="transition-colors p-2 hover:brightness-110"
                        aria-label="Close"
                        style={{ color: '#D4AF37' }}
                    >
                        <span className="text-xl font-bold">✕</span>
                    </button>
                </div>

                {/* Matchup Header */}
                <div className="p-6 text-center border-b border-gray-700 bg-gradient-to-b from-[#1f2937] to-black/40">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                            <div className="font-bold text-white text-lg leading-tight">{getDisplayName(match.player1)}</div>
                        </div>
                        <div className="font-mono font-bold text-sm" style={{ color: '#D4AF37' }}>VS</div>
                        <div className="flex-1">
                            <div className="font-bold text-white text-lg leading-tight">{getDisplayName(match.player2)}</div>
                        </div>
                    </div>
                </div>

                {/* Unified Content */}
                <div className="p-6 space-y-8">

                    {/* Section 1: Table Assignment */}
                    <div className="flex flex-col gap-3">
                        <label className="text-xs uppercase tracking-wider font-bold" style={{ color: '#D4AF37' }}>
                            Table Assignment
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="flex-1 bg-black border border-[#D4AF37] text-[#D4AF37] p-2 rounded font-bold outline-none focus:ring-1 focus:ring-[#D4AF37]"
                                disabled={loading}
                            >
                                <option value="" className="text-gray-500">No Table Assigned</option>
                                {tableConfig.map((table) => (
                                    <option key={table} value={table} className="text-[#D4AF37] bg-black">
                                        {table}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => handleAssignTable(selectedTable)}
                                disabled={loading}
                                className="px-4 py-2 font-bold text-xs uppercase rounded transition-all hover:brightness-110"
                                style={{ backgroundColor: '#D4AF37', color: 'black' }}
                            >
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-700 w-full" />

                    {/* Section 2: Scoring */}
                    <div className="flex flex-col gap-4">
                        <label className="text-xs uppercase tracking-wider font-bold text-center" style={{ color: '#D4AF37' }}>
                            Update Score
                        </label>

                        <div className="flex items-center justify-center gap-6">
                            {/* Player 1 Score */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-bold max-w-[100px] truncate text-gray-400">{getDisplayName(match.player1)}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={score1}
                                    onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                                    className="w-16 h-16 bg-black border border-gray-600 rounded-lg text-3xl font-mono text-center text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>

                            <span className="text-xl font-bold text-gray-600">-</span>

                            {/* Player 2 Score */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-bold max-w-[100px] truncate text-gray-400">{getDisplayName(match.player2)}</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={score2}
                                    onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                                    className="w-16 h-16 bg-black border border-gray-600 rounded-lg text-3xl font-mono text-center text-white focus:border-[#D4AF37] outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleEndMatch}
                            disabled={loading || score1 === score2}
                            className="w-full mt-4 py-3 font-bold text-sm uppercase rounded transition-all hover:brightness-110 disabled:opacity-50 disabled:grayscale text-black"
                            style={{ backgroundColor: '#22c55e' }} // Green color (Tailwind green-500)
                        >
                            {loading ? 'Finalizing...' : 'Submit & End Match'}
                        </button>
                    </div>

                </div>

                {/* Footer / Cancel */}
                <div className="p-4 bg-black/20 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="w-full py-2 text-xs uppercase tracking-widest hover:text-white transition-colors"
                        style={{ color: '#D4AF37', opacity: 0.8 }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
