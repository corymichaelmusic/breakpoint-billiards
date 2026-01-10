import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/clerk-expo";

export default function EditGameScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const router = useRouter();
    const { getToken, userId } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [game, setGame] = useState<any>(null);
    const [match, setMatch] = useState<any>(null);

    // Form State
    const [winnerId, setWinnerId] = useState<string>('');
    // Scores are no longer manually editable per game in the new model (1 game = 1 point)

    // Stats State
    const [stats, setStats] = useState({
        is_break_and_run: false,
        is_rack_and_run: false,
        is_9_on_snap: false,

        is_early_8: false,
        is_scratch_8: false,
        innings: 1
    });

    useEffect(() => {
        fetchGameDetails();
    }, [id]);

    const fetchGameDetails = async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            // Fetch Game (Games Table)
            const { data: gameData, error: gameError } = await supabase
                .from("games")
                .select("*")
                .eq("id", id)
                .single();

            if (gameError || !gameData) throw gameError || new Error("Game not found");
            setGame(gameData);

            // Fetch Match to get Player Names
            const { data: matchData, error: matchError } = await supabase
                .from("matches")
                .select("*, player1:player1_id(id, full_name, nickname), player2:player2_id(id, full_name, nickname)")
                .eq("id", gameData.match_id)
                .single();

            if (matchError) throw matchError;
            setMatch(matchData);

            // Init Form
            setWinnerId(gameData.winner_id);

            setStats({
                is_break_and_run: gameData.is_break_and_run || false,
                is_rack_and_run: gameData.is_rack_and_run || false,
                is_9_on_snap: gameData.is_9_on_snap || false,

                is_early_8: gameData.is_early_8 || false,
                is_scratch_8: gameData.is_scratch_8 || false,
                innings: 1 // No innings column in games yet
            });

        } catch (e: any) {
            Alert.alert("Error", e.message);
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!match || !game) return;
        setSaving(true);
        try {
            const token = await getToken({ template: 'supabase' });
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
            );

            // 1. Update Game (Games Table)
            const updates: any = {
                winner_id: winnerId,
                is_break_and_run: stats.is_break_and_run,
                is_rack_and_run: stats.is_rack_and_run,
                is_9_on_snap: stats.is_9_on_snap,

                is_early_8: stats.is_early_8,
                is_scratch_8: stats.is_scratch_8
            };

            const { error: gameError } = await supabase
                .from("games")
                .update(updates)
                .eq("id", id);

            if (gameError) throw gameError;

            // 2. Recalculate Match Totals
            // Fetch ALL games for this match
            const { data: allGames, error: fetchAllError } = await supabase
                .from("games")
                .select("*")
                .eq("match_id", match.id);

            if (fetchAllError) throw fetchAllError;

            let totalP1 = 0;
            let totalP2 = 0;
            const gameType = game.game_type;
            const typeGames = allGames.filter((g: any) => g.game_type === gameType);

            typeGames.forEach((g: any) => {
                if (g.winner_id === match.player1.id) totalP1++;
                else if (g.winner_id === match.player2.id) totalP2++;
            });

            const matchUpdates: any = {};
            if (gameType === '8ball') {
                matchUpdates.points_8ball_p1 = totalP1;
                matchUpdates.points_8ball_p2 = totalP2;
                // Un-finalize if below race
                if (totalP1 < match.race_8ball_p1 && totalP2 < match.race_8ball_p2) {
                    matchUpdates.status_8ball = 'in_progress';
                    matchUpdates.winner_id_8ball = null;
                }
            } else {
                matchUpdates.points_9ball_p1 = totalP1;
                matchUpdates.points_9ball_p2 = totalP2;
                // Un-finalize if below race
                if (totalP1 < match.race_9ball_p1 && totalP2 < match.race_9ball_p2) {
                    matchUpdates.status_9ball = 'in_progress';
                    matchUpdates.winner_id_9ball = null;
                }
            }
            // Check global status
            if (matchUpdates.status_8ball === 'in_progress' || matchUpdates.status_9ball === 'in_progress') {
                matchUpdates.status = 'in_progress';
            }

            const { error: matchUpdateError } = await supabase
                .from("matches")
                .update(matchUpdates)
                .eq("id", match.id);

            if (matchUpdateError) throw matchUpdateError;

            Alert.alert("Success", "Game updated", [{
                text: "OK",
                onPress: () => router.replace({
                    pathname: "/match/[id]",
                    params: {
                        id: match.id,
                        returnToScore: "true",
                        activeType: game.game_type
                    }
                })
            }]);

        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert("Delete Game", "Are you sure you want to delete this game? This will update the match score.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    setSaving(true);
                    try {
                        const token = await getToken({ template: 'supabase' });
                        const supabase = createClient(
                            process.env.EXPO_PUBLIC_SUPABASE_URL!,
                            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                            { global: { headers: token ? { Authorization: `Bearer ${token}` } : undefined } }
                        );

                        // Delete
                        const { error: delError } = await supabase
                            .from("games") // CHANGED
                            .delete()
                            .eq("id", id);

                        if (delError) throw delError;

                        // Recalculate
                        const { data: allGames, error: fetchAllError } = await supabase
                            .from("games") // CHANGED
                            .select("*")
                            .eq("match_id", match.id);

                        if (fetchAllError) throw fetchAllError;

                        let totalP1 = 0;
                        let totalP2 = 0;
                        const gameType = game.game_type;
                        const typeGames = allGames.filter((g: any) => g.game_type === gameType);

                        typeGames.forEach((g: any) => {
                            if (g.winner_id === match.player1.id) totalP1++;
                            else if (g.winner_id === match.player2.id) totalP2++;
                        });

                        const matchUpdates: any = {};
                        if (gameType === '8ball') {
                            matchUpdates.points_8ball_p1 = totalP1;
                            matchUpdates.points_8ball_p2 = totalP2;
                            // Un-finalize if below race
                            if (totalP1 < match.race_8ball_p1 && totalP2 < match.race_8ball_p2) {
                                matchUpdates.status_8ball = 'in_progress';
                                matchUpdates.winner_id_8ball = null;
                            }
                        } else {
                            matchUpdates.points_9ball_p1 = totalP1;
                            matchUpdates.points_9ball_p2 = totalP2;
                            // Un-finalize if below race
                            if (totalP1 < match.race_9ball_p1 && totalP2 < match.race_9ball_p2) {
                                matchUpdates.status_9ball = 'in_progress';
                                matchUpdates.winner_id_9ball = null;
                            }
                        }
                        // Check global status
                        if (matchUpdates.status_8ball === 'in_progress' || matchUpdates.status_9ball === 'in_progress') {
                            matchUpdates.status = 'in_progress';
                        }

                        await supabase.from("matches").update(matchUpdates).eq("id", match.id);

                        Alert.alert("Deleted", "Game deleted.", [{
                            text: "OK",
                            onPress: () => router.replace({
                                pathname: "/match/[id]",
                                params: {
                                    id: match.id,
                                    returnToScore: "true",
                                    activeType: game.game_type
                                }
                            })
                        }]);

                    } catch (e: any) {
                        Alert.alert("Error", e.message);
                        setSaving(false);
                    }
                }
            }
        ]);
    };

    if (loading || !game || !match) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#D4AF37" />
            </SafeAreaView>
        );
    }

    const StatSwitch = ({ label, value, onValueChange }: any) => (
        <View className="flex-row justify-between items-center bg-surface p-4 rounded-lg mb-2">
            <Text className="text-white font-bold flex-1 mr-4" numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: "#333", true: "#D4AF37" }}
                thumbColor={value ? "#fff" : "#f4f3f4"}
                disabled={isLocked}
            />
        </View>
    );

    const isLocked = match && game && (game.game_type === '8ball' ? match.status_8ball === 'finalized' : match.status_9ball === 'finalized');

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row justify-between items-center p-4 border-b border-border relative">
                {/* Left Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="z-10 w-16"
                >
                    <Text className="text-primary font-bold" numberOfLines={1} adjustsFontSizeToFit>Back</Text>
                </TouchableOpacity>

                {/* Centered Title */}
                <View className="absolute left-0 right-0 items-center justify-center pointer-events-none px-20">
                    <Text className="text-white font-bold text-lg text-center" numberOfLines={1} adjustsFontSizeToFit>Game {game.game_number}</Text>
                </View>

                {/* Right Button (Save) */}
                {!isLocked ? (
                    <TouchableOpacity onPress={handleSave} disabled={saving} className="z-10 w-16 items-end">
                        <Text className={`font-bold ${saving ? 'text-gray-500' : 'text-primary'}`} numberOfLines={1} adjustsFontSizeToFit>Save</Text>
                    </TouchableOpacity>
                ) : (
                    <View className="w-10" />
                )}
            </View>

            <ScrollView className="flex-1 p-4">
                {isLocked && (
                    <View className="bg-surface p-4 rounded-lg border border-yellow-600 mb-6 items-center">
                        <Text className="text-yellow-500 font-bold uppercase mb-1">SET FINALIZED</Text>
                        <Text className="text-gray-400 text-xs text-center">This game cannot be edited because the set has been finalized.</Text>
                    </View>
                )}

                {/* Winner Selection */}
                <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Winner</Text>
                <View className="flex-row gap-4 mb-6">
                    <TouchableOpacity
                        disabled={isLocked}
                        onPress={() => setWinnerId(match.player1.id)}
                        className={`flex-1 p-4 rounded-lg border ${winnerId === match.player1.id ? 'bg-primary border-primary' : 'bg-surface border-border'} items-center ${isLocked ? 'opacity-80' : ''}`}
                    >
                        <Text className={`font-bold ${winnerId === match.player1.id ? 'text-black' : 'text-white'} text-center w-full`} numberOfLines={1} adjustsFontSizeToFit>
                            {match.player1.nickname || match.player1.full_name?.split(' ')[0]}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        disabled={isLocked}
                        onPress={() => setWinnerId(match.player2.id)}
                        className={`flex-1 p-4 rounded-lg border ${winnerId === match.player2.id ? 'bg-primary border-primary' : 'bg-surface border-border'} items-center ${isLocked ? 'opacity-80' : ''}`}
                    >
                        <Text className={`font-bold ${winnerId === match.player2.id ? 'text-black' : 'text-white'} text-center w-full`} numberOfLines={1} adjustsFontSizeToFit>
                            {match.player2.nickname || match.player2.full_name?.split(' ')[0]}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Stats</Text>

                {game.game_type === '8ball' ? (
                    <>
                        <StatSwitch
                            label="Break & Run"
                            value={stats.is_break_and_run}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_break_and_run: v })}
                        />
                        <StatSwitch
                            label="Rack & Run"
                            value={stats.is_rack_and_run}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_rack_and_run: v })}
                        />
                        <StatSwitch
                            label="Early 8"
                            value={stats.is_early_8}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_early_8: v })}
                        />
                        <StatSwitch
                            label="8 Wrong Pocket / Scratch"
                            value={stats.is_scratch_8}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_scratch_8: v })}
                        />
                    </>
                ) : (
                    <>
                        <StatSwitch
                            label="Break & Run"
                            value={stats.is_break_and_run}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_break_and_run: v })}
                        />
                        <StatSwitch
                            label="9 on Snap"
                            value={stats.is_9_on_snap}
                            onValueChange={(v: boolean) => setStats({ ...stats, is_9_on_snap: v })}
                        />

                    </>
                )}

                {!isLocked && (
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="mt-8 bg-red-900/50 border border-red-800 p-4 rounded-lg items-center"
                    >
                        <Text className="text-red-400 font-bold w-full text-center" numberOfLines={1} adjustsFontSizeToFit>Delete Game</Text>
                    </TouchableOpacity>
                )}

                <View className="h-20" />
            </ScrollView>
        </SafeAreaView>
    );
}
