import 'react-native-get-random-values';
import "../ignoreWarnings";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Header from "../components/Header";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../lib/tokenCache";
import { useEffect, useRef } from "react";
import { View, ActivityIndicator, Text, StatusBar, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import "../global.css";
import { applyRealtimeAuth } from "../lib/realtimeAuth";
import { authSignal } from "../lib/authSignal";
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { SessionProvider } from "../lib/SessionContext";
import { SubscriptionProvider } from "../lib/SubscriptionContext";
import { useMinimumVersionCheck } from "../hooks/useMinimumVersionCheck";
import ForceUpdateScreen from "../components/ForceUpdateScreen";

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
  // Track previous signed-in state to detect transitions
  const wasSignedInRef = useRef<boolean | undefined>(undefined);

  // Reset the signal when Clerk finally catches up
  useEffect(() => {
    if (isSignedIn && authSignal.justLoggedIn) {
      console.log("[Layout] Clerk caught up! Resetting signal.");
      authSignal.justLoggedIn = false;
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        // Set root view background to dark to prevent white flashes or underlays
        SystemUI.setBackgroundColorAsync("#121212");

        // Set to dark color to match app theme
        NavigationBar.setBackgroundColorAsync("#121212");
        // Ensure icons are light-colored
        NavigationBar.setButtonStyleAsync("light");
        // Hide fine separator line by matching color (or making transparent if supported)
        NavigationBar.setBorderColorAsync("#121212");
      } catch (e) {
        console.log("Failed to configure Android navigation bar:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;


    const currentSegment = segments.length > 0 ? segments[0] : null;
    const inTabsGroup = currentSegment === "(tabs)";
    const onLoginPage = currentSegment === "login" || pathname === "/login";

    // Detect auth state transition
    const justSignedIn = wasSignedInRef.current === false && isSignedIn === true;
    const justSignedOut = wasSignedInRef.current === true && isSignedIn === false;

    console.log(`[Layout] Check. SignedIn: ${isSignedIn}, Segment: ${currentSegment}, Pathname: ${pathname}, JustSignedIn: ${justSignedIn}`);

    // Update ref for next comparison
    wasSignedInRef.current = isSignedIn;

    // Handle auth state transitions
    if (justSignedIn && onLoginPage) {
      // User just signed in and is still on login page - navigate to tabs
      console.log("[Layout] Just signed in! Navigating to tabs...");
      router.replace("/(tabs)");
      return;
    }

    if (justSignedOut && inTabsGroup) {
      // User just signed out and is on protected page - go to login
      console.log("[Layout] Just signed out! Navigating to login...");
      router.replace("/login");
      return;
    }

    // Also handle the case where we land on wrong page (app startup, deep link, etc)
    // Debounced redirection for not signed in state
    if (!isSignedIn && inTabsGroup) {
      console.log("[Layout] Not signed in but in tabs - ALLOWING PASSAGE (Guard Relaxed for Release Mode safety)");
      // We do NOT redirect to login here. We allow the navigation to stick.
      // The user might see empty data if RLS blocks them, but they won't be kicked out.
      return;
    } else if (isSignedIn && onLoginPage) {
      // This handles the case where app opens and user is already signed in
      console.log("[Layout] Signed in but on login page - redirecting to tabs");
      router.replace("/(tabs)");
    } else if (currentSegment === null && pathname === "/") {
      console.log("[Layout] Root path - redirecting based on auth state");
      if (isSignedIn) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    }
  }, [isSignedIn, isLoaded, segments, pathname]);

  // Perform version check
  const { isUpdateRequired, storeUrl, loading: versionCheckLoading } = useMinimumVersionCheck();

  if (!isLoaded || versionCheckLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={{ color: 'white', marginTop: 20 }}>Initializing...</Text>
      </View>
    );
  }

  if (isUpdateRequired) {
    return <ForceUpdateScreen storeUrl={storeUrl} />;
  }

  // TEMPORARY DEBUG OVERLAY
  // Remove this after fixing the issue
  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <Stack screenOptions={{
        headerShown: false,
        header: () => <Header />
      }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
        <Stack.Screen name="match/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="oauth-native-callback" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </View>
  );
};



import { ThemeProvider, DarkTheme } from "@react-navigation/native";

// ... existing imports

export default function Layout() {
  return (
    // 2. TOKEN CACHE REMOVED
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#121212"
        translucent={Platform.OS === 'android'}
      />
      <ClerkProvider
        publishableKey={publishableKey}
        tokenCache={tokenCache}
      >
        <SessionProvider>
          <SubscriptionProvider>
            <ThemeProvider value={DarkTheme}>
              <InitialLayout />
            </ThemeProvider>
          </SubscriptionProvider>
        </SessionProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
