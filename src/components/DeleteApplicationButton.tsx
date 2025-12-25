'use client';

import { deleteApplication } from "@/app/actions/admin-actions";
import { useState } from "react";

export default function DeleteApplicationButton({ applicationId }: { applicationId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
            setIsDeleting(true);
            await deleteApplication(applicationId);
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn"
            style={{
                background: "transparent",
                border: '1px solid var(--error)',
                color: "var(--error)",
                width: '100%',
                marginTop: '0.5rem',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1
            }}
        >
            {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
    );
}
