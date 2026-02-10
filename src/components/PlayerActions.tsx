'use client';

import { useState } from 'react';
import { deactivatePlayer, reactivatePlayer, deletePlayer, softDeletePlayer } from "@/app/actions/admin-actions";

interface PlayerActionsProps {
    playerId: string;
    isActive: boolean;
}

export default function PlayerActions({ playerId, isActive }: PlayerActionsProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleDeactivate = async () => {
        if (!confirm("Are you sure you want to deactivate this player? They will not be able to log in.")) return;
        setIsLoading(true);
        try {
            const result = await deactivatePlayer(playerId);
            if (result?.error) alert(result.error);
        } catch (e) {
            console.error(e);
            alert("Error deactivating player");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSoftDelete = async () => {
        if (!confirm("Are you sure you want to SOFT DELETE this player? They will be marked as inactive and sent to the deleted accounts pool.")) return;
        setIsLoading(true);
        try {
            const result = await softDeletePlayer(playerId);
            if (result?.error) alert(result.error);
        } catch (e) {
            console.error(e);
            alert("Error soft deleting player");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReactivate = async () => {
        setIsLoading(true);
        try {
            const result = await reactivatePlayer(playerId);
            if (result?.error) alert(result.error);
        } catch (e) {
            console.error(e);
            alert("Error reactivating player");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to PERMANENTLY delete this player from the deactivated pool? This action cannot be undone.")) return;
        setIsLoading(true);
        try {
            const result = await deletePlayer(playerId);
            if (result?.error) alert(result.error);
        } catch (e) {
            console.error(e);
            alert("Error deleting player");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <span style={{ fontSize: "0.8rem", color: "#888" }}>Processing...</span>;
    }

    if (isActive) {
        return (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={handleDeactivate}
                    className="btn"
                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "#ff4444", color: "#fff", border: "none", cursor: "pointer" }}
                >
                    Deactivate
                </button>
                <button
                    onClick={handleSoftDelete}
                    className="btn"
                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--error)", color: "#fff", border: "none", cursor: "pointer" }}
                >
                    Soft Delete
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
                onClick={handleReactivate}
                className="btn"
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--success)", color: "#000", border: "none", cursor: "pointer" }}
            >
                Reactivate
            </button>
            <button
                onClick={handleDelete}
                className="btn"
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", background: "var(--error)", color: "#fff", border: "none", cursor: "pointer" }}
            >
                Delete
            </button>
        </div>
    );
}
