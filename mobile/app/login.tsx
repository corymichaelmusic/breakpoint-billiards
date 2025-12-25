import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useOAuth, useAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { useRouter, useSegments } from 'expo-router';
import { createClient } from "@supabase/supabase-js";
import { supabase } from '../lib/supabase';
import * as WebBrowser from "expo-web-browser";
import { useWarmUpBrowser } from "../hooks/useWarmUpBrowser";

// WebBrowser.maybeCompleteAuthSession(); // Removed: Handled in _layout.tsx

export default function Login() {
    useWarmUpBrowser();

    const { signIn, setActive, isLoaded } = useSignIn();
    const { signUp, setActive: setActiveSignUp, isLoaded: isSignUpLoaded } = useSignUp();
    const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
    const { getToken, isSignedIn, userId } = useAuth();

    const router = useRouter();
    const segments = useSegments();

    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"signin" | "signup">("signin");

    // Helper to sync user to Supabase
    // This is critical because Webhooks might not fire in local dev.
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

            const { error } = await supabase.from('profiles').upsert({
                id: id,
                email: email,
                role: 'player', // Default role
                full_name: email.split('@')[0], // Fallback name
            });

            if (error) {
                console.error("Supabase Sync Error:", error);
                Alert.alert("Profile Sync Failed", error.message);
            } else {
                console.log("Supabase Sync Success");
            }
        } catch (e: any) {
            console.error("Sync Exception:", e);
            Alert.alert("Sync Error", e.message || "Unknown error during profile creation");
        }
    };

    const onSignInPress = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            const completeSignIn = await signIn.create({
                identifier: emailAddress,
                password,
            });
            await setActive({ session: completeSignIn.createdSessionId });
            // Sync is handled by `useUser` effect potentially? 
            // Or we just fetch user details?
            // Clerk's `signIn` response doesn't give full user details easily unless we expand?
            // Let's rely on the Self-Healing for now on Login (existing users).
            // BUT for SignUp (new users), we have the data right there.
            router.replace("/");
        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2));
            Alert.alert("Login Failed", err.errors ? err.errors[0].message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const onSignUpPress = async () => {
        if (!isSignUpLoaded) return;
        setLoading(true);
        try {
            const result = await signUp.create({
                emailAddress,
                password,
            });

            if (result.status === "complete") {
                await setActiveSignUp({ session: result.createdSessionId });

                // Explicitly Sync for New User
                if (result.createdUserId) {
                    try {
                        // Small delay to ensure session propagates
                        await new Promise(r => setTimeout(r, 500));
                        await syncToSupabase(result.createdUserId, emailAddress);
                    } catch (err) {
                        console.error("Sync error", err);
                    }
                }

                router.replace("/");
            } else {
                console.log(JSON.stringify(result, null, 2));
                Alert.alert("Sign Up", "Please check your email for a verification code if enabled.");
            }

        } catch (err: any) {
            console.error(JSON.stringify(err, null, 2));
            Alert.alert("Sign Up Failed", err.errors ? err.errors[0].message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const onGoogleSignInPress = async () => {
        try {
            // Redirect to "/login" to allow the existing component to resume and handle the token.
            // Requires `launchMode: singleTask` on Android to work correctly.
            // Let Clerk handle the redirect URL automatically
            // This fixes iOS dropping parameters on explicit root redirects
            console.log("OAuth Start. Auto-Redirect.");
            const result = await startOAuthFlow();
            const { createdSessionId, setActive, signIn, signUp } = result;

            // DEBUG: Alert result
            // Debug Alert Removed

            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });

                // Explicitly Sync for OAuth User
                // Explicitly Sync for OAuth User
                // We prioritize signUp for new users.
                // Cast to any to avoid TS errors if types are incomplete, but essentially we want the User ID.
                const newUserId = (signUp as any)?.createdUserId || (signIn as any)?.createdUserId;

                if (newUserId) {
                    // Optimized extraction:
                    let email = "oauth_user";
                    // Try to get email from the result objects if available
                    if (signUp?.emailAddress) email = signUp.emailAddress;
                    else if (signIn?.identifier) email = signIn.identifier;
                    else if (user?.primaryEmailAddress?.emailAddress) email = user.primaryEmailAddress.emailAddress;

                    try {
                        console.log("OAuth Sync Start for:", newUserId);
                        // Small delay to ensure session propagates
                        await new Promise(r => setTimeout(r, 1000));
                        await syncToSupabase(newUserId, email);
                    } catch (e: any) {
                        console.error("OAuth Sync Error", e);
                        // Don't alert here, let _layout or index handle the missing profile via self-healing
                    }
                } else {
                    console.log("No User ID found in OAuth response. Skipping explicit sync.");
                }
                // router.replace("/"); // REMOVED: Let _layout handle the redirect based on isSignedIn state change to avoid race condition.
            } else {
                // Use signIn or signUp for next steps such as MFA
            }
        } catch (err) {
            console.error("OAuth error", err);
            Alert.alert("Google Sign In Error", "Failed to sign in with Google");
        }
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
    };

    return (
        <View className="flex-1 justify-center items-center bg-background p-6">
            <View className="w-full max-w-sm">
                <View className="items-center mb-10">
                    <Image
                        source={require('../assets/branding-logo.png')}
                        style={{ width: 200, height: 200 }}
                        resizeMode="contain"
                    />
                </View>
                {/* Debug Info Removed */}

                <View style={{ marginTop: 20 }}>
                    <Text style={{ color: 'gray', textAlign: 'center', fontSize: 12 }}>
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </Text>
                </View>

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
                    className="w-full bg-primary rounded-lg p-4 items-center mb-4"
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text className="text-black font-bold text-lg uppercase tracking-wider">
                            {mode === "signin" ? "Sign In" : "Sign Up"}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onGoogleSignInPress}
                    disabled={loading}
                    className="w-full bg-surface border border-border rounded-lg p-4 items-center mb-6 flex-row justify-center"
                >
                    {/* You could add a google icon here */}
                    <Text className="text-white font-bold text-base">Sign in with Google</Text>
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

            </View>
        </View>
    );
}
