'use client';

import { useState } from "react";
import { adminUpdateUserSubscription } from "@/app/actions/admin-actions";

interface SubscriptionManagerProps {
    userId: string;
    currentStatus: string;
    expiresAt?: string | null;
}

export default function SubscriptionManager({ userId, currentStatus, expiresAt }: SubscriptionManagerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(currentStatus || 'free');

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        if (newStatus === status) return;

        if (!confirm(`Are you sure you want to change this user's subscription to ${newStatus}?`)) {
            e.target.value = status; // Reset
            return;
        }

        setIsLoading(true);
        try {
            setStatus(newStatus);
            const result = await adminUpdateUserSubscription(userId, newStatus);
            if (result?.error) {
                alert(result.error);
                setStatus(currentStatus || 'free'); // Revert
            }
        } catch (err) {
            console.error(err);
            alert("Failed to update subscription");
            setStatus(currentStatus || 'free'); // Revert
        } finally {
            setIsLoading(false);
        }
    };

    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    const displayStatus = (status === 'pro' && !isExpired) ? 'pro' : 'free';

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontWeight: "bold", color: "white" }}>Subscription:</div>
                <select
                    value={status}
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
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                </select>
            </div>
            {expiresAt && (
                <div style={{ fontSize: "0.8rem", color: isExpired ? "orange" : "lightgreen" }}>
                    {isExpired ? `Expired on ${new Date(expiresAt).toLocaleDateString()}` : `Active (Expires: ${new Date(expiresAt).toLocaleDateString()})`}
                </div>
            )}
            {status === 'pro' && !expiresAt && (
                <div style={{ fontSize: "0.8rem", color: "lightgreen" }}>
                    Active (Lifetime / Manual)
                </div>
            )}
        </div>
    );
}
