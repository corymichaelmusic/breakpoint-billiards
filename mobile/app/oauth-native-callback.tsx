import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function OAuthNativeCallback() {
    const router = useRouter();

    // This route is hit by the deep link after OAuth.
    // The WebBrowser.maybeCompleteAuthSession() in _layout.tsx usually intercepts this,
    // preventing this component from mounting if successful.
    // However, if it DOES mount, we should redirect to home or login.

    useEffect(() => {
        // If we land here, just kick back to root, _layout will handle auth state redirection.
        router.replace('/');
    }, []);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
            <ActivityIndicator color="#E33629" />
        </View>
    );
}
