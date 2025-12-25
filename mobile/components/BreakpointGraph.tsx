import { View, Text } from "react-native";
import React from "react";

interface StatsPoint {
    date: string;
    rating: number; // Breakpoint Level 1-10
}

interface BreakpointGraphProps {
    data: StatsPoint[];
}

export default function BreakpointGraph({ data }: BreakpointGraphProps) {
    if (!data || data.length < 2) {
        return (
            <View className="bg-surface p-6 rounded-lg border border-border items-center justify-center mb-6">
                <Text className="text-gray-500 text-center">Play more matches to see your Breakpoint progress!</Text>
            </View>
        );
    }

    // Take last 10 points max
    const recentData = data.slice(-10);
    const maxLevel = 10;
    const minLevel = 1;

    const graphHeight = 150;
    const containerWidth = 300; // Approximate available width (p-4 = 16px padding on sides)

    // Helper to calculate X and Y for a point
    // We assume equal spacing for X
    const getCoordinates = (index: number, rating: number, count: number) => {
        const xStep = count > 1 ? (containerWidth / (count - 1)) : 0;
        const x = index * xStep;

        // Y is inverted (0 is top)
        // Rating 10 -> Y=0, Rating 1 -> Y=Height
        const normalizedRating = (rating - minLevel) / (maxLevel - minLevel);
        const y = graphHeight - (normalizedRating * graphHeight);
        return { x, y };
    };

    return (
        <View className="bg-surface p-4 rounded-lg border border-border mb-6">
            <Text className="text-gray-300 text-xs font-bold uppercase tracking-wider mb-4">Breakpoint History</Text>

            <View style={{ height: graphHeight + 30, width: '100%', position: 'relative' }}>
                {/* Y-Axis Grid Lines (Optional) */}
                <View className="absolute w-full h-full border-l border-b border-border/50" />

                {/* Draw Lines */}
                {recentData.map((point, i) => {
                    if (i === recentData.length - 1) return null;
                    const nextPoint = recentData[i + 1];

                    const p1 = getCoordinates(i, point.rating, recentData.length);
                    const p2 = getCoordinates(i + 1, nextPoint.rating, recentData.length);

                    // Calculate distance and angle
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    // Center point of the line
                    const cx = (p1.x + p2.x) / 2;
                    const cy = (p1.y + p2.y) / 2;

                    return (
                        <View
                            key={`line-${i}`}
                            style={{
                                position: 'absolute',
                                left: cx - length / 2,
                                top: cy - 1,
                                width: length + 1.5, // Slight overlap to prevent gaps
                                height: 2,
                                backgroundColor: '#D4AF37',
                                transform: [{ rotate: `${angle}deg` }],
                                zIndex: 1
                            }}
                        />
                    );
                })}

                {/* Draw Points */}
                {recentData.map((point, i) => {
                    const { x, y } = getCoordinates(i, point.rating, recentData.length);
                    return (
                        <View key={`point-${i}`} style={{ position: 'absolute', left: x - 4, top: y - 4, zIndex: 2 }}>
                            <View className="w-2 h-2 bg-background border-2 border-primary rounded-full" />
                            {/* Date Label */}
                            <Text style={{ position: 'absolute', top: 12, left: -20, width: 50, textAlign: 'center', fontSize: 9, color: '#AAA' }}>
                                {new Date(point.date).getMonth() + 1}/{new Date(point.date).getDate()}
                            </Text>
                            {/* Rating Label (Top of point) */}
                            <Text style={{ position: 'absolute', top: -16, left: -20, width: 50, textAlign: 'center', fontSize: 10, color: '#D4AF37', fontWeight: 'bold' }}>
                                {point.rating}
                            </Text>
                        </View>
                    );
                })}


            </View>
        </View>
    );
}
