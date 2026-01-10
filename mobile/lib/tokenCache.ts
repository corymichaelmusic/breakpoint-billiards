import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

export interface TokenCache {
    getToken: (key: string) => Promise<string | undefined | null>
    saveToken: (key: string, token: string) => Promise<void>
    clearToken?: (key: string) => void
}

const createTokenCache = (): TokenCache => {
    return {
        getToken: async (key: string) => {
            // 1. Try SecureStore
            try {
                const item = await SecureStore.getItemAsync(key);
                if (item) {
                    return item;
                }
            } catch (error) {
                // Ignore parsing errors, move to fallback
                console.warn('[TokenCache] SecureStore Error (Ignored):', error);
            }

            // 2. Try AsyncStorage (Fallback)
            try {
                const item = await AsyncStorage.getItem(key);
                if (item) {
                    console.log(`[TokenCache] HIT AsyncStorage: ${key}`);
                    return item;
                }
            } catch (error) {
                console.error('[TokenCache] AsyncStorage Get Error:', error);
            }

            console.log(`[TokenCache] MISS (key: ${key})`);
            return null;
        },
        saveToken: async (key: string, token: string) => {
            // 1. Write to SecureStore
            try {
                await SecureStore.setItemAsync(key, token);
            } catch (error) {
                console.warn('[TokenCache] SecureStore Write Error:', error);
            }

            // 2. ALWAYS Write to AsyncStorage (Backup)
            try {
                await AsyncStorage.setItem(key, token);
                console.log(`[TokenCache] WROTE AsyncStorage: ${key}`);
            } catch (e) {
                console.error('[TokenCache] AsyncStorage Write Error:', e);
            }
        },
        clearToken: async (key: string) => {
            SecureStore.deleteItemAsync(key).catch(err => console.warn('[TokenCache] SecureStore Delete Error', err));
            AsyncStorage.removeItem(key).catch(err => console.warn('[TokenCache] AsyncStorage Delete Error', err));
        }
    }
}

// SecureStore is not supported on the web
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined
