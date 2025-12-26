import { View, Text } from "react-native";

interface StatsCardProps {
    label: string;
    value: React.ReactNode;
    subValue?: string;
    highlight?: boolean;
}

export default function StatsCard({ label, value, subValue, highlight }: StatsCardProps) {
    return (
        <View className={`flex-1 bg-surface p-4 rounded-lg border border-border items-center justify-center ${highlight ? 'border-primary' : ''}`}>
            <Text className="text-gray-400 text-xs uppercase mb-1 tracking-wider font-bold">{label}</Text>
            {typeof value === 'string' || typeof value === 'number' ? (
                <Text className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</Text>
            ) : (
                value
            )}
            {subValue && <Text className="text-gray-500 text-xs mt-1">{subValue}</Text>}
        </View>
    );
}
