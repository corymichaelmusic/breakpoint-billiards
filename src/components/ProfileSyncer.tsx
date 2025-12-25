'use client';

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { syncUserProfile } from "@/app/actions/user-actions";

export default function ProfileSyncer() {
    const { user, isLoaded } = useUser();

    // Use router to redirect if deactivated
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (pathname === "/deactivated") return;

        const sync = async () => {
            if (isLoaded && user) {
                // Sync user profile to Supabase
                const result = await syncUserProfile({
                    id: user.id,
                    email: user.primaryEmailAddress?.emailAddress,
                    fullName: user.fullName,
                    imageUrl: user.imageUrl,
                    phone: user.primaryPhoneNumber?.phoneNumber
                });

                if (result && result.is_active === false) {
                    router.push("/deactivated");
                }
            }
        };
        sync();
    }, [isLoaded, user, router]);

    return null; // Invisible component
}
