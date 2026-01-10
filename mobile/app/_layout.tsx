import "../ignoreWarnings";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Header from "../components/Header";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../lib/tokenCache";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import "../global.css";
import { applyRealtimeAuth } from "../lib/realtimeAuth";

// Handle OAuth redirects instantly
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  // Ignore error on Android if browser is missing
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env",
  );
}

const InitialLayout = () => {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoaded) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const inAuthGroup = segments[0] === "login";

    console.log(`[Layout] Check. SignedIn: ${isSignedIn}, Loaded: ${isLoaded}, Segment: ${segments[0]}, Pathname: ${pathname}`);

    if (!isSignedIn && !inAuthGroup) {
      // Loop protection: if we think we are not in auth group, but pathname is /login, stop.
      if (pathname === "/login") {
        console.log("[Layout] Already on /login (path check). Skipping redirect.");
        return;
      }

      console.log(`[Layout] Redirecting to Login. SignedIn: ${isSignedIn}, Segment: ${segments[0]}`);
      router.replace("/login");
    } else if (isSignedIn && inAuthGroup) {
      console.log(`[Layout] Redirecting to Home. SignedIn: ${isSignedIn}, Segment: ${segments[0]}`);
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments, pathname]);

  if (!isLoaded) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={{ color: 'white', marginTop: 20 }}>Initializing Auth...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerShown: false,
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
    // 2. TOKEN CACHE REMOVED
    <SafeAreaProvider>
      <ClerkProvider
        publishableKey={publishableKey}
        tokenCache={tokenCache}
      >
        <InitialLayout />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
