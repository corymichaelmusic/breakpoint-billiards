import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export interface TokenCache {
    getToken: (key: string) => Promise<string | undefined | null>
    saveToken: (key: string, token: string) => Promise<void>
    clearToken?: (key: string) => void
}

const createTokenCache = (): TokenCache => {
    return {
        getToken: async (key: string) => {
            try {
                const item = await SecureStore.getItemAsync(key);
                console.log(`[TokenCache] GET ${key} = ${item ? 'FOUND' : 'NULL'}`);
                return item;
            } catch (error) {
                console.error('[TokenCache] SecureStore Get Error:', error);
                // If we can't read it, delete it to be safe
                await SecureStore.deleteItemAsync(key).catch((e) => console.log("Delete failed", e));
                return null;
            }
        },
        saveToken: async (key: string, token: string) => {
            try {
                await SecureStore.setItemAsync(key, token);
                console.log(`[TokenCache] SAVE ${key} SUCCESS`);
            } catch (e) {
                console.error('[TokenCache] SecureStore Write Error:', e);
            }
        },
        clearToken: async (key: string) => {
            try {
                await SecureStore.deleteItemAsync(key);
                console.log(`[TokenCache] CLEAR ${key}`);
            } catch (e) {
                console.error('[TokenCache] SecureStore Clear Error:', e);
            }
        }
    }
}

// SecureStore is not supported on the web
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined

