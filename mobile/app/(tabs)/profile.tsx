import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Alert, Image, ActionSheetIOS, Platform, DeviceEventEmitter } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const router = useRouter();
    const { signOut, userId, getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [editingNickname, setEditingNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState("");
    const [editingFargo, setEditingFargo] = useState(false);
    const [tempFargo, setTempFargo] = useState("");

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                if (!userId) return;
                const token = await getToken({ template: 'supabase' });
                const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

                const supabase = createClient(
                    process.env.EXPO_PUBLIC_SUPABASE_URL!,
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    { global: { headers: authHeader } }
                );

                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, player_number, fargo_rating, nickname, avatar_url')
                    .eq('id', userId)
                    .single();

                if (data) {
                    setProfile(data);
                    setTempFargo(data.fargo_rating ? String(data.fargo_rating) : "500");
                    setTempNickname(data.nickname || "");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [userId]);

    const handleAvatarPress = () => {
        Alert.alert(
            "Update Profile Picture",
            "Choose an option",
            [
                { text: "Take Photo", onPress: takePhoto },
                { text: "Choose from Library", onPress: pickImage },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const pickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission Required", "Need access to your photos.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (!result.canceled) {
                handleImageUpload(result.assets[0].uri);
            }
        } catch (e) {
            console.error("Pick Error", e);
            Alert.alert("Error", "Failed to pick image.");
        }
    };

    const takePhoto = async () => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission Required", "Need access to your camera.");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (!result.canceled) {
                handleImageUpload(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert("Error", "Failed to open camera.");
        }
    };

    const handleImageUpload = async (uri: string) => {
        if (!userId) return;
        setUploading(true);

        try {
            // 1. Resize/Compress
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 500, height: 500 } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 2. Upload via Backend Proxy (Local IP)
            // Using found Local IP: 192.168.1.43
            const API_URL = 'http://192.168.1.43:3000/api/upload-avatar';

            const formData = new FormData();
            formData.append('userId', userId);

            // @ts-ignore
            formData.append('file', {
                uri: manipResult.uri,
                name: 'avatar.jpg',
                type: 'image/jpeg'
            });

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            const publicUrl = result.publicUrl;

            // Refresh local state
            setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));

            // Notify other components (Header) to refresh
            DeviceEventEmitter.emit('refreshProfile');

            Alert.alert("Success", "Avatar updated!");

        } catch (e: any) {
            console.error("Upload Error:", e);
            Alert.alert("Upload Failed", "Backend Error: " + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateNickname = async () => {
        // Allow empty string to clear nickname
        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            const { error } = await supabase
                .from('profiles')
                .update({ nickname: tempNickname || null })
                .eq('id', userId);

            if (error) throw error;

            setProfile((prev: any) => ({ ...prev, nickname: tempNickname || null }));
            setEditingNickname(false);
            Alert.alert("Success", "Nickname updated.");
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    const handleUpdateFargo = async () => {
        if (!tempFargo) return;
        const rating = parseInt(tempFargo);
        if (isNaN(rating)) {
            Alert.alert("Invalid Rating", "Please enter a valid number.");
            return;
        }

        try {
            const token = await getToken({ template: 'supabase' });
            const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;
            const supabase = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                { global: { headers: authHeader } }
            );

            const { error } = await supabase
                .from('profiles')
                .update({ fargo_rating: rating })
                .eq('id', userId);

            if (error) throw error;

            setProfile((prev: any) => ({ ...prev, fargo_rating: rating }));
            setEditingFargo(false);
            Alert.alert("Success", "Fargo Rating updated.");
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 items-center p-6">


                {loading ? (
                    <ActivityIndicator color="#D4AF37" size="large" />
                ) : profile ? (
                    <View className="w-full items-center">
                        {/* Player Name as Header */}
                        <Text className="text-white text-3xl font-bold mb-6 text-center uppercase tracking-wider">{profile.full_name || 'Unknown Player'}</Text>

                        {/* Avatar Edit Section */}
                        <TouchableOpacity onPress={handleAvatarPress} disabled={uploading} className="mb-6 relative">
                            <View className="w-32 h-32 rounded-full border-4 border-primary overflow-hidden bg-surface items-center justify-center">
                                {profile.avatar_url ? (
                                    <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                                ) : (
                                    <Ionicons name="person" size={64} color="#666" />
                                )}
                                {uploading && (
                                    <View className="absolute inset-0 bg-black/50 items-center justify-center">
                                        <ActivityIndicator color="#D4AF37" />
                                    </View>
                                )}
                            </View>
                            <View className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-2 border-surface">
                                <Ionicons name="camera" size={16} color="black" />
                            </View>
                        </TouchableOpacity>

                        <View className="w-full bg-surface border border-border rounded-xl p-6 items-center shadow-lg">
                            {/* Member ID */}
                            <Text className="text-gray-400 text-lg mb-4 uppercase tracking-wider">
                                Member ID: <Text className="text-primary font-bold">#{profile.player_number || '---'}</Text>
                            </Text>

                            {/* Nickname Row */}
                            <View className="flex-row items-center mb-6 gap-3">
                                <Text className="text-gray-400 text-lg uppercase tracking-wider w-24 text-right">Nickname:</Text>
                                {editingNickname ? (
                                    <View className="flex-row items-center gap-2">
                                        <TextInput
                                            value={tempNickname}
                                            onChangeText={setTempNickname}
                                            className="bg-white/10 text-primary font-bold text-lg px-3 py-1 rounded w-32 text-center"
                                            autoFocus
                                            placeholder="Optional"
                                            placeholderTextColor="#666"
                                        />
                                        <TouchableOpacity onPress={handleUpdateNickname} className="bg-green-600/20 p-2 rounded-full">
                                            <Ionicons name="checkmark" size={20} color="#4ade80" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            setEditingNickname(false);
                                            setTempNickname(profile.nickname || "");
                                        }} className="bg-red-600/20 p-2 rounded-full">
                                            <Ionicons name="close" size={20} color="#f87171" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="flex-row items-center gap-3">
                                        <Text className="text-primary font-bold text-2xl">{profile.nickname || (profile.full_name ? profile.full_name.split(' ')[0] : '---')}</Text>
                                        <TouchableOpacity onPress={() => setEditingNickname(true)}>
                                            <Ionicons name="pencil" size={18} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Fargo Rating Row */}
                            <View className="flex-row items-center mb-8 gap-3">
                                <Text className="text-gray-400 text-lg uppercase tracking-wider w-24 text-right">Fargo:</Text>
                                <View className="flex-row items-center gap-3">
                                    <Text className="text-primary font-bold text-3xl">{profile.fargo_rating || 500}</Text>
                                    {/* Edit Removed per user request */}
                                    {/* <TouchableOpacity onPress={() => setEditingFargo(true)}>
                                        <Ionicons name="pencil" size={18} color="#6b7280" />
                                    </TouchableOpacity> */}
                                </View>
                            </View>

                            {/* QR Code Section */}
                            <View className="bg-white p-4 rounded-lg items-center justify-center">
                                {profile.player_number ? (
                                    <QRCode
                                        value={String(profile.player_number)}
                                        size={160}
                                    />
                                ) : (
                                    <Text className="text-black">No ID Assigned</Text>
                                )}
                            </View>

                        </View>
                    </View>
                ) : (
                    <Text className="text-gray-500">Could not load profile.</Text>
                )}
            </View>

            <View className="p-6">
                <TouchableOpacity onPress={() => signOut()} className="bg-red-500/10 border border-red-500/50 py-4 rounded-lg items-center active:bg-red-500/20">
                    <Text className="text-red-500 font-bold uppercase tracking-widest">Sign Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
