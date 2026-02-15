export function isMatchDateLocked(scheduledDate: string | null, timezone: string = "America/Chicago"): { locked: boolean; reason?: string } {
    if (!scheduledDate) return { locked: false }; // No date = unlocked

    // Parse the scheduled_date string (YYYY-MM-DD)
    const datePart = new Date(scheduledDate).toISOString().split('T')[0];

    // Current Time in Target Timezone
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const nowYear = parseInt(getPart('year')!);
    const nowMonth = parseInt(getPart('month')!);
    const nowDay = parseInt(getPart('day')!);
    const nowHour = parseInt(getPart('hour')!);

    // Parse Match Date (YYYY-MM-DD)
    const [mYear, mMonth, mDay] = datePart.split('-').map(Number);

    // Compare Dates (YYYYMMDD)
    const nowYMD = nowYear * 10000 + nowMonth * 100 + nowDay;
    const matchYMD = mYear * 10000 + mMonth * 100 + mDay;

    // Logic:
    // Today < MatchDay -> LOCKED (Future)
    // Today == MatchDay -> 
    //      Hour < 8 -> LOCKED (Too early)
    //      Hour >= 8 -> UNLOCKED (Open)
    // Today > MatchDay ->
    //      Today == MatchDay + 1 ->
    //          Hour < 8 -> UNLOCKED (Open late night)
    //          Hour >= 8 -> LOCKED (Expired)
    //      Today > MatchDay + 1 -> LOCKED (Expired)

    if (nowYMD < matchYMD) {
        return { locked: true, reason: `Match starts on ${datePart} at 8:00 AM (${timezone}).` };
    }

    if (nowYMD === matchYMD) {
        if (nowHour < 8) {
            return { locked: true, reason: `Match starts at 8:00 AM (${timezone}).` };
        }
        return { locked: false };
    }

    if (nowYMD > matchYMD) {
        // Calculate Next Day YMD
        const matchDateObj = new Date(mYear, mMonth - 1, mDay);
        const nextDateObj = new Date(matchDateObj);
        nextDateObj.setDate(nextDateObj.getDate() + 1);

        const nYear = nextDateObj.getFullYear();
        const nMonth = nextDateObj.getMonth() + 1;
        const nDay = nextDateObj.getDate();

        const nextYMD = nYear * 10000 + nMonth * 100 + nDay;

        if (nowYMD === nextYMD) {
            if (nowHour < 8) {
                return { locked: false };
            }
            return { locked: true, reason: `Match window ended today at 8:00 AM (${timezone}).` };
        }

        return { locked: true, reason: `Match window expired.` };
    }

    return { locked: true, reason: "Match is locked." };
}
