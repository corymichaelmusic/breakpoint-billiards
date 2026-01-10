"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
    label?: string;
    className?: string;
}

export default function BackButton({ label = "Back", className = "" }: BackButtonProps) {
    const router = useRouter();

    return (
        <button
            onClick={() => router.back()}
            className={`text-sm text-gray-500 hover:text-white transition-colors mb-4 block ${className}`}
        >
            &larr; {label}
        </button>
    );
}
