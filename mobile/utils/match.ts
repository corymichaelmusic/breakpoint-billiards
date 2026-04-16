type ScheduledLockOptions = {
    relockNextMorning?: boolean;
};

const getScheduledDateLockState = (
    scheduledDate: string | null,
    timezone: string = 'America/Chicago',
    options: ScheduledLockOptions = {}
) => {
    if (!scheduledDate) return { locked: false };

    const { relockNextMorning = true } = options;
    const datePart = scheduledDate.split('T')[0];
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

        const [mYear, mMonth, mDay] = datePart.split('-').map(Number);
        const nowYMD = nowYear * 10000 + nowMonth * 100 + nowDay;
        const matchYMD = mYear * 10000 + mMonth * 100 + mDay;

        if (nowYMD < matchYMD) {
            return {
                locked: true,
                reason: `Unlocks on ${datePart} at 8:00 AM (${timezone}).`
            };
        }

        if (nowYMD === matchYMD) {
            if (nowHour < 8) {
                return {
                    locked: true,
                    reason: `Unlocks today at 8:00 AM (${timezone}).`
                };
            }

            return { locked: false };
        }

        if (!relockNextMorning) {
            return { locked: false };
        }

        const matchDateObj = new Date(mYear, mMonth - 1, mDay);
        const nextDateObj = new Date(matchDateObj);
        nextDateObj.setDate(nextDateObj.getDate() + 1);

        const nYear = nextDateObj.getFullYear();
        const nMonth = nextDateObj.getMonth() + 1;
        const nDay = nextDateObj.getDate();
        const nextYMD = nYear * 10000 + nMonth * 100 + nDay;

        if (nowYMD === nextYMD && nowHour < 8) {
            return { locked: false };
        }

        return {
            locked: true,
            reason: nowYMD === nextYMD
                ? `Match window ended today at 8:00 AM (${timezone}).`
                : 'Match window expired.'
        };
    } catch (e) {
        console.error("Error checking match lock:", e);
        return {
            locked: true,
            reason: 'Unable to determine lock status.'
        };
    }
};

export const isMatchLocked = (
    scheduledDate: string | null,
    timezone: string = 'America/Chicago',
    isManuallyUnlocked: boolean = false,
    matchStatus: string = 'scheduled',
    isStarted: boolean = false
) => {
    if (isManuallyUnlocked) return false;
    if (matchStatus === 'finalized' || matchStatus === 'in_progress' || isStarted) return false;
    return getScheduledDateLockState(scheduledDate, timezone, { relockNextMorning: true }).locked;
};

export const getTeamMatchLockState = (
    scheduledDate: string | null,
    timezone: string = 'America/Chicago',
    isManuallyUnlocked: boolean = false,
    matchStatus: string = 'scheduled'
) => {
    if (isManuallyUnlocked) {
        return { locked: false, reason: 'Manually unlocked by the operator.' };
    }

    if (matchStatus === 'in_progress' || matchStatus === 'completed') {
        return { locked: false };
    }

    return getScheduledDateLockState(scheduledDate, timezone, { relockNextMorning: false });
};

export const isTeamMatchLocked = (
    scheduledDate: string | null,
    timezone: string = 'America/Chicago',
    isManuallyUnlocked: boolean = false,
    matchStatus: string = 'scheduled'
) => getTeamMatchLockState(scheduledDate, timezone, isManuallyUnlocked, matchStatus).locked;
