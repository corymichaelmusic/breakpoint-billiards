import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { redirect } from "next/navigation";
import UnlockRequestAction from "@/components/UnlockRequestAction";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function OperatorDashboard() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = createAdminClient();

    // Check Operator Status
    const { data: profile } = await supabase
        .from("profiles")
        .select("operator_status")
        .eq("id", userId)
        .single();

    if (profile?.operator_status === 'pending') {
        return (
            <main className="min-h-screen flex flex-col">
                <Navbar />
                <div className="container max-w-xl mt-20 text-center">
                    <div className="card-glass p-12">
                        <h1 className="text-3xl text-white mb-4 font-serif">Application Pending</h1>
                        <p className="text-lg text-gray-400">
                            Your application to become a League Operator is under review.
                        </p>
                        <p className="text-sm text-gray-300 mt-4">
                            An administrator will review your request shortly.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (profile?.operator_status === 'rejected') {
        return (
            <main className="min-h-screen flex flex-col">
                <Navbar />
                <div className="container max-w-xl mt-20 text-center">
                    <div className="card-glass p-12 border-error/50">
                        <h1 className="text-3xl text-error mb-4 font-serif">Application Rejected</h1>
                        <p className="text-lg text-gray-400">
                            Your application to become a League Operator was not approved.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // Fetch Operator's League Organizations (All of them)
    // Fetch Operator's League Organizations (via junction table)
    const { data: assignments } = await supabase
        .from("league_operators")
        .select("league_id")
        .eq("user_id", userId);

    const assignedLeagueIds = assignments?.map(a => a.league_id) || [];

    const { data: leagueOrgs, error: orgError } = await supabase
        .from("leagues")
        .select("*")
        .in("id", assignedLeagueIds)
        .eq("type", "league")
        .order("created_at", { ascending: true });

    // Fetch All Sessions for these leagues to check for pending requests
    const leagueIds = leagueOrgs?.map(l => l.id) || [];

    // Fetch pending requests for these leagues AND their sessions
    const { data: allSessions } = await supabase
        .from("leagues")
        .select("id, parent_league_id")
        .in("parent_league_id", leagueIds);

    const sessionIds = allSessions?.map(s => s.id) || [];
    const allRelevantIds = [...leagueIds, ...sessionIds];

    const { data: pendingRequests } = await supabase
        .from("league_players")
        .select("league_id")
        .in("league_id", allRelevantIds)
        .eq("status", "pending");

    // Map pending counts to Parent League ID
    const pendingCounts: Record<string, number> = {};

    pendingRequests?.forEach(req => {
        // Check if it's a direct league request
        if (leagueIds.includes(req.league_id)) {
            pendingCounts[req.league_id] = (pendingCounts[req.league_id] || 0) + 1;
        } else {
            // It's a session request, find the parent
            const session = allSessions?.find(s => s.id === req.league_id);
            if (session && session.parent_league_id) {
                pendingCounts[session.parent_league_id] = (pendingCounts[session.parent_league_id] || 0) + 1;
            }
        }
    });

    const { data: unlockRequests } = await supabase
        .from("reschedule_requests")
        .select(`
            *,
            match:matches!inner(
                league_id,
                week_number,
                player1:player1_id(full_name),
                player2:player2_id(full_name),
                league:league_id(
                    name,
                    parent_league:parent_league_id(name)
                )
            ),
            requester:requester_id(full_name)
        `)
        .in("match.league_id", allRelevantIds)
        .eq("status", "pending_operator");

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="container py-12 pb-24">

                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-3xl font-bold font-sans text-white">Operator Dashboard</h1>
                        <p className="text-sm text-gray-300 mt-1">Manage your leagues and player requests</p>
                    </div>
                </div>

                {/* Unlock Requests Section */}
                {/* @ts-ignore */}
                {unlockRequests && unlockRequests.length > 0 && (
                    <div className="mb-16">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            Unlock Requests
                            <span className="bg-primary text-black text-xs px-2 py-0.5 rounded-full font-bold">
                                {unlockRequests.length}
                            </span>
                        </h2>
                        <div className="grid gap-6">
                            {unlockRequests.map((req) => (
                                <div key={req.id} className="card-glass p-10 border-l-4 border-l-yellow-500 flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex-1">
                                        <div className="text-xs text-primary font-bold uppercase tracking-wider mb-2">
                                            {/* @ts-ignore */}
                                            {req.match?.league?.parent_league?.name || 'Unknown League'}
                                        </div>
                                        <div className="text-lg font-bold text-white mb-2">
                                            {/* @ts-ignore */}
                                            {req.match?.league?.name} • Week {req.match?.week_number}
                                        </div>
                                        <div className="font-semibold text-gray-300 mb-4">
                                            {/* @ts-ignore */}
                                            {req.match?.player1?.full_name} vs {req.match?.player2?.full_name}
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            Requested by: <span className="text-white">{req.requester?.full_name}</span>
                                        </div>
                                        <div className="text-sm text-gray-300 italic mt-2 bg-surface/50 p-4 rounded max-w-md">
                                            "{req.reason}"
                                        </div>
                                    </div>
                                    <div>
                                        <UnlockRequestAction requestId={req.id} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* League Grid */}
                <h2 className="text-xl font-bold text-white mb-8 border-b border-transparent pb-4">Your Leagues</h2>

                {leagueOrgs && leagueOrgs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {leagueOrgs.map(leagueOrg => {
                            const pendingCount = pendingCounts[leagueOrg.id] || 0;

                            return (
                                <Link key={leagueOrg.id} href={`/dashboard/operator/leagues/${leagueOrg.id}`}>
                                    <div className="card-glass hover-effect h-full flex flex-col justify-between p-10 cursor-pointer group">
                                        <div>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-14 h-14 rounded-full bg-surface-hover flex items-center justify-center text-[#D4AF37] font-sans text-2xl border border-transparent group-hover:border-[#D4AF37] transition-colors">
                                                    {leagueOrg.name.charAt(0)}
                                                </div>
                                                {pendingCount > 0 && (
                                                    <span className="bg-error text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                                                        {pendingCount} Pending
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-primary transition-colors">
                                                {leagueOrg.name}
                                            </h3>

                                            <div className="space-y-2 text-sm text-gray-300">
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                    {leagueOrg.location || "No Location"}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                    {leagueOrg.schedule_day ? `${leagueOrg.schedule_day}s` : "No Schedule"}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    {leagueOrg.city}, {leagueOrg.state}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8 flex justify-end">
                                            <span className="text-sm font-semibold text-[#D4AF37] group-hover:underline">
                                                Manage League &rarr;
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}

                    </div>
                ) : (
                    <div className="card-glass p-16 text-center">
                        <div className="w-24 h-24 bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-8 text-4xl border border-transparent">
                            🎱
                        </div>
                        <h3 className="text-3xl font-bold mb-4">No Leagues Assigned</h3>
                        <p className="text-gray-400 mb-6 max-w-lg mx-auto">You haven't been assigned to any leagues yet.</p>
                        <p className="text-sm text-gray-500">Contact an administrator to get access to your organization.</p>
                    </div>
                )}

                {/* Tournament Section */}
                <h2 className="text-xl font-bold text-white mb-8 border-b border-transparent pb-4 mt-16">Tournaments</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <Link href="/dashboard/tournaments">
                        <div className="card-glass hover-effect h-full flex flex-col justify-between p-10 cursor-pointer group bg-gradient-to-br from-surface to-surface-hover/50">
                            <div>
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-sans text-2xl border border-primary/20 mb-6 group-hover:scale-110 transition-transform">
                                    🏆
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                                    Manage Tournaments
                                </h3>
                                <p className="text-sm text-gray-400">
                                    Run single and double elimination events with automated brackets and Fargo handicaps.
                                </p>
                            </div>
                            <div className="mt-8">
                                <span className="text-sm font-semibold text-[#D4AF37] group-hover:underline">
                                    Open Dashboard &rarr;
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </main>
    );
}
