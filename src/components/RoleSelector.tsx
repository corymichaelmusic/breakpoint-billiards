'use client';

import { useState } from "react";
import { adminUpdateUserRole } from "@/app/actions/admin-actions";

interface RoleSelectorProps {
    userId: string;
    currentRole: string;
}

export default function RoleSelector({ userId, currentRole }: RoleSelectorProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [role, setRole] = useState(currentRole);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value;
        if (newRole === role) return;

        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
            e.target.value = role; // Reset
            return;
        }

        setIsLoading(true);
        try {
            setRole(newRole);
            const result = await adminUpdateUserRole(userId, newRole);
            if (result?.error) {
                alert(result.error);
                setRole(currentRole); // Revert
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update role");
            setRole(currentRole); // Revert
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <select
            value={role}
            onChange={handleChange}
            disabled={isLoading}
            style={{
                padding: "0.25rem",
                borderRadius: "0.25rem",
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                cursor: "pointer",
                opacity: isLoading ? 0.7 : 1
            }}
        >
            <option value="player">Player</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
        </select>
    );
}
