import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, TouchableWithoutFeedback, Keyboard, DeviceEventEmitter, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOAuth, useAuth, useUser, useSignIn, useSignUp, useClerk } from '@clerk/clerk-expo';
import { useRouter, useSegments } from 'expo-router';
import { createClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { authSignal } from '../lib/authSignal';

// WebBrowser.maybeCompleteAuthSession(); // Removed: Handled in _layout.tsx

export default function Login() {
    const { signOut } = useAuth();

    useEffect(() => {
        console.log("[Login] Component MOUNTED (Effect)");
        // NOTE: Removed forced signOut on mount - it was interfering with OAuth callback flows
        // and causing "href undefined" errors during authentication redirects.
        return () => console.log("[Login] Component UNMOUNTED");
    }, []);

    const { signIn, setActive, isLoaded } = useSignIn();
    const { signUp, setActive: setActiveSignUp, isLoaded: isSignUpLoaded } = useSignUp();
    const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
    const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: "oauth_apple" });
    const { getToken, userId, isSignedIn } = useAuth();
    const clerk = useClerk();
    // const { user } = useUser(); // useAuth provides basic user info, useUser provides full user object. useUser() is better for email check.

    const router = useRouter();
    const segments = useSegments();

    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"signin" | "signup">("signin");

    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState("");

    const [signInPendingVerification, setSignInPendingVerification] = useState(false);

    // Helper to sync user to Supabase
    const syncToSupabase = async (id: string, email: string) => {
        try {
            console.log("Syncing user to Supabase...", id, email);
            const token = await getToken({ template: 'supabase' });
            if (!token) {
                console.warn("Sync skipped: No token available yet.");
                return;
            }

            const authHeader = { Authorization: "Bearer " + token };
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            let fullName = email.split('@')[0];
            if (firstName && lastName) {
                fullName = `${firstName.trim()} ${lastName.trim()}`;
            }

            console.log("Syncing Profile Data:", { id, email, firstName, lastName, generatedFullName: fullName });

            const { error } = await supabase.from('profiles').upsert({
                id: id,
                email: email,
                role: 'player',
                full_name: fullName,
                nickname: null
            });

            if (error) {
                console.error("Supabase Sync Error:", error);
                Alert.alert("Profile Sync Failed", error.message);
            } else {
                console.log("Supabase Sync Success");
                DeviceEventEmitter.emit('refreshProfile');
            }
        } catch (e: any) {
            console.error("Sync Exception:", e);
            Alert.alert("Sync Error", e.message || "Unknown error during profile creation");
        }
    };

    const onPressVerify = async () => {
        if (!isSignUpLoaded) return;
        setLoading(true);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            if (completeSignUp.status === 'complete') {
                await setActiveSignUp({ session: completeSignUp.createdSessionId });

                if (completeSignUp.createdUserId) {
                    try {
                        await new Promise(r => setTimeout(r, 500));
                        await syncToSupabase(completeSignUp.createdUserId, emailAddress);
                    } catch (err) {
                        console.error("Sync error", err);
                    }
                }

                router.replace("/(tabs)");
            } else {
                console.error(JSON.stringify(completeSignUp, null, 2));
                Alert.alert("Verification Failed", "Code verification incomplete.");
            }
        } catch (err: any) {
            console.log(JSON.stringify(err, null, 2));
            Alert.alert("Error", err.errors ? err.errors[0].message : "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const onSignUpPress = async () => {
        if (!isSignUpLoaded) return;

        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Missing Information", "Please enter your First and Last Name.");
            return;
        }

        setLoading(true);
        try {
            const signUpParams: any = {
                emailAddress: emailAddress.trim(),
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            };
            // Only include phone number if provided (it's optional)
            if (phoneNumber.trim()) {
                signUpParams.phoneNumber = phoneNumber.trim();
            }
            await signUp.create(signUpParams);

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

            setPendingVerification(true);
            Alert.alert("Verification Sent", "Please check your email for a verification code.");
        } catch (err: any) {
            console.log(JSON.stringify(err, null, 2));
            Alert.alert("Sign Up Failed", err.errors ? err.errors[0].message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    // Unified Session Activation Helper
    const activateAndNavigate = async (sessionId: string) => {
        console.log("[Login] Activating session (Unified Path):", sessionId);

        Keyboard.dismiss();
        await new Promise(r => setTimeout(r, 200));

        const activePromise = setActive({ session: sessionId })
            .then(() => 'success')
            .catch((err) => {
                console.log("[Login] setActive failed locally (ignoring):", err);
                return 'error';
            });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 800));

        // @ts-ignore
        const result = await Promise.race([activePromise, timeoutPromise]);
        console.log(`[Login] Activation result: ${result} - Force Navigating`);

        authSignal.justLoggedIn = true;
        await new Promise(r => setTimeout(r, 100));

        console.log("[Login] Attempting Router Navigation...");
        router.replace("/(tabs)");

        // NUCLEAR FALLBACK
        setTimeout(() => {
            console.log("[Login] Router fallback - using Linking");
            try {
                const url = Linking.createURL('(tabs)');
                console.log("[Login] Linking to:", url);
                Linking.openURL(url);
            } catch (e) {
                console.error("[Login] Linking failed:", e);
            }
        }, 1000);
    };

    const onSignInPress = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            console.log("STARTING SIGN IN...");
            const completeSignIn = await signIn.create({
                identifier: emailAddress.trim(),
                password,
            });

            console.log("[Login] Result:", JSON.stringify(completeSignIn, null, 2));

            if (completeSignIn.status === 'complete') {
                console.log("[Login] Status is COMPLETE.");
                console.log("Detaching execution chain...");
                setTimeout(() => {
                    activateAndNavigate(completeSignIn.createdSessionId);
                }, 500);
            } else {
                console.warn("[Login] Status is NOT COMPLETE:", completeSignIn.status);
                Alert.alert("Sign In Failed", `Status: ${completeSignIn.status}`);
            }
        } catch (err: any) {
            // IMPROVED ERROR LOGGING
            const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
            console.log("[Login] Sign-in error:", errorMsg);

            // AGGRESSIVE RECOVERY CHECK
            if (clerk.client && clerk.client.sessions && clerk.client.sessions.length > 0) {
                const lastSession = clerk.client.sessions[clerk.client.sessions.length - 1];
                console.log("[Login] Crash detected, but Session FOUND:", lastSession.id);
                // Silent Recovery
                setTimeout(() => {
                    activateAndNavigate(lastSession.id);
                }, 500);
                return;
            }

            console.log("CRASH TRAPPED:", errorMsg); // Log but don't alert user unless necessary
            // Alert.alert("Login Error", "An unexpected error occurred."); // Optional: Generic error

            const errorMessage = err.errors?.[0]?.message || err.message || "";

            // Navigation error check
            if (errorMessage.includes("href") || errorMessage.includes("undefined") || errorMessage.includes("route")) {
                console.warn("[Login] Navigation-related error (ignoring):", errorMessage);
                return;
            }

            // Session Conflict Check (Kept as backup, though Aggressive Recovery likely catches it)
            if (err.errors && err.errors[0]?.message?.includes("Session already exists")) {
                console.warn("[Login] Conflict but no sessions found (Should generally not happen with Aggressive Recovery)!");
            }

            Alert.alert("Login Failed", err.errors ? err.errors[0].message : errorMessage);

        } finally {
            setLoading(false);
        }
    };

    const handleOAuthResult = async (result: any) => {
        const { createdSessionId, setActive, signIn, signUp } = result;

        if (createdSessionId) {
            console.log("[OAuth] Session created:", createdSessionId);

            // Sync to Supabase (can run in background)
            const newUserId = (signUp as any)?.createdUserId || (signIn as any)?.createdUserId;
            if (newUserId) {
                let email = "oauth_user";
                if (signUp?.emailAddress) email = signUp.emailAddress;
                else if (signIn?.identifier) email = signIn.identifier;

                // Fire and forget sync
                syncToSupabase(newUserId, email).catch(e => console.error("OAuth Sync Error", e));
            }

            // Use the same detached pattern as email sign-in
            console.log("[OAuth] Detaching execution chain...");
            setTimeout(() => {
                activateAndNavigate(createdSessionId);
            }, 500);
        } else {
            console.log("[OAuth] No session created, signIn/signUp status:", signIn?.status, signUp?.status);
        }
    };

    const onGoogleSignInPress = async () => {
        try {
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'breakpoint-billiards',
                path: 'oauth-native-callback'
            });
            console.log("Google OAuth Start. Redirect URL:", redirectUrl);
            const result = await startGoogleFlow({ redirectUrl });
            await handleOAuthResult(result);
        } catch (err: any) {
            console.error("Google OAuth error", err);

            // AGGRESSIVE RECOVERY CHECK (same as email sign-in)
            if (clerk.client && clerk.client.sessions && clerk.client.sessions.length > 0) {
                const lastSession = clerk.client.sessions[clerk.client.sessions.length - 1];
                console.log("[Google OAuth] Crash detected, but Session FOUND:", lastSession.id);
                setTimeout(() => {
                    activateAndNavigate(lastSession.id);
                }, 500);
                return;
            }

            // Navigation error check
            const errorMessage = err?.errors?.[0]?.message || err?.message || "";
            if (errorMessage.includes("href") || errorMessage.includes("undefined") || errorMessage.includes("route")) {
                console.warn("[Google OAuth] Navigation-related error (ignoring):", errorMessage);
                return;
            }

            Alert.alert("Google Sign In Error", "Failed to sign in with Google");
        }
    };

    const onAppleSignInPress = async () => {
        try {
            // Create the redirect URL using the app's scheme
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'breakpoint-billiards',
                path: 'oauth-native-callback'
            });
            console.log("Apple OAuth Start. Redirect URL:", redirectUrl);

            const result = await startAppleFlow({ redirectUrl });
            console.log("Apple OAuth Result:", JSON.stringify(result, null, 2));
            await handleOAuthResult(result);
        } catch (err: any) {
            console.error("Apple OAuth error", err);

            // AGGRESSIVE RECOVERY CHECK (same as email sign-in)
            if (clerk.client && clerk.client.sessions && clerk.client.sessions.length > 0) {
                const lastSession = clerk.client.sessions[clerk.client.sessions.length - 1];
                console.log("[Apple OAuth] Crash detected, but Session FOUND:", lastSession.id);
                setTimeout(() => {
                    activateAndNavigate(lastSession.id);
                }, 500);
                return;
            }

            // Navigation error check
            const errorMessage = err?.errors?.[0]?.longMessage
                || err?.errors?.[0]?.message
                || err?.message
                || JSON.stringify(err);

            if (errorMessage.includes("href") || errorMessage.includes("undefined") || errorMessage.includes("route")) {
                console.warn("[Apple OAuth] Navigation-related error (ignoring):", errorMessage);
                return;
            }

            console.error("Apple OAuth error details:", errorMessage);
            Alert.alert("Apple Sign In Error", errorMessage);
        }
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        setPendingVerification(false);
        setCode("");
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
            >
                <View className="flex-1 justify-center items-center p-6">
                    <View className="w-full max-w-sm">
                        <View className="items-center mb-10">
                            <Image
                                source={require('../assets/branding-logo.png')}
                                style={{ width: 200, height: 200 }}
                                resizeMode="contain"
                            />
                        </View>

                        {!pendingVerification ? (
                            <>
                                <View style={{ marginTop: 20 }}>
                                    <Text style={{ color: 'gray', textAlign: 'center', fontSize: 12 }}>
                                        By continuing, you agree to our Terms of Service and Privacy Policy.
                                    </Text>
                                </View>

                                {mode === "signup" && (
                                    <View className="flex-col gap-4 mb-4">
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                value={firstName}
                                                placeholder="First Name"
                                                placeholderTextColor="#666"
                                                onChangeText={setFirstName}
                                                className="flex-1 bg-surface border border-border rounded-lg p-4 text-foreground text-base"
                                            />
                                            <TextInput
                                                value={lastName}
                                                placeholder="Last Name"
                                                placeholderTextColor="#666"
                                                onChangeText={setLastName}
                                                className="flex-1 bg-surface border border-border rounded-lg p-4 text-foreground text-base"
                                            />
                                        </View>
                                        <TextInput
                                            value={phoneNumber}
                                            placeholder="Mobile Number (optional)"
                                            placeholderTextColor="#666"
                                            keyboardType="phone-pad"
                                            onChangeText={setPhoneNumber}
                                            className="w-full bg-surface border border-border rounded-lg p-4 text-foreground text-base"
                                        />
                                    </View>
                                )}

                                <TextInput
                                    autoCapitalize="none"
                                    value={emailAddress}
                                    placeholder="Email Address"
                                    placeholderTextColor="#666"
                                    onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
                                    className="w-full bg-surface border border-border rounded-lg p-4 mb-4 text-foreground text-base"
                                />
                                <TextInput
                                    value={password}
                                    placeholder="Password"
                                    placeholderTextColor="#666"
                                    secureTextEntry={true}
                                    onChangeText={(password) => setPassword(password)}
                                    className="w-full bg-surface border border-border rounded-lg p-4 mb-6 text-foreground text-base"
                                />


                                <TouchableOpacity
                                    onPress={mode === "signin" ? onSignInPress : onSignUpPress}
                                    disabled={loading}
                                    className="w-full bg-primary rounded-lg p-4 justify-center mb-4"
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text
                                            className="text-black font-bold text-lg uppercase tracking-wider text-center w-full"
                                            style={{ includeFontPadding: false }}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                        >
                                            {mode === "signin" ? "Sign In" : "Sign Up"}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={onGoogleSignInPress}
                                    disabled={loading}
                                    className="w-full bg-surface border border-border rounded-lg p-4 justify-center mb-2"
                                >
                                    <Text
                                        className="text-white font-bold text-base text-center w-full"
                                        style={{ includeFontPadding: false }}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        Sign in with Google
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={onAppleSignInPress}
                                    disabled={loading}
                                    className="w-full bg-white border border-white rounded-lg p-4 justify-center mb-6"
                                >
                                    <Text
                                        className="text-black font-bold text-base text-center w-full"
                                        style={{ includeFontPadding: false }}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        Sign in with Apple
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={toggleMode} className="items-center">
                                    <Text className="text-gray-500 text-sm">
                                        {mode === "signin" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                                    </Text>
                                </TouchableOpacity>

                                {mode === "signin" && (
                                    <TouchableOpacity className="mt-4 items-center">
                                        <Text className="text-gray-500 text-sm">Forgot Password?</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <>
                                <Text className="text-white text-xl font-bold mb-6 text-center">Verify Email</Text>
                                <Text className="text-gray-400 mb-6 text-center">
                                    We've sent a verification code to {emailAddress}. Please enter it below.
                                </Text>

                                <TextInput
                                    value={code}
                                    placeholder="Verification Code"
                                    placeholderTextColor="#666"
                                    keyboardType="number-pad"
                                    onChangeText={(c) => setCode(c)}
                                    className="w-full bg-surface border border-border rounded-lg p-4 mb-6 text-foreground text-base text-center font-bold tracking-widest text-xl"
                                />

                                <TouchableOpacity
                                    onPress={onPressVerify}
                                    disabled={loading}
                                    className="w-full bg-primary rounded-lg p-4 items-center mb-4"
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text className="text-black font-bold text-lg uppercase tracking-wider">
                                            Verify Email
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setPendingVerification(false)} className="items-center mt-4">
                                    <Text className="text-primary text-sm font-bold">Back to Sign Up</Text>
                                </TouchableOpacity>
                            </>
                        )}

                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
