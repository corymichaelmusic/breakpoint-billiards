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
            <div className="flex gap-2 items-center">
                <span className="text-yellow-500 text-xs font-bold uppercase animate-pulse">Pending Request</span>
                <button
                    disabled={loading}
                    onClick={() => handleStatusChange('active')}
                    className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded font-bold transition-colors"
                >
                    {loading ? '...' : 'Approve'}
                </button>
                <button
                    disabled={loading}
                    onClick={() => handleStatusChange('rejected')}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold transition-colors"
                >
                    {loading ? '...' : 'Reject'}
                </button>
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
