import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, DeviceEventEmitter } from 'react-native';
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
    const { user } = useUser();

    const router = useRouter();
    const segments = useSegments();

    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"signin" | "signup">("signin");

    const [pendingVerification, setPendingVerification] = useState(false);

    const [code, setCode] = useState("");

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

            // Construct Full Name from inputs or fallback to email handle
            let fullName = email.split('@')[0];
            if (firstName && lastName) {
                fullName = `${firstName.trim()} ${lastName.trim()}`;
            }

            console.log("Syncing Profile Data:", { id, email, firstName, lastName, generatedFullName: fullName });

            const { error } = await supabase.from('profiles').upsert({
                id: id,
                email: email,
                role: 'player', // Default role
                full_name: fullName,
                nickname: null // Default to null so Header uses full_name
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

                // Explicitly Sync for New User
                if (completeSignUp.createdUserId) {
                    try {
                        await new Promise(r => setTimeout(r, 500));
                        await syncToSupabase(completeSignUp.createdUserId, emailAddress);
                    } catch (err) {
                        console.error("Sync error", err);
                    }
                }

                router.replace("/");
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
            Alert.alert("Missing Information", "Please enter your First and Last name.");
            return;
        }

        setLoading(true);
        try {
            await signUp.create({
                emailAddress: emailAddress.trim(),
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });

            // Prepare validation on Clerk side
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

    const onSignInPress = async () => {
        if (!isLoaded) return;
        setLoading(true);
        try {
            const completeSignIn = await signIn.create({
                identifier: emailAddress.trim(),
                password,
            });
            await setActive({ session: completeSignIn.createdSessionId });
            router.replace("/");
        } catch (err: any) {
            console.log(JSON.stringify(err, null, 2));
            Alert.alert("Login Failed", err.errors ? err.errors[0].message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const onGoogleSignInPress = async () => {
        try {
            console.log("OAuth Start. Auto-Redirect.");
            const result = await startOAuthFlow();
            const { createdSessionId, setActive, signIn, signUp } = result;

            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });

                const newUserId = (signUp as any)?.createdUserId || (signIn as any)?.createdUserId;

                if (newUserId) {
                    let email = "oauth_user";
                    if (signUp?.emailAddress) email = signUp.emailAddress;
                    else if (signIn?.identifier) email = signIn.identifier;
                    else if (user?.primaryEmailAddress?.emailAddress) email = user.primaryEmailAddress.emailAddress;

                    try {
                        console.log("OAuth Sync Start for:", newUserId);
                        await new Promise(r => setTimeout(r, 1000));
                        await syncToSupabase(newUserId, email);
                    } catch (e: any) {
                        console.error("OAuth Sync Error", e);
                    }
                }
            }
        } catch (err) {
            console.error("OAuth error", err);
            Alert.alert("Google Sign In Error", "Failed to sign in with Google");
        }
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        setPendingVerification(false);
        setCode("");
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View className="flex-1 justify-center items-center bg-background p-6">
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
                                    <View className="flex-row gap-2 mb-4">
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
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}
