import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Link, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { createClient } from "@supabase/supabase-js";


interface NextMatchCardProps {
    opponentName: string;
    date: string;
    isLocked?: boolean;
    matchId: string;
    leagueName?: string;
    sessionName?: string;
    weekNumber?: number;
    status?: string;
    player1Id?: string;
    player2Id?: string;
    paymentStatusP1?: string;
    paymentStatusP2?: string;
    label?: string;
    scores?: {
        p1_8: number;
        p2_8: number;
        p1_9: number;
        p2_9: number;
        isPlayer1: boolean;
    };
    specialStats?: {
        p1_8br: number;
        p2_8br: number;
        p1_9br: number;
        p2_9br: number;
        p1_snap: number;
        p2_snap: number;
    };
}

export default function NextMatchCard({
    opponentName, date, isLocked, matchId, leagueName, sessionName, weekNumber, status,
    player1Id, player2Id, paymentStatusP1, paymentStatusP2, label, scores, specialStats
}: NextMatchCardProps) {
    const [isRequesting, setIsRequesting] = useState(false);
    const { getToken, userId } = useAuth();
    const { user } = useUser();
    const router = useRouter();

    const [hasPendingRequest, setHasPendingRequest] = useState(false);

    const myName = user?.firstName || 'Me';
    const oppName = opponentName.split(' ')[0];



    useEffect(() => {
        if (matchId && matchId.startsWith('user_')) {
            console.error("NextMatchCard received User ID as matchId!", matchId);
        }
        let isMounted = true;
        let subscription: any = null;
        let pollInterval: NodeJS.Timeout | null = null;

        const checkPendingRequest = async () => {
            if (!matchId || !userId) return;
            // Optimization: Do not check pending requests for finalized games
            if (status === 'finalized' || status === 'completed') return;

            try {
                // Initial Fetch using singleton
                // Note: We need auth token for RLS? Singleton handles auth state automatically if signed in via Clerk?
                // Actually `lib/supabase` setup might not have the Clerk token if we don't set it?
                // The `lib/supabase.ts` uses AsyncStorage which Clerk might write to?
                // Standard pattern with Clerk + Supabase is to set the token on the client.

                // If we use the singleton `supabase` exported from `lib/supabase`, it might be anonymous 
                // UNLESS we set the session.
                // However, for public/authenticated reads, we often need the Custom JWT from Clerk.
                // The singleton in `lib/supabase.ts` is initialized with Anon Key. 
                // Clerk's `useAuth` gives us the `getToken`.

                // If we want to use the singleton, we'd need to set the global headers or use it as is?
                // Actually, creating a lightweight client with `global: { headers: { Authorization... } }` is correct for Clerk.
                // BUT we should avoid creating it inside the effect if possible, or accept that RLS needs it.
                // If we can't use the singleton because of RLS/Clerk token requirements, we MUST CreateClient.
                // BUT we should do it ONCE per component or use a memoized client.

                // Optimization: Keep existing CreateClient usage IF RLS requires it (which it likely does),
                // BUT reduce polling frequency.

                const token = await getToken({ template: 'supabase' });
                const supabaseClient = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    {
                        global: { headers: { Authorization: `Bearer ${token}` } },
                    }
                );

                const fetchStatus = async () => {
                    if (!isMounted) return;
                    const { data, error } = await supabaseClient
                        .from("reschedule_requests")
                        .select("id") // ONLY Select ID to save bandwidth
                        .eq("match_id", matchId)
                        .eq("status", "pending_operator")
                        .limit(1);

                    if (isMounted && !error) {
                        setHasPendingRequest(data && data.length > 0);
                    }
                };

                await fetchStatus();

                // Realtime Subscription & Polling Removed for Bandwidth Optimization
                // User must pull-to-refresh on Dashboard to see status updates.

            } catch (error) {
                console.log("Error checking request:", error);
            }
        };

        checkPendingRequest();

        return () => {
            isMounted = false;
            if (pollInterval) clearInterval(pollInterval);
            if (subscription) subscription.unsubscribe();
        };
    }, [matchId, userId, getToken, isLocked]);

    // Payment Status Logic
    const myId = userId;
    const myPaymentStatus = myId === player1Id ? paymentStatusP1 : paymentStatusP2;
    const oppPaymentStatus = myId === player1Id ? paymentStatusP2 : paymentStatusP1;
    const isPaid = (s: string | undefined) => ['paid', 'paid_cash', 'paid_online', 'waived'].includes(s || 'unpaid');

    const handleRequestUnlock = async () => {
        if (!matchId || !userId) return; // Guard clause

        setIsRequesting(true);
        try {
            const token = await getToken({ template: 'supabase' });

            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: { Authorization: `Bearer ${token}` } } }
            );

            const { error } = await supabase
                .from("reschedule_requests")
                .insert({
                    match_id: matchId,
                    requester_id: userId,
                    requested_date: new Date().toISOString(),
                    reason: "Player requested manual unlock",
                    status: 'pending_operator'
                });

            if (error) {
                console.error(error);
                alert("Failed to send request. Please try again.");
            } else {
                alert("Unlock request sent to the League Operator.");
                setHasPendingRequest(true);
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred.");
        } finally {
            setIsRequesting(false);
        }
    };

    const handlePayFee = async () => {
        if (!matchId || !userId) return;
        setIsRequesting(true); // Reuse loading state or add new one
        try {
            const token = await getToken();

            const apiUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://breakpoint.app';
            const targetUrl = `${apiUrl}/api/create-match-checkout`;
            console.log("PAYMENT DEBUG: Requesting", targetUrl);

            const response = await fetch(`${apiUrl}/api/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type: 'match_fee', matchId, source: 'mobile' })
            });

            console.log("PAYMENT DEBUG: Status", response.status);
            const rawText = await response.text();
            console.log("PAYMENT DEBUG: Raw Response (First 100 chars):", rawText.substring(0, 100));

            try {
                const data = JSON.parse(rawText);
                if (data.url) {
                    const { Linking } = require("react-native");
                    Linking.openURL(data.url);
                } else {
                    Alert.alert("Error", data.error || "Failed to create payment link.");
                }
            } catch (jsonError) {
                console.error("PAYMENT DEBUG: JSON Parse Failed", jsonError);
                Alert.alert("Payment Error", `Server returned invalid response: ${response.status}`);
            }

        } catch (e) {
            console.error("Payment Error:", e);
            Alert.alert("Error", "Could not start payment.");
        } finally {
            setIsRequesting(false);
        }
    };

    const handlePlayMatch = () => {
        if (!userId) return;

        if (!isPaid(myPaymentStatus)) {
            Alert.alert(
                "Match Fee Required",
                "You must pay the $20 match fee before playing.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Pay Now ($20)", onPress: handlePayFee }
                ]
            );
            return;
        }

        if (!isPaid(oppPaymentStatus)) {
            Alert.alert("Opponent Unpaid", "Your opponent must pay their match fee before the set can begin.");
            return;
        }

        // Proceed
        console.log("Navigating to Match:", matchId);
        router.push(`/match/${matchId}`);
    };

    return (
        <View className="bg-surface p-4 rounded-lg border border-border border-l-4 border-l-primary mb-6">
            <View className="flex-row justify-between items-center mb-1">
                <Text className="text-primary text-xs font-bold uppercase tracking-wider" style={{ includeFontPadding: false }}>{label ? label + ' ' : 'Next Match '}</Text>
                {/* Remove duplicate Week display if using label for it, or keep for date context? 
                    User asked to replace "Next Match" with "Week X". 
                    So let's keep weekNumber on the right only if it's NOT in the label to avoid redundancy?
                    Actually, user said "Show the week (week 1...)" instead of "Next Match".
                    Existing weekNumber is shown on the right: {weekNumber && <Text...>Week {weekNumber}</Text>}
                    We can assume if label is provided, we might want to hide the right-side week number if it's redundant.
                    But for now, minimal change: Just replace "Next Match" with label. 
                */}
                {weekNumber && <Text className="text-gray-400 text-[10px] uppercase" style={{ includeFontPadding: false }}>Week {weekNumber} </Text>}
            </View>
            <Text className="text-foreground text-xl font-bold mb-1" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>vs {opponentName}</Text>
            {leagueName && <Text className="text-gray-300 text-sm">{leagueName}</Text>}
            {sessionName && <Text className="text-gray-500 text-xs mb-1">{sessionName}</Text>}
            <Text className="text-gray-400 text-xs mb-4">{date}</Text>

            {/* Payment Status Badges - Only show if NOT finalized */}
            {status !== 'finalized' && status !== 'completed' && (
                <View className="flex-row gap-2 mb-4">
                    <View className={`px-2 py-1 rounded border flex-1 items-center justify-center ${isPaid(myPaymentStatus) ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                        <Text
                            className={`${isPaid(myPaymentStatus) ? 'text-green-400' : 'text-red-400'} text-[10px] font-bold uppercase text-center w-full`}
                            style={{ includeFontPadding: false }}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            You: {isPaid(myPaymentStatus) ? 'Paid' : 'Unpaid'}
                        </Text>
                    </View>
                    <View className={`px-2 py-1 rounded border flex-1 items-center justify-center ${isPaid(oppPaymentStatus) ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                        <Text
                            className={`${isPaid(oppPaymentStatus) ? 'text-green-400' : 'text-red-400'} text-[10px] font-bold uppercase text-center w-full`}
                            style={{ includeFontPadding: false }}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            Opponent: {isPaid(oppPaymentStatus) ? 'Paid' : 'Unpaid'}
                        </Text>
                    </View>
                </View>
            )}

            {scores && (status === 'finalized' || status === 'completed') && (
                <View className="mb-4">
                    <View className="flex-row gap-4 mb-4">
                        <View>
                            <Text className="text-gray-400 text-[10px] uppercase">8-Ball</Text>
                            <Text className={`font-bold ${((scores.isPlayer1 ? scores.p1_8 : scores.p2_8) > (scores.isPlayer1 ? scores.p2_8 : scores.p1_8)) ? 'text-green-400' : 'text-red-400'}`}>
                                {scores.isPlayer1 ? scores.p1_8 : scores.p2_8} - {scores.isPlayer1 ? scores.p2_8 : scores.p1_8}
                            </Text>
                        </View>
                        <View>
                            <Text className="text-gray-400 text-[10px] uppercase">9-Ball</Text>
                            <Text className={`font-bold ${((scores.isPlayer1 ? scores.p1_9 : scores.p2_9) > (scores.isPlayer1 ? scores.p2_9 : scores.p1_9)) ? 'text-green-400' : 'text-red-400'}`}>
                                {scores.isPlayer1 ? scores.p1_9 : scores.p2_9} - {scores.isPlayer1 ? scores.p2_9 : scores.p1_9}
                            </Text>
                        </View>
                    </View>

                    {/* Uniform Stats Layout */}
                    {specialStats && (
                        <View className="flex-row gap-4">
                            {/* MY Box */}
                            <View className="flex-1 bg-surface-hover rounded p-2 border border-white/5 items-center">
                                <Text className="text-primary font-bold text-xs uppercase mb-1 text-center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{myName}</Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">8BR - <Text className="text-white">{scores.isPlayer1 ? specialStats.p1_8br : specialStats.p2_8br}</Text></Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">9BR - <Text className="text-white">{scores.isPlayer1 ? specialStats.p1_9br : specialStats.p2_9br}</Text></Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">9BS - <Text className="text-white">{scores.isPlayer1 ? specialStats.p1_snap : specialStats.p2_snap}</Text></Text>
                            </View>

                            {/* OPP Box */}
                            <View className="flex-1 bg-surface-hover rounded p-2 border border-white/5 items-center">
                                <Text className="text-gray-400 font-bold text-xs uppercase mb-1 text-center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{oppName}</Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">8BR - <Text className="text-white">{scores.isPlayer1 ? specialStats.p2_8br : specialStats.p1_8br}</Text></Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">9BR - <Text className="text-white">{scores.isPlayer1 ? specialStats.p2_9br : specialStats.p1_9br}</Text></Text>
                                <Text className="text-gray-400 text-[10px] uppercase font-bold">9BS - <Text className="text-white">{scores.isPlayer1 ? specialStats.p2_snap : specialStats.p1_snap}</Text></Text>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {isLocked ? (
                <View className="flex-row items-center gap-4">
                    <View className="bg-secondary px-4 py-2 rounded self-start">
                        <Text className="text-gray-500 font-bold uppercase text-xs">{status === 'finalized' ? 'Completed' : 'Locked'}</Text>
                    </View>
                    {hasPendingRequest ? (
                        <Text className="text-yellow-500 text-[10px] uppercase font-bold italic">Unlock Pending...</Text>
                    ) : (status !== 'finalized' && status !== 'completed') ? (
                        <TouchableOpacity onPress={handleRequestUnlock} disabled={isRequesting}>
                            <Text className={`text-primary text-[10px] uppercase underline font-bold ${isRequesting ? 'opacity-50' : ''}`}>
                                {isRequesting ? 'Sending...' : 'Request Unlock'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : (

                matchId && !matchId.startsWith('user_') && matchId.length === 36 ? (
                    status === 'finalized' ? null : (
                        <TouchableOpacity
                            onPress={() => {
                                handlePlayMatch();
                            }}
                            className={`bg-primary px-4 py-2 rounded self-start`}
                        >
                            <Text className={`text-black font-bold uppercase text-xs tracking-wider`} style={{ includeFontPadding: false }}>
                                {status === 'in_progress' ? 'Continue Match ' : 'Play Match '}
                            </Text>
                        </TouchableOpacity>
                    )
                ) : (
                    <View className="bg-red-900/20 px-4 py-2 rounded border border-red-500/50">
                        <Text className="text-red-400 text-xs font-bold">Invalid Match ID: {matchId ? 'Format Error' : 'Missing'}</Text>
                        <Text className="text-red-500 text-[10px]">{matchId || 'NULL'}</Text>
                    </View>
                )
            )}
        </View >
    );
}
