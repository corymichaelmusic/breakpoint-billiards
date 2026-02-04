import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Alert, Image, ActionSheetIOS, Platform, DeviceEventEmitter, ScrollView, Modal, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import QRCode from 'react-native-qrcode-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getBreakpointLevel, getBreakpointRatingDescription, getConfidenceDescription } from "../../utils/rating";

const CONFIDENCE_LEVELS = [
    { range: "< 100", name: "Provisional" },
    { range: "100-300", name: "Established" },
    { range: "300+", name: "Stable" },
];

const RATING_LEVELS = [
    { level: 1, name: "Beginner" },
    { level: 2, name: "Intermediate" },
    { level: 3, name: "Intermediate+" },
    { level: 4, name: "Intermediate++" },
    { level: 5, name: "Advanced" },
    { level: 6, name: "Advanced+" },
    { level: 7, name: "Advanced++" },
    { level: 8, name: "Top Regional" },
    { level: 9, name: "World Class" },
];

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const router = useRouter();
    const { signOut, userId, getToken } = useAuth();
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [editingNickname, setEditingNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState("");
    const [editingFargo, setEditingFargo] = useState(false);
    const [tempFargo, setTempFargo] = useState("");
    // Password change state
    const [changingPassword, setChangingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // New Account Details State
    const [newEmail, setNewEmail] = useState("");
    const [newPhone, setNewPhone] = useState("");

    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showRatingInfo, setShowRatingInfo] = useState(false);
    const [showConfidenceInfo, setShowConfidenceInfo] = useState(false);

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
                    .select('full_name, player_number, fargo_rating, breakpoint_rating, nickname, avatar_url')
                    .eq('id', userId)
                    .single();

                if (data) {
                    // Fetch confidence
                    const { data: leagueStats } = await supabase
                        .from('league_players')
                        .select('breakpoint_racks_played')
                        .eq('player_id', userId);
                    const confidence = leagueStats
                        ? leagueStats.reduce((sum: number, item: any) => sum + (item.breakpoint_racks_played || 0), 0)
                        : 0;

                    setProfile({ ...data, confidence });
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

            // 2. Upload via Backend Proxy
            // 2. Upload via Backend Proxy
            // Force Production URL to avoid local IP timeouts
            const API_URL = 'https://breakpoint-billiards.vercel.app/api/upload-avatar';

            console.log("Attempting upload to Production:", API_URL);

            // 3. Native File Upload
            // Get Token specifically for the backend API (not Supabase)
            const token = await getToken();

            const uploadResponse = await FileSystem.uploadAsync(API_URL, manipResult.uri, {
                fieldName: 'file',
                httpMethod: 'POST',
                // FileSystemUploadType.MULTIPART = 1
                uploadType: 1,
                headers: {
                    Authorization: `Bearer ${token}`
                },
                parameters: {
                    userId: userId
                }
            });

            console.log("Upload Status:", uploadResponse.status);

            const result = JSON.parse(uploadResponse.body);

            if (uploadResponse.status !== 200) {
                throw new Error(result.error || 'Upload failed');
            }

            const publicUrl = result.publicUrl;

            // Refresh local state
            setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));

            // Notify other components (Header) to refresh
            DeviceEventEmitter.emit('refreshProfile');

            // 4. SYNC TO CLERK (Fix for Web App mismatch)
            if (user) {
                try {
                    console.log("Syncing avatar to Clerk...");
                    const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
                    await user.setProfileImage({ file: `data:image/jpeg;base64,${base64}` });
                    console.log("Clerk Avatar Sync Success");
                } catch (clerkError) {
                    console.error("Clerk Sync Failed:", clerkError);
                    // Don't alert user, as the main upload succeeded
                }
            }

            Alert.alert("Success", "Avatar updated!");

        } catch (e: any) {
            console.error("Upload Error:", e);
            Alert.alert("Upload Failed", "Error: " + e.message);
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

            // Notify Header to update immediately
            DeviceEventEmitter.emit('refreshProfile');

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

    const handleUpdateAccountDetails = async () => {
        if (!user) {
            Alert.alert("Error", "User not found.");
            return;
        }

        // 1. Password Logic (Optional)
        const isChangingPassword = currentPassword || newPassword || confirmPassword;
        if (isChangingPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                Alert.alert("Missing Fields", "Please fill in all password fields to change password.");
                return;
            }
            if (newPassword !== confirmPassword) {
                Alert.alert("Password Mismatch", "New password and confirmation do not match.");
                return;
            }
            if (newPassword.length < 8) {
                Alert.alert("Password Too Short", "Password must be at least 8 characters.");
                return;
            }
        }

        setPasswordLoading(true);
        let allSuccess = true;

        try {
            // Password Update (Client Side)
            if (isChangingPassword) {
                await user.updatePassword({
                    currentPassword,
                    newPassword,
                });
            }

            // Email & Phone Update (Server Side to bypass verification requirement if needed)
            if ((newEmail && newEmail !== user.primaryEmailAddress?.emailAddress) ||
                (newPhone && newPhone !== user.primaryPhoneNumber?.phoneNumber)) {

                // Determine API URL (Localhost for dev, Prod for release)
                const BASE_URL = __DEV__
                    ? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
                    : 'https://breakpoint-billiards.vercel.app';

                console.log("Updating contact via:", BASE_URL);

                const token = await getToken();

                // Add 15s timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                try {
                    const response = await fetch(`${BASE_URL}/api/update-contact`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            email: (newEmail && newEmail !== user.primaryEmailAddress?.emailAddress) ? newEmail : undefined,
                            phone: (newPhone && newPhone !== user.primaryPhoneNumber?.phoneNumber) ? newPhone : undefined,
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    // Check for non-JSON responses (e.g. 404 HTML from Next.js if route missing)
                    const contentType = response.headers.get("content-type");
                    if (!contentType || !contentType.includes("application/json")) {
                        // Likely 404 or 500 HTML
                        const text = await response.text();
                        console.error("API returned non-JSON:", text.slice(0, 100));
                        throw new Error(`Server returned ${response.status} ${response.statusText}. Is the API running?`);
                    }

                    const result = await response.json();

                    if (!response.ok) {
                        allSuccess = false;
                        console.error("Update contact API error:", result);
                        let msg = result.error || "Failed to update contact info.";
                        if (msg.includes("taken") || msg.includes("exists")) {
                            msg = "This contact info is already associated with another account.";
                        }
                        Alert.alert("Update Failed", msg);
                    } else {
                        // Force reload user to see changes
                        await user.reload();
                    }
                } catch (err: any) {
                    allSuccess = false;
                    console.error("Fetch error:", err);
                    if (err.name === 'AbortError') {
                        Alert.alert("Timeout", "The request took too long. Please check your connection or try again.");
                    } else {
                        Alert.alert("Connection Error", "Could not connect to server. Ensure the backend is running. " + (err.message || ""));
                    }
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            // Only clear and close if EVERYTHING succeeded
            if (allSuccess) {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setChangingPassword(false);
                Alert.alert("Success", "Account details updated.");
            }
        } catch (e: any) {
            console.error("Update error:", e);
            const errorMessage = e.errors?.[0]?.message || e.message || "Failed to update account.";
            Alert.alert("Error", errorMessage);
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 100 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <View className="flex-1 items-center p-6">


                        {loading ? (
                            <ActivityIndicator color="#D4AF37" size="large" />
                        ) : profile ? (
                            <View className="w-full items-center">
                                {/* Player Name as Header */}
                                <Text className="text-white text-3xl font-bold mb-6 text-center uppercase tracking-wider" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                    {profile.full_name || 'Unknown Player'}
                                </Text>

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
                                    <View className="flex-row items-center mb-4 gap-2">
                                        <Text className="text-gray-400 text-lg uppercase tracking-wider" style={{ includeFontPadding: false }}>Member ID:</Text>
                                        <Text className="text-primary font-bold text-lg" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>#{profile.player_number || '---'}  </Text>
                                    </View>

                                    {/* Nickname Row */}
                                    <View className="flex-row items-center mb-6 gap-3">
                                        <Text className="text-gray-400 text-lg uppercase tracking-wider min-w-[110px] text-right" style={{ includeFontPadding: false }}>Nickname:</Text>
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
                                                <Text className="text-primary font-bold text-2xl" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                                    {profile.nickname || (profile.full_name ? profile.full_name.split(' ')[0] : '---')}
                                                </Text>
                                                <TouchableOpacity onPress={() => setEditingNickname(true)}>
                                                    <Ionicons name="pencil" size={18} color="#6b7280" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* Confidence Score Row */}
                                    <View className="flex-row items-center mb-8 gap-3">
                                        <Text className="text-gray-400 text-lg uppercase tracking-wider min-w-[110px] text-right" style={{ includeFontPadding: false }}>Confidence:</Text>
                                        <View className="flex-row items-baseline gap-2">
                                            <Text className="text-primary font-bold text-3xl" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                                {profile.confidence || 0}
                                            </Text>
                                            <TouchableOpacity onPress={() => setShowConfidenceInfo(true)}>
                                                <Text className="text-blue-400 text-sm font-bold uppercase tracking-wide">
                                                    {getConfidenceDescription(profile.confidence || 0)} <Ionicons name="information-circle-outline" size={14} color="#60a5fa" />
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Breakpoint Rating Row */}
                                    <View className="flex-row items-center mb-8 gap-3">
                                        <Text className="text-gray-400 text-lg uppercase tracking-wider min-w-[110px] text-right" style={{ includeFontPadding: false }}>Rating:</Text>
                                        <View className="flex-row items-baseline gap-2">
                                            <Text className="text-primary font-bold text-3xl" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                                {getBreakpointLevel(profile.breakpoint_rating || 500)}
                                            </Text>
                                            <TouchableOpacity onPress={() => setShowRatingInfo(true)}>
                                                <Text className="text-green-400 text-sm font-bold uppercase tracking-wide">
                                                    {getBreakpointRatingDescription(profile.breakpoint_rating || 500)} <Ionicons name="information-circle-outline" size={14} color="#4ade80" />
                                                </Text>
                                            </TouchableOpacity>
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
                        {/* Rating Info Modal */}
                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={showRatingInfo}
                            onRequestClose={() => setShowRatingInfo(false)}
                        >
                            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                                <View className="bg-surface border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-primary text-xl font-bold uppercase tracking-widest">Rating Levels</Text>
                                        <TouchableOpacity onPress={() => setShowRatingInfo(false)} className="p-2">
                                            <Ionicons name="close" size={24} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="gap-2">
                                        {RATING_LEVELS.map((item) => {
                                            const currentDesc = getBreakpointRatingDescription(profile?.breakpoint_rating || 500);
                                            const isCurrent = item.name === currentDesc;

                                            return (
                                                <View
                                                    key={item.level}
                                                    className={`flex-row justify-between items-center p-3 rounded-lg ${isCurrent ? 'bg-primary/20 border border-primary/50' : 'bg-white/5'}`}
                                                >
                                                    <View className="flex-row items-center gap-3">
                                                        <View className={`w-8 h-8 rounded-full items-center justify-center ${isCurrent ? 'bg-primary' : 'bg-gray-700'}`}>
                                                            <Text className={`font-bold ${isCurrent ? 'text-black' : 'text-gray-400'}`}>{item.level}</Text>
                                                        </View>
                                                        <Text className={`font-bold uppercase ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                                            {item.name}
                                                        </Text>
                                                    </View>
                                                    {isCurrent && <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>
                        </Modal>

                        {/* Confidence Info Modal */}
                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={showConfidenceInfo}
                            onRequestClose={() => setShowConfidenceInfo(false)}
                        >
                            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                                <View className="bg-surface border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-primary text-xl font-bold uppercase tracking-widest">Confidence Levels</Text>
                                        <TouchableOpacity onPress={() => setShowConfidenceInfo(false)} className="p-2">
                                            <Ionicons name="close" size={24} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="gap-2">
                                        <View className="flex-row items-center justify-between px-3 mb-1">
                                            <Text className="text-gray-400 text-xs font-bold uppercase w-16 text-center">Racks</Text>
                                            <Text className="text-gray-400 text-xs font-bold uppercase flex-1 text-right">Category</Text>
                                        </View>

                                        {CONFIDENCE_LEVELS.map((item) => {
                                            const currentDesc = getConfidenceDescription(profile?.confidence || 0);
                                            const isCurrent = item.name === currentDesc;

                                            return (
                                                <View
                                                    key={item.name}
                                                    className={`flex-row items-center justify-between p-3 rounded-lg ${isCurrent ? 'bg-primary/20 border border-primary/50' : 'bg-white/5'}`}
                                                >
                                                    <Text className={`font-bold w-16 text-center ${isCurrent ? 'text-primary' : 'text-gray-400'}`}>{item.range}</Text>
                                                    <Text className={`font-bold uppercase flex-1 text-right ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                                        {item.name}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>
                        </Modal>

                    </View>


                    <View className="p-6 bg-background border-t border-white/5 gap-3">
                        {/* SETTINGS TOGGLE BUTTON */}
                        <TouchableOpacity
                            onPress={() => setShowSettings(!showSettings)}
                            className="flex-row items-center justify-between bg-surface border border-border py-4 px-6 rounded-xl active:bg-surface-hover"
                        >
                            <View className="flex-row items-center gap-3">
                                <Ionicons name="settings-outline" size={20} color="#D4AF37" />
                                <Text className="text-white font-bold text-lg uppercase tracking-wider" style={{ includeFontPadding: false }}>
                                    Settings
                                </Text>
                            </View>
                            <Ionicons name={showSettings ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                        </TouchableOpacity>

                        {/* EXPANDABLE CONTENT */}
                        {showSettings && (
                            <View className="gap-3 mt-2 pl-2 border-l-2 border-primary/20">

                                {/* Account Details Section */}
                                <View className="mb-2">
                                    {!changingPassword ? (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setChangingPassword(true);
                                                // Pre-fill email/phone from user object
                                                if (user) {
                                                    setNewEmail(user.primaryEmailAddress?.emailAddress || "");
                                                    setNewPhone(user.primaryPhoneNumber?.phoneNumber || "");
                                                }
                                            }}
                                            className="bg-primary/10 border border-primary/50 py-4 rounded-lg items-center active:bg-primary/20"
                                        >
                                            <Text className="text-primary font-bold uppercase tracking-widest" style={{ includeFontPadding: false }}>
                                                Account Details
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="bg-surface border border-border rounded-xl p-4 gap-3">
                                            <Text className="text-white font-bold text-lg text-center mb-2">Account Details</Text>

                                            {/* Email */}
                                            <View>
                                                <Text className="text-gray-400 text-xs uppercase mb-1 ml-1">Email</Text>
                                                <TextInput
                                                    value={newEmail}
                                                    onChangeText={setNewEmail}
                                                    placeholder="Email Address"
                                                    placeholderTextColor="#666"
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                                />
                                            </View>

                                            {/* Phone */}
                                            <View>
                                                <Text className="text-gray-400 text-xs uppercase mb-1 ml-1">Phone</Text>
                                                <TextInput
                                                    value={newPhone}
                                                    onChangeText={setNewPhone}
                                                    placeholder="Phone Number"
                                                    placeholderTextColor="#666"
                                                    keyboardType="phone-pad"
                                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                                />
                                            </View>

                                            {/* Password Change (Optional) */}
                                            <View className="border-t border-white/10 pt-3 mt-1">
                                                <Text className="text-gray-400 text-xs uppercase mb-2 ml-1">Change Password</Text>
                                                <TextInput
                                                    value={currentPassword}
                                                    onChangeText={setCurrentPassword}
                                                    placeholder="Current Password"
                                                    placeholderTextColor="#666"
                                                    secureTextEntry
                                                    className="bg-white/10 text-white px-4 py-3 rounded-lg mb-3"
                                                />
                                                <TextInput
                                                    value={newPassword}
                                                    onChangeText={setNewPassword}
                                                    placeholder="New Password"
                                                    placeholderTextColor="#666"
                                                    secureTextEntry
                                                    className="bg-white/10 text-white px-4 py-3 rounded-lg mb-3"
                                                />
                                                <TextInput
                                                    value={confirmPassword}
                                                    onChangeText={setConfirmPassword}
                                                    placeholder="Confirm New Password"
                                                    placeholderTextColor="#666"
                                                    secureTextEntry
                                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                                />
                                            </View>

                                            <View className="flex-row gap-3 mt-2">
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setChangingPassword(false);
                                                        setCurrentPassword("");
                                                        setNewPassword("");
                                                        setConfirmPassword("");
                                                    }}
                                                    className="flex-1 bg-gray-600/20 py-3 rounded-lg items-center"
                                                    disabled={passwordLoading}
                                                >
                                                    <Text className="text-gray-400 font-bold">Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={handleUpdateAccountDetails}
                                                    className="flex-1 bg-primary py-3 rounded-lg items-center"
                                                    disabled={passwordLoading}
                                                >
                                                    {passwordLoading ? (
                                                        <ActivityIndicator color="#000" />
                                                    ) : (
                                                        <Text className="text-black font-bold">Update</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity onPress={() => signOut()} className="bg-red-500/10 border border-red-500/50 py-4 rounded-lg items-center active:bg-red-500/20">
                                    <Text className="text-red-500 font-bold uppercase tracking-widest" style={{ includeFontPadding: false }}>Sign Out </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.alert(
                                            "Delete Account",
                                            "Your account will be scheduled for deletion within 24 hours. This action cannot be undone. All your data will be permanently removed.",
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                {
                                                    text: "Delete My Account",
                                                    style: "destructive",
                                                    onPress: async () => {
                                                        try {
                                                            const token = await getToken();
                                                            const response = await fetch('https://breakpoint-billiards.vercel.app/api/request-deletion', {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${token}`
                                                                }
                                                            });

                                                            const result = await response.json();

                                                            if (result.success) {
                                                                Alert.alert(
                                                                    "Request Submitted",
                                                                    "Your account deletion request has been submitted. Your account will be deleted within 24 hours.",
                                                                    [{ text: "OK", onPress: () => signOut() }]
                                                                );
                                                            } else {
                                                                Alert.alert("Error", result.error || "Failed to submit deletion request.");
                                                            }
                                                        } catch (e: any) {
                                                            console.error("Deletion request error:", e);
                                                            Alert.alert("Error", "Failed to submit deletion request. Please try again.");
                                                        }
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                    className="bg-transparent border border-gray-600 py-3 rounded-lg items-center active:bg-gray-800"
                                >
                                    <Text className="text-gray-400 text-sm uppercase tracking-widest" style={{ includeFontPadding: false }}>Delete My Account</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
