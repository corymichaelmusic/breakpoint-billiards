'use client';

import { useState } from 'react';
import { updatePlayerStatus } from '@/app/actions/operator-actions';

interface Props {
    leagueId: string;
    playerId: string;
    currentStatus: string;
}

export default function PlayerStatusControl({ leagueId, playerId, currentStatus }: Props) {
    const [loading, setLoading] = useState(false);

    const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'pending' | 'rejected') => {
        // Confirmation for major changes if needed, but for now quick toggle is often better for operators
        // if (currentStatus === 'pending' && !confirm(`Approve ${newStatus}?`)) return; 

        setLoading(true);
        try {
            const res = await updatePlayerStatus(leagueId, playerId, newStatus);
            if (res.error) {
                alert(res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update status");
        } finally {
            setLoading(false);
        }
    };

    if (currentStatus === 'pending') {
        return (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    Pending Join Request
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={loading}
                        onClick={() => handleStatusChange('active')}
                        className="btn !bg-green-600 !text-white hover:!bg-green-500 !border-green-600 !py-1.5 !px-4 !text-[10px] !rounded shadow-lg shadow-green-900/20"
                    >
                        {loading ? '...' : 'Accept'}
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => handleStatusChange('rejected')}
                        className="btn !bg-red-600/10 !text-red-500 hover:!bg-red-600 hover:!text-white !border-red-600/30 !py-1.5 !px-4 !text-[10px] !rounded hover:shadow-lg hover:shadow-red-900/20"
                    >
                        {loading ? '...' : 'Reject'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <select
            disabled={loading}
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className={`bg-black/20 border text-xs rounded px-2 py-1 font-bold uppercase tracking-wide cursor-pointer
                ${currentStatus === 'active' ? 'text-green-400 border-green-500/30' :
                    currentStatus === 'inactive' ? 'text-gray-400 border-gray-600' :
                        'text-white border-white/20'}`}
        >
            <option value="active" className="bg-gray-900 text-green-400">Active</option>
            <option value="inactive" className="bg-gray-900 text-gray-400">Inactive</option>
            <option value="pending" className="bg-gray-900 text-yellow-500">Pending</option>
            <option value="rejected" className="bg-gray-900 text-red-500">Rejected</option>
        </select>
    );
}
