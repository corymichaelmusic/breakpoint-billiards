import Link from "next/link";
import { Suspense } from "react";
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import styles from "./Navbar.module.css";
import Image from "next/image";

import DashboardLink from "./DashboardLink";

import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";


export default async function Navbar() {
    const { userId } = await auth();
    let role = null;

    if (userId) {
        const supabase = await createClient();
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
        role = profile?.role;
    }



    return (
        <nav style={{
            borderBottom: "1px solid var(--border)",
            padding: "0.75rem 0",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(10px)",
            position: 'sticky',
            top: 0,
            zIndex: 100
        }}>

            <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", rowGap: "0.5rem", maxWidth: "100vw" }}>
                {/* ... existing navbar content ... */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 1 }}>
                    <div className={styles.logoContainer}>
                        <Image
                            src="/logo-triangle.png"
                            alt="BREAKPOINT BILLIARDS"
                            fill
                            style={{ objectFit: 'contain', objectPosition: 'left' }}
                            priority
                        />
                    </div>
                </Link>
                <div className={styles.links}>
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
                            <DashboardLink className={styles.link} role={role || ""} />
                        </Suspense>
                        <UserButton afterSignOutUrl="/" />
                    </SignedIn>
                    <SignedOut>
                        <Link href="/sign-in" className="btn btn-primary">
                            Sign In
                        </Link>
                    </SignedOut>
                </div>
            </div>
        </nav>
    );
}
