export const isMatchLocked = (scheduledDate: string | null, timezone: string = 'America/Chicago', isManuallyUnlocked: boolean = false, matchStatus: string = 'scheduled', isStarted: boolean = false) => {
    // 1. Manual Unlock overrides everything
    if (isManuallyUnlocked) return false;

    // 2. Finalized or In Progress matches are NOT locked (they are active or done)
    if (matchStatus === 'finalized' || matchStatus === 'in_progress' || isStarted) return false;

    // 3. Check Date/Time Lock
    if (!scheduledDate) return false; // No date = unlocked? Or locked? Assuming unlocked if not scheduled.

    // Parse the scheduled_date string (YYYY-MM-DD)
    const datePart = scheduledDate.split('T')[0];

    // Current Time in Target Timezone (using Intl)
    // We need to simulate the "Server Side" check on the Client
    const now = new Date();

    try {
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
            return true; // Future
        }

        if (nowYMD === matchYMD) {
            if (nowHour < 8) {
                return true; // Too early
            }
            return false; // Open
        }

        if (nowYMD > matchYMD) {
            // Check mostly for "expires 8am next day"
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
                    return false; // Still open (late night)
                }
                return true; // Expired
            }

            return true; // Expired
        }

        return true; // Falback
    } catch (e) {
        console.error("Error checking match lock:", e);
        return true; // Fail safe
    }
};
