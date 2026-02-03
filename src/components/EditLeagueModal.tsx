'use client';

import { useState } from 'react';
import { updateLeague } from '@/app/actions/admin-actions';
import { useRouter } from 'next/navigation';

interface EditLeagueModalProps {
    league: any;
    operators: any[];
    onClose: () => void;
}

export default function EditLeagueModal({ league, operators, onClose }: EditLeagueModalProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            location: formData.get('location') as string,
            city: formData.get('city') as string,
            state: formData.get('state') as string,
            schedule: formData.get('schedule') as string,
            operatorId: formData.get('operatorId') as string,
        };

        const result = await updateLeague(league.id, data);

        setLoading(false);

        if (result?.error) {
            alert(result.error);
        } else {
            onClose();
            router.refresh();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
            <div className="bg-[#1f2937] border border-[#D4AF37]/30 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/40">
                    <h3 className="text-lg font-bold text-[#D4AF37]">Edit League: {league.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-400">League Name</label>
                            <input
                                name="name"
                                defaultValue={league.name}
                                required
                                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-400">Operator</label>
                            <select
                                name="operatorId"
                                defaultValue={league.operator_id}
                                required
                                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                            >
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>
                                        {op.full_name} ({op.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-400">Venue</label>
                            <input
                                name="location"
                                defaultValue={league.location}
                                required
                                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-400">City</label>
                            <input
                                name="city"
                                defaultValue={league.city}
                                required
                                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-gray-400">State</label>
                            <select
                                name="state"
                                defaultValue={league.state}
                                required
                                className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                            >
                                {['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-gray-400">Schedule Day</label>
                        <select
                            name="schedule"
                            defaultValue={league.schedule_day}
                            required
                            className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white focus:border-[#D4AF37] outline-none"
                        >
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="mr-3 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-[#D4AF37] text-black font-bold uppercase text-sm rounded hover:bg-[#b0902c] transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
