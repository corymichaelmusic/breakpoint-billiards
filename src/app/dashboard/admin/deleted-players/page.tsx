import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { verifyAdmin } from "@/utils/auth-helpers";
import BackButton from "@/components/BackButton";

export const dynamic = 'force-dynamic';

import HardDeleteButton from "@/components/HardDeleteButton";

export default async function DeletedProfilesPage() {
    await verifyAdmin();

    const adminSupabase = createAdminClient();

    // Fetch deleted players (where is_active is false OR deleted_at is not null)
    const { data: deletedProfiles } = await adminSupabase
        .from("profiles")
        .select("id, full_name, email, role, deleted_at, is_active")
        .or("is_active.eq.false,deleted_at.not.is.null")
        .order("deleted_at", { ascending: false });

    return (
        <main className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <div className="container py-12 pb-24">
                <div className="mb-8">
                    <BackButton label="Back to Admin" className="!text-[#D4AF37] hover:!text-white mb-4" />
                    <h1 className="text-3xl font-bold font-sans text-white">Deleted & Inactive Accounts</h1>
                    <p className="text-sm text-gray-500 mt-1">These accounts are hidden from all active league views. Hard deleting will remove ALL match history.</p>
                </div>

                <div className="card-glass">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-[3px]">
                            <thead>
                                <tr className="border-b border-transparent text-gray-500 text-sm uppercase">
                                    <th className="p-3 font-semibold">Name</th>
                                    <th className="p-3 font-semibold">Email</th>
                                    <th className="p-3 font-semibold">Role</th>
                                    <th className="p-3 font-semibold">Deleted At</th>
                                    <th className="p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deletedProfiles?.map((player) => (
                                    <tr key={player.id} className="bg-white/5 hover:bg-white/10 transition-colors">
                                        <td className="p-3 font-medium text-white">{player.full_name || "*"}</td>
                                        <td className="p-3 text-gray-400">{player.email || "*"}</td>
                                        <td className="p-3 text-gray-400 uppercase text-xs">{player.role}</td>
                                        <td className="p-3 text-gray-500 text-xs">
                                            {player.deleted_at ? new Date(player.deleted_at).toLocaleDateString() : 'N/A (Deactivated)'}
                                        </td>
                                        <td className="p-3 flex items-center">
                                            <Link href={`/dashboard/admin/players/${player.id}`} className="btn bg-[#D4AF37] text-black hover:bg-[#b0902c] border-transparent font-bold text-xs px-4 py-2 uppercase tracking-wide">
                                                View Stats
                                            </Link>
                                            <HardDeleteButton playerId={player.id} playerName={player.full_name || 'Unknown'} />
                                        </td>
                                    </tr>
                                ))}
                                {deletedProfiles?.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                            No deleted or inactive accounts found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
