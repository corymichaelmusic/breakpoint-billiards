'use client';

import { useState } from 'react';
import { processAccountDeletion, adminCancelDeletionRequest } from "@/app/actions/admin-actions";

interface DeletionRequest {
    id: string;
    user_id: string;
    reason: string | null;
    status: string;
    requested_at: string;
    profiles: {
        full_name: string | null;
        email: string | null;
    } | null;
}

interface DeletionRequestManagerProps {
    requests: DeletionRequest[];
}

export default function DeletionRequestManager({ requests }: DeletionRequestManagerProps) {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

    const handleProcess = async (requestId: string, userName: string) => {
        if (!confirm(`Are you sure you want to permanently delete ${userName}'s account? This will:\n\n• Delete them from Clerk\n• Anonymize their profile data\n• This action cannot be undone.`)) {
            return;
        }

        setProcessingId(requestId);

        try {
            const result = await processAccountDeletion(requestId);

            if (result.error) {
                alert(result.error);
            } else {
                setProcessedIds(prev => new Set([...prev, requestId]));
            }
        } catch (e) {
            console.error("Error processing deletion:", e);
            alert("Failed to process deletion request.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleCancel = async (requestId: string, userName: string) => {
        if (!confirm(`Cancel ${userName}'s account deletion request? They will remain an active user.`)) {
            return;
        }

        setCancellingId(requestId);

        try {
            const result = await adminCancelDeletionRequest(requestId);

            if (result.error) {
                alert(result.error);
            } else {
                setCancelledIds(prev => new Set([...prev, requestId]));
            }
        } catch (e) {
            console.error("Error cancelling deletion:", e);
            alert("Failed to cancel deletion request.");
        } finally {
            setCancellingId(null);
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'pending' && !processedIds.has(r.id) && !cancelledIds.has(r.id));

    if (pendingRequests.length === 0) {
        return null;
    }

    return (
        <div className="card-glass mb-16 border-red-500/30">
            <div className="flex justify-between items-center mb-8 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Account Deletion Requests
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                </h2>
            </div>

            <div className="grid gap-6">
                {pendingRequests.map((request) => {
                    const userName = request.profiles?.full_name || 'Unknown User';
                    const userEmail = request.profiles?.email || 'No email';
                    const requestDate = new Date(request.requested_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    return (
                        <div key={request.id} className="bg-surface/50 p-6 rounded border border-red-500/20 flex flex-col md:flex-row justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                    <span className="font-bold text-lg text-white">{userName}</span>
                                    <span className="text-xs px-2 py-1 rounded font-bold uppercase tracking-wide bg-red-500/20 text-red-400">
                                        Pending Deletion
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400 mb-2">
                                    <span className="text-gray-300">{userEmail}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Requested: {requestDate}
                                </div>
                                {request.reason && (
                                    <div className="mt-3 text-sm text-gray-400 italic bg-black/20 p-3 rounded">
                                        Reason: "{request.reason}"
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-3 min-w-[160px]">
                                <button
                                    onClick={() => handleCancel(request.id, userName)}
                                    disabled={cancellingId === request.id || processingId === request.id}
                                    className="btn w-full !bg-gray-600 hover:!bg-gray-500 text-white font-bold text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancellingId === request.id ? 'Cancelling...' : 'Cancel Request'}
                                </button>
                                <button
                                    onClick={() => handleProcess(request.id, userName)}
                                    disabled={processingId === request.id || cancellingId === request.id}
                                    className="btn w-full !bg-[#dc2626] hover:!bg-[#b91c1c] text-white font-bold text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processingId === request.id ? 'Processing...' : 'Process Deletion'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
