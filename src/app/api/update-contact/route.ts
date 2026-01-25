import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { email, phone } = body;

        const client = await clerkClient();

        let updated = false;

        // Handle Email
        if (email) {
            // Check if user already has this email
            const user = await client.users.getUser(userId);
            const existingEmail = user.emailAddresses.find(e => e.emailAddress === email);

            let emailId = existingEmail?.id;

            if (!existingEmail) {
                // Create new email and mark as verified (Bypass verification)
                try {
                    const newEmail = await client.emailAddresses.createEmailAddress({
                        userId,
                        emailAddress: email,
                        verified: true,
                    });
                    emailId = newEmail.id;
                } catch (e: any) {
                    console.error("Error creating email:", e);
                    return NextResponse.json({ error: e.errors?.[0]?.message || "Failed to create email" }, { status: 400 });
                }
            }

            // Set as primary
            if (emailId && user.primaryEmailAddressId !== emailId) {
                await client.users.updateUser(userId, {
                    primaryEmailAddressID: emailId
                });
                updated = true;
            }
        }

        // Handle Phone
        if (phone) {
            // Check if user already has this phone
            // Re-fetch user to get latest state if we updated email? Or just use existing object if we are careful.
            // Better to re-fetch or use the list we had if we assume it didn't change concurrently.
            // But to be safe let's just fetch or use the one we got.
            const user = await client.users.getUser(userId);

            // Normalize phone (Server might need it normalized too, but Clerk usually handles it or complains)
            // Fix: "unsupported country code" error by enforcing E.164
            let normalizedPhone = phone.replace(/[^\d+]/g, ''); // Strip space, dash, parens

            // If it's a standard US 10-digit number (e.g. 5551234567), make it +15551234567
            if (normalizedPhone.match(/^\d{10}$/)) {
                normalizedPhone = `+1${normalizedPhone}`;
            }
            // If it's 11 digits starting with 1 (e.g. 15551234567), make it +15551234567
            else if (normalizedPhone.match(/^1\d{10}$/)) {
                normalizedPhone = `+${normalizedPhone}`;
            }
            // If it doesn't start with +, add it (attempt to fix)
            else if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = `+${normalizedPhone}`;
            }

            const existingPhone = user.phoneNumbers.find(p => p.phoneNumber === normalizedPhone);
            let phoneId = existingPhone?.id;

            if (!existingPhone) {
                try {
                    const newPhone = await client.phoneNumbers.createPhoneNumber({
                        userId,
                        phoneNumber: normalizedPhone,
                        verified: true
                    });
                    phoneId = newPhone.id;
                } catch (e: any) {
                    console.error("Error creating phone:", e);
                    // If it's "taken", we might return error
                    return NextResponse.json({ error: e.errors?.[0]?.message || "Failed to create phone number" }, { status: 400 });
                }
            }

            if (phoneId && user.primaryPhoneNumberId !== phoneId) {
                await client.users.updateUser(userId, {
                    primaryPhoneNumberID: phoneId
                });
                updated = true;
            }
        }

        return NextResponse.json({ success: true, updated });

    } catch (e: any) {
        console.error("Update contact error:", e);
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
    }
}
