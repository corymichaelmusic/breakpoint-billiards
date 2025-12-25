export function calculateRace(rating1: number, rating2: number) {
    // Short Race Formula: Rating / 20 (User approved)
    const shortP1 = Math.max(1, Math.round(rating1 / 20));
    const shortP2 = Math.max(1, Math.round(rating2 / 20));

    // Long Race Formula: Short * 1.33 (Derived from USAPL calculator ratio ~4/3)
    const longP1 = Math.max(1, Math.round(shortP1 * 1.33));
    const longP2 = Math.max(1, Math.round(shortP2 * 1.33));

    return {
        short: { p1: shortP1, p2: shortP2 },
        long: { p1: longP1, p2: longP2 }
    };
}
