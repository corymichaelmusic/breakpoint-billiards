import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from "@supabase/supabase-js";
import { useAuth } from '@clerk/clerk-expo';

interface SubscriptionContextType {
    isPro: boolean;
    loading: boolean;
    refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userId, getToken } = useAuth();
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchSubscriptionStatus = async () => {
        try {
            if (!userId) {
                setIsPro(false);
                setLoading(false);
                return;
            }

            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            const { data, error } = await supabase
                .from('profiles')
                .select('subscription_status')
                .eq('id', userId)
                .single();

            if (data) {
                setIsPro(data.subscription_status === 'pro');
            }
        } catch (e) {
            console.error("Error fetching subscription status:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptionStatus();
    }, [userId]);

    return (
        <SubscriptionContext.Provider value={{ isPro, loading, refreshSubscription: fetchSubscriptionStatus }}>
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};
