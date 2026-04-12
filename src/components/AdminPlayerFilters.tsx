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
        <div className="console-toolbar">
            <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Role</span>
                <select
                    value={currentRole}
                    onChange={handleRoleChange}
                    className="console-input font-bold text-xs uppercase cursor-pointer min-w-[120px]"
                >
                    <option value="all">All Roles</option>
                    <option value="player">Player</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Status</span>
                <select
                    value={currentStatus}
                    onChange={handleStatusChange}
                    className="console-input font-bold text-xs uppercase cursor-pointer min-w-[140px]"
                >
                    <option value="active" className="text-black">Active</option>
                    <option value="deactivated" className="text-black">Deactivated</option>
                </select>
            </div>
        </div>
    );
}
