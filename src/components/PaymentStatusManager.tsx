'use client';

import { useState } from 'react';
import { markMatchPaid } from '@/app/actions/league-actions';

interface PaymentStatusManagerProps {
    matchId: string;
    playerId: string;
    status: string;
    playerName: string;
}

export default function PaymentStatusManager({ matchId, playerId, status, playerName }: PaymentStatusManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const isPaid = ['paid_cash', 'paid_online', 'waived'].includes(status);

    let badgeStyle = {
        background: 'var(--surface)',
        color: '#888',
        border: '1px solid var(--border)'
    };
    let label = 'Unpaid';

    if (status === 'paid_cash') {
        badgeStyle = { background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', border: '1px solid var(--success)' };
        label = 'Cash';
    } else if (status === 'waived') {
        badgeStyle = { background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid #666' };
        label = 'Waived';
    } else if (status === 'paid_online') {
        badgeStyle = { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6' };
        label = 'Online';
    }

    const handleUpdate = async (method: 'cash' | 'waived' | 'unpaid') => {
        setIsLoading(true);
        await markMatchPaid(matchId, playerId, method);
        setIsLoading(false);
        setIsOpen(false);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={{
                    background: isPaid ? 'var(--success)' : 'transparent',
                    color: isPaid ? '#000' : '#444',
                    border: isPaid ? '1px solid var(--success)' : '1px solid #444',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0
                }}
                title={label}
            >
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>$</span>
            </button>

            {isOpen && (
                <>
                    <div
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.5rem)',
                        left: 0,
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        zIndex: 10,
                        minWidth: '140px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Set Status
                        </div>
                        <button
                            onClick={() => handleUpdate('cash')}
                            disabled={isLoading}
                            className="hover-bg"
                            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}
                        >
                            <span style={{ marginRight: '0.5rem' }}>💵</span> Paid Cash
                        </button>
                        <button
                            onClick={() => handleUpdate('waived')}
                            disabled={isLoading}
                            className="hover-bg"
                            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.5rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}
                        >
                            <span style={{ marginRight: '0.5rem' }}>🛡️</span> Waive Fee
                        </button>
                        <div style={{ height: '1px', background: '#333', margin: '0.25rem 0' }} />
                        <button
                            onClick={() => handleUpdate('unpaid')}
                            disabled={isLoading}
                            className="hover-bg"
                            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.5rem', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}
                        >
                            <span style={{ marginRight: '0.5rem' }}>✕</span> Mark Unpaid
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
