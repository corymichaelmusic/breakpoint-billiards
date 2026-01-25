'use client';

import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import DashboardLink from "./DashboardLink";

export default function NavbarUserActions({ role }: { role: string | null }) {
    return (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <SignedIn>
                {role && (
                    <span style={{
                        marginRight: "1rem",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "1rem",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)"
                    }}>
                        {role.toUpperCase()}
                    </span>
                )}

                <Suspense fallback={null}>
                    <DashboardLink role={role || ""} className="mr-4 text-sm font-bold !text-[#D4AF37] hover:!text-white hover:underline transition-all" />
                </Suspense>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
                <Link href="/sign-in" className="btn btn-primary">
                    Sign In
                </Link>
            </SignedOut>
        </div>
    );
}
