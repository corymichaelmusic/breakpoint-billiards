
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Simple semver comparison: returns true if v1 < v2
const isVersionNewer = (v1: string, v2: string) => {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const p1 = v1Parts[i] || 0;
        const p2 = v2Parts[i] || 0;
        if (p1 < p2) return true;
        if (p1 > p2) return false;
    }
    return false;
};

export function useMinimumVersionCheck() {
    const [isUpdateRequired, setIsUpdateRequired] = useState(false);
    const [storeUrl, setStoreUrl] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const { data: settings, error } = await supabase
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['minimum_mobile_version', 'ios_store_url', 'android_store_url']);

                if (error || !settings) {
                    console.error('Failed to fetch version settings:', error);
                    return;
                }

                const config = settings.reduce((acc, curr) => ({
                    ...acc,
                    [curr.key]: curr.value
                }), {} as Record<string, string>);

                const minVersion = config.minimum_mobile_version;
                const currentVersion = Constants.expoConfig?.version || '1.0.0';

                if (minVersion && isVersionNewer(currentVersion, minVersion)) {
                    setIsUpdateRequired(true);
                    setStoreUrl(
                        Platform.OS === 'ios'
                            ? config.ios_store_url
                            : config.android_store_url
                    );
                }
            } catch (e) {
                console.error('Version check failed:', e);
            } finally {
                setLoading(false);
            }
        };

        checkVersion();
    }, []);

    return { isUpdateRequired, storeUrl, loading };
}
