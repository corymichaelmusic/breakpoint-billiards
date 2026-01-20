import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Alert, Image, ActionSheetIOS, Platform, DeviceEventEmitter, ScrollView } from "react-native";
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
    const [passwordLoading, setPasswordLoading] = useState(false);

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

    const handleChangePassword = async () => {
        if (!user) {
            Alert.alert("Error", "User not found.");
            return;
        }

        // Validate inputs
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Missing Fields", "Please fill in all password fields.");
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

        setPasswordLoading(true);
        try {
            await user.updatePassword({
                currentPassword,
                newPassword,
            });

            // Reset form and close
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setChangingPassword(false);
            Alert.alert("Success", "Your password has been changed.");
        } catch (e: any) {
            console.error("Password change error:", e);
            const errorMessage = e.errors?.[0]?.message || e.message || "Failed to change password.";
            Alert.alert("Error", errorMessage);
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
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

                                {/* Fargo Rating Row */}
                                <View className="flex-row items-center mb-8 gap-3">
                                    <Text className="text-gray-400 text-lg uppercase tracking-wider min-w-[110px] text-right" style={{ includeFontPadding: false }}>Fargo:</Text>
                                    <View className="flex-row items-center gap-3">
                                        <Text className="text-primary font-bold text-3xl" style={{ includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                                            {profile.fargo_rating || 500}
                                        </Text>
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

            </ScrollView>

            <View className="p-6 bg-background border-t border-white/5 gap-3">
                {/* Change Password Section - Only show if user has password enabled */}
                {user?.passwordEnabled && (
                    <View className="mb-2">
                        {!changingPassword ? (
                            <TouchableOpacity
                                onPress={() => setChangingPassword(true)}
                                className="bg-primary/10 border border-primary/50 py-4 rounded-lg items-center active:bg-primary/20"
                            >
                                <Text className="text-primary font-bold uppercase tracking-widest" style={{ includeFontPadding: false }}>
                                    Change Password
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="bg-surface border border-border rounded-xl p-4 gap-3">
                                <Text className="text-white font-bold text-lg text-center mb-2">Change Password</Text>
                                <TextInput
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    placeholder="Current Password"
                                    placeholderTextColor="#666"
                                    secureTextEntry
                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                />
                                <TextInput
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="New Password"
                                    placeholderTextColor="#666"
                                    secureTextEntry
                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                />
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm New Password"
                                    placeholderTextColor="#666"
                                    secureTextEntry
                                    className="bg-white/10 text-white px-4 py-3 rounded-lg"
                                />
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
                                        onPress={handleChangePassword}
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
                )}

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
        </SafeAreaView >
    );
}
