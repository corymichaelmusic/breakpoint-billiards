
// Map Fargo Rating to Breakpoint Level (1-10)
// Map Fargo Rating to Breakpoint Level (1-10)
// This is the SINGLE SOURCE OF TRUTH for displaying ratings.
export function getBreakpointLevel(rating: number): string {

    if (!rating) return "5.0"; // Default

    // User Logic: Move decimal 2 places to left and display to tenths place (Truncated)
    // e.g. 549.93 -> 5.4
    // e.g. 450.60 -> 4.5
    const val = Math.floor(rating / 10) / 10;
    return val.toFixed(1);
}

export function getBreakpointRatingDescription(rating: number): string {
    if (!rating && rating !== 0) return "Unknown";
    if (rating <= 344) return "Beginner";
    if (rating <= 436) return "Intermediate";
    if (rating <= 499) return "Intermediate+";
    if (rating <= 561) return "Good League Player";
    if (rating <= 624) return "Advanced";
    if (rating <= 686) return "Advanced+";
    if (rating <= 749) return "Semi-Pro";
    if (rating <= 875) return "Top Regional";
    if (rating <= 875) return "Top Regional";
    return "World Class";
}

export function getConfidenceDescription(score: number): string {
    if (score < 100) return "Provisional";
    if (score <= 300) return "Established";
    return "Stable";
}

export function calculateEloChange(playerRating: number, opponentRating: number, isWin: boolean): number {
    const K_WIN = 30;
    const K_LOSS = 15;
    const K = isWin ? K_WIN : K_LOSS;

    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = isWin ? 1 : 0;

    return Math.round(K * (actualScore - expectedScore));
}

import { supabase } from '../lib/supabase';

// Deprecated local calculation - logic now on server
// export function calculateRace(...) { ... }

export async function fetchMatchRaces(matches: Array<{ id: string, p1Rating: number, p2Rating: number }>) {
    try {
        const { data, error } = await supabase.functions.invoke('calculate-race', {
            body: { matches }
        });

        if (error) {
            console.error('Error fetching races:', error);
            return null;
        }

        return data; // Returns { [matchId]: { race8: {p1, p2}, race9: {p1, p2} } }
    } catch (e) {
        console.error('Exception fetching races:', e);
        return null;
    }
}

