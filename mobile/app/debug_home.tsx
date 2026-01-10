import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

export default function DebugHome() {
    const { signOut } = useAuth();

    // REMOVED SAFE AREA VIEW TO TEST FABRIC CRASH COMPATIBILITY
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Debug Home (No SafeArea)</Text>
            <Text style={styles.subtitle}>
                If this loads, the previous crash was caused by SafeAreaView or Nav Icons on Fabric.
            </Text>
            <TouchableOpacity
                onPress={() => signOut()}
                style={styles.button}
            >
                <Text style={styles.text}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80, // Manual safe area
    },
    title: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    subtitle: {
        color: '#999999',
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    button: {
        backgroundColor: '#FF0000',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    text: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    }
});
