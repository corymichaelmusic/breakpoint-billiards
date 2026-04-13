'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createLeagueForOperator } from '@/app/actions/admin-actions';

interface OperatorOption {
    id: string;
    full_name: string | null;
    email: string | null;
}

interface AdminLeagueCreateFormProps {
    approvedOperators: OperatorOption[];
}

const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const SCHEDULE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdminLeagueCreateForm({ approvedOperators }: AdminLeagueCreateFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [primaryOperatorId, setPrimaryOperatorId] = useState('');
    const [additionalOperatorIds, setAdditionalOperatorIds] = useState<string[]>([]);

    const addOperatorRow = () => {
        setAdditionalOperatorIds((current) => [...current, '']);
    };

    const updateAdditionalOperator = (index: number, value: string) => {
        setAdditionalOperatorIds((current) => current.map((operatorId, currentIndex) => (
            currentIndex === index ? value : operatorId
        )));
    };

    const removeAdditionalOperator = (index: number) => {
        setAdditionalOperatorIds((current) => current.filter((_, currentIndex) => currentIndex !== index));
    };

    const getAvailableOperators = (currentValue: string) => {
        const selectedAdditionalIds = new Set(additionalOperatorIds.filter(Boolean));
        return approvedOperators.filter((operator) => {
            if (operator.id === primaryOperatorId && operator.id !== currentValue) {
                return false;
            }

            if (selectedAdditionalIds.has(operator.id) && operator.id !== currentValue) {
                return false;
            }

            return true;
        });
    };

    const handleSubmit = async (formData: FormData) => {
        const operatorId = String(formData.get('operatorId') || '');
        const name = String(formData.get('name') || '');
        const location = String(formData.get('location') || '');
        const city = String(formData.get('city') || '');
        const state = String(formData.get('state') || '');
        const schedule = String(formData.get('schedule') || '');
        const cleanedAdditionalOperatorIds = additionalOperatorIds.map((id) => id.trim()).filter(Boolean);

        if (!operatorId) {
            alert('Please select a primary operator.');
            return;
        }

        startTransition(async () => {
            const result = await createLeagueForOperator(
                operatorId,
                name,
                location,
                city,
                state,
                schedule,
                cleanedAdditionalOperatorIds
            );

            if (result?.error) {
                alert(result.error);
                return;
            }

            setPrimaryOperatorId('');
            setAdditionalOperatorIds([]);
            (document.getElementById('admin-league-create-form') as HTMLFormElement | null)?.reset();
            router.refresh();
        });
    };

    return (
        <form id="admin-league-create-form" action={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">League Name</label>
                    <input name="name" placeholder="e.g. Tarrant County Billiards" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Operator</label>
                    <select
                        name="operatorId"
                        required
                        value={primaryOperatorId}
                        onChange={(event) => setPrimaryOperatorId(event.target.value)}
                        className="input bg-black/50 border-transparent focus:border-primary text-sm py-3"
                    >
                        <option value="">Select an Operator...</option>
                        {approvedOperators.map((op) => (
                            <option key={op.id} value={op.id}>
                                {op.full_name} ({op.email})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Additional Operators</label>
                    <button
                        type="button"
                        onClick={addOperatorRow}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D4AF37]/50 px-3 text-xs font-bold uppercase tracking-[0.12em] text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/10"
                    >
                        + Add Operator
                    </button>
                </div>

                {additionalOperatorIds.length === 0 ? (
                    <p className="text-xs text-gray-500">No additional operators selected.</p>
                ) : (
                    <div className="space-y-3">
                        {additionalOperatorIds.map((operatorId, index) => (
                            <div key={`${index}-${operatorId}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                                <select
                                    value={operatorId}
                                    onChange={(event) => updateAdditionalOperator(index, event.target.value)}
                                    className="input bg-black/50 border-transparent focus:border-primary text-sm py-3"
                                >
                                    <option value="">Select an Operator...</option>
                                    {getAvailableOperators(operatorId).map((op) => (
                                        <option key={op.id} value={op.id}>
                                            {op.full_name} ({op.email})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeAdditionalOperator(index)}
                                    className="inline-flex h-12 items-center justify-center rounded-lg border border-red-500/40 px-4 text-xs font-bold uppercase tracking-[0.12em] text-red-400 transition-colors hover:bg-red-500/10"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Venue</label>
                    <input name="location" placeholder="e.g. Rusty's Billiards" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">City</label>
                    <input name="city" placeholder="e.g. Fort Worth" required className="input bg-black/50 border-transparent focus:border-primary h-12" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">State</label>
                    <select name="state" required className="input bg-black/50 border-transparent focus:border-primary text-sm py-3">
                        <option value="">State</option>
                        {US_STATES.map((state) => (
                            <option key={state} value={state}>{state}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Primary Schedule Day</label>
                    <select name="schedule" required className="input bg-black/50 border-transparent focus:border-primary text-sm py-3" defaultValue="Monday">
                        {SCHEDULE_DAYS.map((day) => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>
                </div>
                <button type="submit" disabled={isPending} className="btn btn-primary h-12 px-8 text-base">
                    {isPending ? 'Creating...' : 'Create League'}
                </button>
            </div>
        </form>
    );
}
