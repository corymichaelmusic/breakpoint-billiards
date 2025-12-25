'use client';

import { useState } from 'react';
import { respondToRescheduleRequest, approveRescheduleRequest, dismissRescheduleRequest } from '@/app/actions/match-actions';

interface Request {
    id: string;
    match_id: string;
    requester_id: string;
    requested_date: string | null;
    reason: string;
    status: 'pending_opponent' | 'pending_operator' | 'approved' | 'rejected';
    created_at: string;
    dismissed?: boolean;
    requester: { full_name: string };
    match: {
        player1: { full_name: string };
        player2: { full_name: string };
    };
}

interface Props {
    requests: Request[];
    userId: string;
    userRole: 'player' | 'operator' | 'admin';
}

export default function RescheduleInbox({ requests, userId, userRole }: Props) {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // Filter out dismissed requests
    const visibleRequests = requests.filter(req => !req.dismissed);

    if (!visibleRequests || visibleRequests.length === 0) return null;

    const handleOpponentResponse = async (requestId: string, approved: boolean) => {
        setLoadingId(requestId);
        await respondToRescheduleRequest(requestId, approved);
        setLoadingId(null);
    };

    const handleOperatorResponse = async (requestId: string, approved: boolean) => {
        setLoadingId(requestId);
        await approveRescheduleRequest(requestId, approved);
        setLoadingId(null);
    };

    const handleDismiss = async (requestId: string) => {
        setLoadingId(requestId);
        await dismissRescheduleRequest(requestId);
        setLoadingId(null);
    };

    return (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--primary)' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Requests</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
                {visibleRequests.map(req => {
                    const isRequester = req.requester_id === userId;
                    const isOperator = userRole === 'operator' || userRole === 'admin';
                    const isOpponent = !isRequester && !isOperator; // Simplified assumption, caller ensures filter

                    // Logic for what to show
                    // If pending_opponent: Show to Opponent (Approve/Reject), Show to Requester (Pending)
                    // If pending_operator: Show to Operator (Approve/Reject), Show to Players (Pending Operator)

                    let action = null;
                    let statusText = '';

                    if (req.status === 'pending_opponent') {
                        if (isRequester) {
                            statusText = 'Waiting for opponent approval';
                        } else if (isOpponent) {
                            statusText = 'Action Required: Opponent Approval';
                            action = (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOpponentResponse(req.id, true)}
                                        disabled={loadingId === req.id}
                                        className="btn"
                                        style={{ background: 'var(--success)', color: '#000', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleOpponentResponse(req.id, false)}
                                        disabled={loadingId === req.id}
                                        className="btn"
                                        style={{ background: 'var(--error)', color: '#fff', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            );
                        }
                    } else if (req.status === 'pending_operator') {
                        if (isOperator) {
                            statusText = 'Action Required: Final Approval';
                            action = (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleOperatorResponse(req.id, true)}
                                        disabled={loadingId === req.id}
                                        className="btn"
                                        style={{ background: 'var(--success)', color: '#000', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleOperatorResponse(req.id, false)}
                                        disabled={loadingId === req.id}
                                        className="btn"
                                        style={{ background: 'var(--error)', color: '#fff', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        Reject
                                    </button>
                                </div>
                            );
                        } else {
                            statusText = 'Waiting for operator approval';
                        }
                    } else {
                        statusText = req.status === 'approved' ? 'Approved' : 'Rejected';
                    }

                    return (
                        <div key={req.id} style={{
                            background: 'var(--background)', padding: '1rem', borderRadius: '0.5rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                    {req.requester.full_name} requested {req.requested_date ? 'reschedule' : 'unlock'}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                    Match: {req.match.player1.full_name} vs {req.match.player2.full_name}
                                </div>
                                {req.requested_date && (
                                    <div style={{ fontSize: '0.9rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                                        New Date: {new Date(req.requested_date).toLocaleString()}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                    "{req.reason}"
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    fontSize: '0.8rem',
                                    marginBottom: '0.5rem',
                                    color: req.status === 'approved' ? 'var(--success)' : (req.status === 'rejected' ? 'var(--error)' : '#aaa')
                                }}>
                                    {statusText}
                                </div>
                                {action}
                                {(req.status === 'approved' || req.status === 'rejected') && isRequester && (
                                    <button
                                        onClick={() => handleDismiss(req.id)}
                                        disabled={loadingId === req.id}
                                        className="btn-link"
                                        style={{
                                            fontSize: '0.8rem',
                                            color: '#666',
                                            textDecoration: 'underline',
                                            cursor: 'pointer',
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            marginTop: '0.5rem'
                                        }}
                                    >
                                        Dismiss
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
