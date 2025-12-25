'use client';

import React from 'react';

interface StatsPoint {
    date: string;
    rating: number;
}

interface PlayerStatsGraphProps {
    data: StatsPoint[];
}

export default function PlayerStatsGraph({ data }: PlayerStatsGraphProps) {
    if (!data || data.length < 2) {
        return (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                Not enough data to show progress graph yet. Play more matches!
            </div>
        );
    }

    // Graph dimensions
    const width = 600;
    const height = 300;
    const padding = 40;

    // Scales
    const maxRating = 10;
    const minRating = 1;

    const xScale = (index: number) => {
        return padding + (index / (data.length - 1)) * (width - padding * 2);
    };

    const yScale = (value: number) => {
        // Map 1-10 to height-0
        return height - padding - ((value - minRating) / (maxRating - minRating)) * (height - padding * 2);
    };

    // Generate path
    const pathD = data.map((point, i) => {
        const x = xScale(i);
        const y = yScale(point.rating);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem", height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#888" }}>Loading graph...</span>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", color: "var(--foreground)" }}>Breakpoint Progress</h3>
            <div style={{ width: "100%", overflowX: "auto" }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
                    {/* Grid lines */}
                    {[1, 3, 5, 7, 10].map(tick => (
                        <g key={tick}>
                            <line
                                x1={padding}
                                y1={yScale(tick)}
                                x2={width - padding}
                                y2={yScale(tick)}
                                stroke="var(--border)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={padding - 10}
                                y={yScale(tick) + 4}
                                textAnchor="end"
                                fontSize="12"
                                fill="#888"
                            >
                                {tick}
                            </text>
                        </g>
                    ))}

                    {/* X Axis Labels */}
                    {data.map((point, i) => {
                        if (i === 0 || i === data.length - 1 || (data.length > 10 && i % Math.floor(data.length / 5) === 0)) {
                            return (
                                <text
                                    key={i}
                                    x={xScale(i)}
                                    y={height - 10}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#888"
                                >
                                    {point.date}
                                </text>
                            );
                        }
                        return null;
                    })}

                    {/* The Line */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data Points */}
                    {data.map((point, i) => (
                        <circle
                            key={i}
                            cx={xScale(i)}
                            cy={yScale(point.rating)}
                            r="4"
                            fill="var(--background)"
                            stroke="var(--primary)"
                            strokeWidth="2"
                        >
                            <title>{point.date}: {point.rating}</title>
                        </circle>
                    ))}
                </svg>
            </div>
        </div>
    );
}
