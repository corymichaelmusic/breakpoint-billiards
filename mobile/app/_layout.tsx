import { Stack, useRouter, useSegments } from "expo-router";
import Header from "../components/Header";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../lib/tokenCache";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import "../global.css";
import { applyRealtimeAuth } from "../lib/realtimeAuth";

// Handle OAuth redirects instantly
WebBrowser.maybeCompleteAuthSession();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env",
  );
}

const InitialLayout = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  // Initial Safety Delay to allow Clerk to process Token
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => setIsReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // Sync Realtime Auth with Clerk Token
  // Sync Realtime Auth with Clerk Token
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (!isSignedIn) {
        if (lastTokenRef.current !== null) {
          await applyRealtimeAuth(null);
          lastTokenRef.current = null;
        }
        return;
      }
      try {
        const token = await getToken({ template: 'supabase' });
        if (active && token !== lastTokenRef.current) {
          await applyRealtimeAuth(token);
          lastTokenRef.current = token || null;
        }
      } catch (e) {
        console.error('[RealtimeAuth] Failed to get token:', e);
      }
    };
    sync();
    return () => { active = false; };
  }, [isSignedIn, getToken]);


  useEffect(() => {
    if (!isLoaded || !isReady) return;

    // Verify segmentation
    const inTabsGroup = segments[0] === "(tabs)";
    const inAuthGroup = segments[0] === "login";
    const inOnboarding = segments.includes("onboarding");

    // console.log("Layout Debug:", { isSignedIn, segments: JSON.stringify(segments), inTabs: inTabsGroup, inAuth: inAuthGroup, inOnb: inOnboarding });

    // Handle Root / Empty Segments
    if (segments.length === 0) {
      if (isSignedIn) {
        console.log("Root -> Home");
        router.replace("/(tabs)");
      } else {
        console.log("Root -> Login");
        router.replace("/login");
      }
      return;
    }

    // Standard Route Guards
    if (!isSignedIn && !inAuthGroup) {
      console.log("Redirecting to Login (Not Signed In)...");
      router.replace("/login");
    } else if (isSignedIn && inAuthGroup) {
      // If user is signed in but on login screen, redirect to home
      console.log("Redirecting to Home (Already Signed In)...");
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments, isReady]);

  if (!isLoaded || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050505" }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }



  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: "#050505" },
      header: () => <Header />
    }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
      <Stack.Screen name="match/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="oauth-native-callback" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
};

export default function Layout() {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
    >
      <InitialLayout />
    </ClerkProvider>
  );
}
