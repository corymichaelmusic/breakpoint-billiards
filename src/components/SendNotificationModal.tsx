'use client';

import { useState } from 'react';
import { sendSessionNotification } from '@/app/actions/notification-actions';

interface SendNotificationModalProps {
    sessionId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function SendNotificationModal({ sessionId, isOpen, onClose }: SendNotificationModalProps) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'sending'>('idle');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !body.trim()) {
            return;
        }

        setStatus('sending');
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('body', body);

            // Server actions must be called directly in client components if imported, 
            // or we could use useFormState, but simpler here.
            const result = await sendSessionNotification(sessionId, title, body);

            if (result.success) {
                setStatus('success');
                setMessage(result.message || `Successfully sent to ${result.count} users.`);
                // Clear form but keep success message for a moment
                setTitle('');
                setBody('');
                setTimeout(() => {
                    onClose();
                    setStatus('idle');
                    setMessage('');
                }, 2000);
            } else {
                setStatus('error');
                setMessage(result.error || 'Failed to send.');
            }
        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMessage(err.message || 'An unexpected error occurred.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
                        <span>📢</span> Send Announcement
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                        disabled={status === 'sending'}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">

                    {status === 'success' ? (
                        <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-xl">✅</span>
                            <div>
                                <p className="font-bold">Success!</p>
                                <p className="text-sm opacity-80">{message}</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Match Canceled, New Schedule..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37] transition-all focus:ring-1 focus:ring-[#D4AF37]/50"
                                    disabled={status === 'sending'}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message</label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Type your message to all session players here..."
                                    rows={4}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37] transition-all resize-none focus:ring-1 focus:ring-[#D4AF37]/50"
                                    disabled={status === 'sending'}
                                />
                            </div>

                            {status === 'error' && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                                    <span>⚠️</span> {message}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors font-bold text-sm uppercase tracking-wide"
                                    disabled={status === 'sending'}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={status === 'sending' || !title.trim() || !body.trim()}
                                    className="flex-1 bg-[#D4AF37] hover:bg-[#b0902c] text-black px-4 py-3 rounded-lg font-bold text-sm uppercase tracking-wide transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {status === 'sending' ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Notification'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

