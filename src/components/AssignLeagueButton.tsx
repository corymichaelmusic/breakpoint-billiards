'use client';

import { useState } from "react";
import { assignOperatorToLeague } from "@/app/actions/admin-actions";

interface League {
    id: string;
    name: string;
}

interface AssignLeagueButtonProps {
    operatorId: string;
    availableLeagues: League[];
}

export default function AssignLeagueButton({ operatorId, availableLeagues }: AssignLeagueButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedLeague) return;
        setLoading(true);

        const result = await assignOperatorToLeague(operatorId, selectedLeague);

        setLoading(false);
        if (result.error) {
            alert(result.error);
        } else {
            setIsOpen(false);
            setSelectedLeague("");
            // Ideally toast success
            alert("Operator assigned successfully!");
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn !bg-white !text-black !border-white hover:!bg-gray-200 font-bold text-xs px-3 py-2 uppercase tracking-wide"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'white' }}
            >
                Assign League
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#121212] border border-white/10 p-6 rounded-lg shadow-2xl w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Assign Operator to League</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Select League</label>
                                <select
                                    className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-[#D4AF37] outline-none"
                                    value={selectedLeague}
                                    onChange={(e) => setSelectedLeague(e.target.value)}
                                >
                                    <option value="">Choose a league...</option>
                                    {availableLeagues.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-white hover:text-gray-300 transition-colors uppercase font-bold text-xs tracking-wide"
                                    disabled={loading}
                                    style={{ color: 'white' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={!selectedLeague || loading}
                                    className="btn !bg-[#D4AF37] !text-black hover:!bg-[#b0902c] font-bold px-4 py-2 uppercase tracking-wide"
                                    style={{ backgroundColor: '#D4AF37', color: 'black' }}
                                >
                                    {loading ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
