
'use client';

import { useState } from "react";
import { deletePreregistration } from "@/app/actions/prereg-actions";

type Preregistration = {
    id: string;
    full_name: string;
    email: string;
    created_at: string;
};

export default function PreregistrationManager({ preregs }: { preregs: Preregistration[] }) {
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleExport = () => {
        const headers = ["Full Name", "Email", "Date Joined"];
        const rows = preregs.map(p => [
            p.full_name,
            p.email,
            new Date(p.created_at).toLocaleDateString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `preregistrations_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this entry?")) return;
        setIsDeleting(id);
        await deletePreregistration(id);
        setIsDeleting(null);
    };

    if (!preregs || preregs.length === 0) return null;

    return (
        <div className="card-glass mb-16 border-white/10">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Pre-registrations <span className="text-xs bg-[#D4AF37] text-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]">{preregs.length}</span>
                </h2>
                <button
                    onClick={handleExport}
                    className="text-xs bg-[#D4AF37] text-black hover:bg-[#b0902c] border border-transparent font-bold uppercase tracking-widest px-4 py-2 rounded shadow-lg transition-all"
                    style={{ backgroundColor: '#D4AF37', color: 'black' }}
                >
                    Export CSV
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-white/5">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {preregs.map((p) => (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{p.full_name}</td>
                                <td className="px-6 py-4 text-gray-300">{p.email}</td>
                                <td className="px-6 py-4 text-gray-500 text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        disabled={isDeleting === p.id}
                                        className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded uppercase font-bold tracking-widest transition-all"
                                        style={{ color: '#ef4444', borderColor: '#ef4444' }}
                                    >
                                        {isDeleting === p.id ? '...' : 'DELETE'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
