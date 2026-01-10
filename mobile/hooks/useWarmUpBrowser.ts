
import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";

export const useWarmUpBrowser = () => {
    useEffect(() => {
        // Warm up the browser for better UX on iOS/Android
        // Wrap in try/catch because this can fail on some Android devices/simulators
        // if no compatible browser is found (e.g. no Chrome/Play Store).
        try {
            void WebBrowser.warmUpAsync();
        } catch (e) {
            console.warn("WarmUpAsync failed (safe to ignore):", e);
        }

        return () => {
            try {
                void WebBrowser.coolDownAsync();
            } catch (e) {
                // Ignore coolDown errors
            }
        };
    }, []);
};
