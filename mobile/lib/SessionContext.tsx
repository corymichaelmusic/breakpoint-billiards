import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { createClient } from '@supabase/supabase-js';

export interface Session {
    id: string;
    name: string;
    status: string;
    type: string;
    isPrimary: boolean;
    parentLeagueName?: string;
    paymentStatus?: string;
    location?: string;
    city?: string;
    scheduleDay?: string;
}

interface SessionContextValue {
    sessions: Session[];
    currentSession: Session | null;
    unreadCount: number;
    lastReadAt: string | null;
    loading: boolean;
    setCurrentSession: (session: Session) => void;
    setPrimarySession: (sessionId: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
    markAsRead: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}

interface SessionProviderProps {
    children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
    const { userId, getToken, isLoaded, isSignedIn } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastReadAt, setLastReadAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Stable references for unstable auth/state to prevent callback cycles
    const getTokenRef = React.useRef(getToken);
    const currentSessionIdRef = React.useRef(currentSession?.id);
    const unreadCountRef = React.useRef(unreadCount);

    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    useEffect(() => {
        currentSessionIdRef.current = currentSession?.id;
    }, [currentSession?.id]);

    useEffect(() => {
        unreadCountRef.current = unreadCount;
    }, [unreadCount]);


    const fetchSessions = useCallback(async () => {
        if (!isLoaded) return;

        console.log(`[SessionContext] fetchSessions called. SignedIn: ${isSignedIn}, UserID: ${userId}`);


        // Only set loading if not already loading to avoid unnecessary renders
        // causing possible loops if deps are unstable.
        // Actually, we can just set it. The real fix is the useEffect deps.
        setLoading(true);

        if (!isSignedIn) {
            // Truly signed out
            setSessions([]);
            setCurrentSessionState(null);
            setLoading(false);
            return;
        }

        if (!userId) {
            // Signed in but userId not ready? 
            console.warn('[SessionContext] SignedIn is true but userId is missing. Aborting fetch.');
            setLoading(false);
            return;
        }

        try {
            // Retry logic for token
            let token = await getTokenRef.current({ template: 'supabase' });
            if (!token) {
                console.log('[SessionContext] No token available yet, waiting...');
                // Do not set loading false. Wait for re-render or effect.
                return;
            }

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { data: memberships, error } = await supabase
                .from('league_players')
                .select(`
                    league_id,
                    payment_status,
                    is_primary,
                    leagues!inner (
                        id,
                        name,
                        type,
                        status,
                        location,
                        city,
                        schedule_day,
                        parent_league:parent_league_id(name, location, city)
                    )
                `)
                .eq('player_id', userId)
                .eq('leagues.type', 'session')
                .in('leagues.status', ['active', 'setup'])
                .eq('status', 'active') // Only actual members, not pending requests
                .order('joined_at', { ascending: false });

            if (error) {
                console.error('[SessionContext] Error fetching sessions:', error);
                setLoading(false);
                return;
            }

            if (!memberships || memberships.length === 0) {
                setSessions([]);
                setCurrentSessionState(null);
                setLoading(false);
                return;
            }

            // Success - Reset
            // retryCount removed

            // Map to Session objects
            const sessionList: Session[] = memberships.map((m: any) => {
                const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
                return {
                    id: league.id,
                    name: league.name,
                    status: league.status,
                    type: league.type,
                    isPrimary: m.is_primary || false,
                    parentLeagueName: league.parent_league?.name,
                    paymentStatus: m.payment_status,
                    location: league.parent_league?.location || league.location,
                    city: league.parent_league?.city || league.city,
                    scheduleDay: league.schedule_day
                };
            });

            setSessions(sessionList);

            // Auto-select: Primary session first, else first in list
            const primarySession = sessionList.find(s => s.isPrimary);
            const defaultSession = primarySession || sessionList[0];

            // Only set current if not already set (preserve user selection)
            if (!currentSession) {
                setCurrentSessionState(defaultSession);
            }

            setLoading(false);
        } catch (e) {
            console.error('[SessionContext] Exception:', e);
            setLoading(false);
        }
    }, [userId, isLoaded, isSignedIn]); // Removed getToken

    const refreshUnreadCount = useCallback(async () => {
        const leagueId = currentSessionIdRef.current;
        if (!userId || !leagueId) return;

        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            if (!token) return;

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            // 1. Get last_read_at for this user/league
            const { data: readStatus } = await supabase
                .from('chat_read_status')
                .select('last_read_at')
                .eq('user_id', userId)
                .eq('league_id', leagueId)
                .single();

            const lastReadAtValue = readStatus?.last_read_at || new Date(0).toISOString();
            setLastReadAt(lastReadAtValue);

            // 2. Count messages created after lastReadAt
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('league_id', leagueId)
                .gt('created_at', lastReadAtValue)
                .neq('user_id', userId); // Don't count own messages

            if (!error) {
                setUnreadCount(count || 0);
            }
        } catch (e) {
            console.error('[SessionContext] Error refreshing unread count:', e);
        }
    }, [userId]); // Removed getToken, currentSession?.id

    const markAsRead = useCallback(async () => {
        const leagueId = currentSessionIdRef.current;
        if (!userId || !leagueId) {
            console.log('[SessionContext] markAsRead skipped: missing userId or leagueId');
            return;
        }

        console.log(`[SessionContext] markAsRead starting for league: ${leagueId}`);
        const now = new Date().toISOString();

        // 1. Optimistically clear unread count for immediate UI feedback
        setUnreadCount(0);
        setLastReadAt(now);

        try {
            const token = await getTokenRef.current({ template: 'supabase' });
            if (!token) {
                console.warn('[SessionContext] markAsRead: No token available');
                return;
            }

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { error } = await supabase
                .from('chat_read_status')
                .upsert({
                    user_id: userId,
                    league_id: leagueId,
                    last_read_at: now
                }, { onConflict: 'user_id,league_id' });

            if (error) {
                console.error('[SessionContext] Error marking as read in Supabase:', error);
                // We don't necessarily want to revert optimistic update here 
                // because a retry on next focus will handle it, but we log it.
            } else {
                console.log('[SessionContext] markAsRead successful in Supabase');
            }
        } catch (e) {
            console.error('[SessionContext] Exception in markAsRead:', e);
        }
    }, [userId]); // Removed unreadCount dependency, uses ref instead

    // Refresh unread count when session changes
    useEffect(() => {
        refreshUnreadCount();
    }, [currentSession?.id, userId]);

    // Initial fetch on mount or when auth state changes
    useEffect(() => {
        fetchSessions();
    }, [userId, isLoaded, isSignedIn, fetchSessions]);

    // Add AppState listener to refresh when coming to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('[SessionContext] App became active. Refreshing...');
                fetchSessions();
                refreshUnreadCount();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [fetchSessions, refreshUnreadCount]);

    const setCurrentSession = useCallback((session: Session) => {
        setCurrentSessionState(session);
    }, []);

    const setPrimarySession = useCallback(async (sessionId: string) => {
        if (!userId) return;

        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            // First, unset all primary for this user
            await supabase
                .from('league_players')
                .update({ is_primary: false })
                .eq('player_id', userId);

            // Then set the new primary
            const { error } = await supabase
                .from('league_players')
                .update({ is_primary: true })
                .eq('player_id', userId)
                .eq('league_id', sessionId);

            if (error) {
                console.error('[SessionContext] Error setting primary:', error);
                return;
            }

            // Update local state
            setSessions(prev => prev.map(s => ({
                ...s,
                isPrimary: s.id === sessionId
            })));

            console.log('[SessionContext] Primary session set to:', sessionId);
        } catch (e) {
            console.error('[SessionContext] Exception setting primary:', e);
        }
    }, [userId]); // Removed getToken

    const refreshSessions = useCallback(async () => {
        setLoading(true);
        await fetchSessions();
    }, [fetchSessions]);

    return (
        <SessionContext.Provider value={{
            sessions,
            currentSession,
            unreadCount,
            lastReadAt,
            loading,
            setCurrentSession,
            setPrimarySession,
            refreshSessions,
            refreshUnreadCount,
            markAsRead
        }}>
            {children}
        </SessionContext.Provider>
    );
}

