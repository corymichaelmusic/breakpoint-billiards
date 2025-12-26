import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type Fetcher = () => Promise<void> | void

export function useMatchBroadcast(id: string, fetchMatchData: Fetcher) {
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const failuresRef = useRef(0)
    const firstFailureAtRef = useRef(0)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const MAX_FAILURES = 5
    const WINDOW_MS = 15000
    const POLLING_INTERVAL_MS = 5000
    const DEBOUNCE_MS = 100

    const topic = `match:${id}:changes`

    useEffect(() => {
        let cancelled = false

        // Reset failure tracking on id change/mount
        failuresRef.current = 0
        firstFailureAtRef.current = 0

        const performFetch = () => {
            if (cancelled) return
            try {
                const p = fetchMatchData()
                if (p && typeof (p as Promise<void>).then === 'function') {
                    ; (p as Promise<void>).catch((e) => console.warn('fetchMatchData error', e))
                }
            } catch (e) {
                console.warn('fetchMatchData error', e)
            }
        }

        const safeFetch = () => {
            if (cancelled) return
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                performFetch()
            }, DEBOUNCE_MS)
        }

        const startPolling = () => {
            // If already polling, do nothing (idempotent)
            if (pollingRef.current) return;
            console.log('[Realtime] Switching to polling mode');
            performFetch(); // Initial fetch immediately
            pollingRef.current = setInterval(safeFetch, POLLING_INTERVAL_MS);
        }

        const existing = supabase.getChannels().find((c) => c.topic === topic)
        if (existing) {
            channelRef.current = existing
            return () => { }
        }

        const channel = supabase.channel(topic, {
            config: { private: false }
        })
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'INSERT' }, () => {
                safeFetch();
            })
            .on('broadcast', { event: 'UPDATE' }, () => {
                safeFetch();
            })
            .on('broadcast', { event: 'DELETE' }, () => {
                safeFetch();
            })
            .subscribe((status) => {
                // console.log('[Realtime] status:', status)

                if (status === 'SUBSCRIBED') {
                    safeFetch();
                    failuresRef.current = 0;
                    firstFailureAtRef.current = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    // STOP RECURSION: If we are already polling, ignore further channel errors/closure
                    if (pollingRef.current) return;

                    const now = Date.now()
                    if (firstFailureAtRef.current === 0 || now - firstFailureAtRef.current > WINDOW_MS) {
                        firstFailureAtRef.current = now
                        failuresRef.current = 1
                    } else {
                        failuresRef.current++
                    }

                    if (failuresRef.current >= MAX_FAILURES) {
                        // CRITICAL FIX: Set polling flag BEFORE cleanup to prevent re-entry loops
                        startPolling();

                        console.warn('[Realtime] Circuit breaker tripped. Falling back to polling.');
                        if (channelRef.current) {
                            supabase.removeChannel(channelRef.current);
                            channelRef.current = null;
                        }
                    }
                }
            })

        return () => {
            cancelled = true
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                debounceRef.current = null
            }
        }
    }, [id, topic, fetchMatchData])
}
