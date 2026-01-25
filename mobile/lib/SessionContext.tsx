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
}

interface SessionContextValue {
    sessions: Session[];
    currentSession: Session | null;
    loading: boolean;
    setCurrentSession: (session: Session) => void;
    setPrimarySession: (sessionId: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
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
    const [loading, setLoading] = useState(true);


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
            let token = await getToken({ template: 'supabase' });
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
                        parent_league:parent_league_id(name)
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
                    paymentStatus: m.payment_status
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
    }, [userId, getToken, isLoaded, isSignedIn]);

    // Fetch on mount and when userId changes
    useEffect(() => {
        // No cleanup needed
    }, []);

    useEffect(() => {
        fetchSessions();
        // We depend on userId/isLoaded/isSignedIn implicitly via fetchSessions
        // BUT strict deps on fetchSessions causes loops if useAuth returns unstable refs.
        // We trust fetchSessions execution is safe to re-run if these change.
        // To be safe against "Maximum update depth", we should check if we really need to run.
    }, [userId, isLoaded, isSignedIn]); // <--- CHANGED DEPS: Removed fetchSessions, added primitives

    // Add AppState listener to refresh when coming to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('[SessionContext] App became active. Refreshing sessions...');
                fetchSessions();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [fetchSessions]);

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
    }, [userId, getToken]);

    const refreshSessions = useCallback(async () => {
        setLoading(true);
        await fetchSessions();
    }, [fetchSessions]);

    return (
        <SessionContext.Provider value={{
            sessions,
            currentSession,
            loading,
            setCurrentSession,
            setPrimarySession,
            refreshSessions
        }}>
            {children}
        </SessionContext.Provider>
    );
}
