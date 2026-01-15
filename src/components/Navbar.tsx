import Link from "next/link";
import styles from "./Navbar.module.css";
import Image from "next/image";

import NavbarUserActions from "./NavbarUserActions";

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

            <div className="container" style={{ display: "flex", alignItems: "center", position: "relative", height: "40px", maxWidth: "100vw" }}>

                {/* Left Side Icon */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', zIndex: 10 }}>
                    <div className={styles.logoContainer}>
                        <Image
                            src="/logo-nav-final.png"
                            alt="BP Logo"
                            fill
                            style={{ objectFit: 'contain', objectPosition: 'left' }}
                            priority
                        />
                    </div>
                </Link>

                {/* Centered Text Logo */}
                <Link href="/" style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: 'flex',
                    alignItems: 'center',
                    height: "100%",
                    zIndex: 1
                }}>
                    <div style={{ position: 'relative', height: '32px', width: '200px' }}>
                        <Image
                            src="/logo-text-gold.png"
                            alt="BREAKPOINT BILLIARDS"
                            fill
                            style={{ objectFit: 'contain', objectPosition: 'center' }}
                            priority
                        />
                    </div>
                </Link>

                {/* Right Side Links (pushed right) */}
                <NavbarUserActions role={role} />
            </div>
        </nav>
    );
}
