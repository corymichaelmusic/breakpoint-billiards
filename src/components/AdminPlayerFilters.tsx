"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface AdminPlayerFiltersProps {
    currentRole: string;
    currentStatus: string;
}

export default function AdminPlayerFilters({ currentRole, currentStatus }: AdminPlayerFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const role = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        params.set("role_filter", role);
        router.push(`/dashboard/admin?${params.toString()}`);
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const status = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        params.set("player_status", status);
        router.push(`/dashboard/admin?${params.toString()}`);
    };

    return (
        <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Role</span>
                <select
                    value={currentRole}
                    onChange={handleRoleChange}
                    className="bg-[#D4AF37] text-black font-bold text-xs uppercase px-4 py-2 rounded focus:outline-none cursor-pointer hover:bg-[#b0902c] transition-colors appearance-none text-center min-w-[120px]"
                >
                    <option value="all">All Roles</option>
                    <option value="player">Player</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div className=" w-px h-6 bg-white/10 mx-2"></div>

            <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Status</span>
                <select
                    value={currentStatus}
                    onChange={handleStatusChange}
                    className={`font-bold text-xs uppercase px-4 py-2 rounded focus:outline-none cursor-pointer transition-colors appearance-none text-center min-w-[120px]
                        ${currentStatus === 'active' ? 'bg-[#22c55e] text-black hover:bg-[#16a34a]' : 'bg-[#ef4444] text-white hover:bg-[#dc2626]'}
                    `}
                >
                    <option value="active" className="text-black">Active</option>
                    <option value="deactivated" className="text-black">Deactivated</option>
                </select>
            </div>
        </div>
    );
}
