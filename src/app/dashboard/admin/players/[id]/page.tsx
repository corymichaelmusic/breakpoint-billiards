import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getPlayerLifetimeStats, getPlayerActiveLeagues } from "@/app/actions/stats-actions";
import { getBreakpointLevel } from "@/utils/stats-calculator";
import RoleSelector from "@/components/RoleSelector";
import SubscriptionManager from "@/components/SubscriptionManager";
import Image from "next/image";

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const supabase = await createClient();

    // Fetch Profile
    const { data: player } = await supabase.from("profiles").select("*").eq("id", id).single();

    // Fetch Data Parallel
    const [stats, leagues] = await Promise.all([
        getPlayerLifetimeStats(id),
        getPlayerActiveLeagues(id)
    ]);

    // Fetch Confidence & Rating from most recent/active league membership
    // This is more accurate than the profile table which might be stale.
    const { data: lpData } = await supabase.from("league_players")
        .select("breakpoint_confidence, breakpoint_rating")
        .eq("player_id", id)
        .order("joined_at", { ascending: false })
        .limit(1)
        .single();

    // Use calculated Confidence (Total Racks Played) to match Native App logic
    // Fallback to DB if stats is 0 (though stats should be accurate now that we include scheduled matches)
    const confidence = stats?.totalRacksPlayed || lpData?.breakpoint_confidence || 0;

    // Use League Rating first, then Profile Rating, then 500 default.
    // Explicitly decouple from Fargo Rating as per user request.akpoint Level from Profile Rating (or Fargo if missing)
    // Default to 500 if both missing.
    // Removed Fargo Fallback.
    const rawRating = lpData?.breakpoint_rating ?? player?.breakpoint_rating ?? 500;
    const breakpointLevel = getBreakpointLevel(rawRating);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${player?.player_number || id}`;

    return (
        <main>
            <Navbar />
            <div className="container" style={{ marginTop: "2rem", paddingBottom: "4rem" }}>

                {/* Header Section: Identity & QR */}
                <div className="card" style={{ padding: "2rem", marginBottom: "2rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2rem" }}>
                    <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
                        {/* Avatar */}
                        <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#333", overflow: "hidden", border: "2px solid var(--primary)", position: "relative" }}>
                            {player?.avatar_url ? (
                                <Image src={player.avatar_url} alt="Avatar" fill style={{ objectFit: "cover" }} />
                            ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>No Img</div>
                            )}
                        </div>

                        {/* Name & Basic Info */}
                        <div>
                            <h1 style={{ marginBottom: "0.25rem", color: "white" }}>{player?.full_name}</h1>
                            {player?.nickname && (
                                <div style={{ fontSize: "1.2rem", color: "var(--primary)", marginBottom: "0.5rem", fontStyle: "italic" }}>
                                    "{player.nickname}"
                                </div>
                            )}
                            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                                <div className="badge">Rating: {rawRating || 500}</div>
                                <div className="badge secondary">Level: {breakpointLevel}</div>
                                <div className="badge secondary" style={{ background: "#222", border: "1px solid #444" }}>Conf: {confidence}</div>
                            </div>
                        </div>
                    </div>

                    {/* QR Code & ID */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ background: "white", padding: "10px", borderRadius: "8px" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrCodeUrl} alt="Player QR" width={120} height={120} />
                        </div>
                        <div style={{ marginTop: "0.5rem", fontFamily: "monospace", fontSize: "1.2rem", color: "var(--primary)", fontWeight: "bold" }}>
                            #{player?.player_number || "PENDING"}
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-2" style={{ marginBottom: "2rem" }}>
                    <div className="card" style={{ padding: "1.5rem" }}>
                        <h3 style={{ color: "white" }}>Contact Information</h3>
                        <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
                            <div>
                                <span style={{ color: "#aaa", width: "80px", display: "inline-block" }}>Email:</span>
                                <span style={{ color: "white" }}>{player?.email || "N/A"}</span>
                            </div>
                            <div>
                                <span style={{ color: "#aaa", width: "80px", display: "inline-block" }}>Phone:</span>
                                <span style={{ color: "white" }}>{player?.phone || "N/A"}</span>
                            </div>
                            <div>
                                <span style={{ color: "#aaa", width: "80px", display: "inline-block" }}>Created:</span>
                                <span style={{ color: "white" }}>{new Date(player?.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: "1.5rem" }}>
                        <h3 style={{ color: "white" }}>Leagues & Sessions</h3>
                        {leagues && leagues.length > 0 ? (
                            <ul style={{ paddingLeft: "1.2rem", marginTop: "1rem", color: "white" }}>
                                {leagues.map((l: any) => (
                                    <li key={l.id} style={{ marginBottom: "0.5rem" }}>
                                        {l.name} <span style={{ fontSize: "0.8rem", color: "#aaa" }}>({l.type})</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ color: "#aaa", marginTop: "1rem" }}>No active league memberships.</p>
                        )}
                    </div>
                </div>

                {/* Statistics Section */}
                <div className="card" style={{ padding: "2rem", marginBottom: "2rem" }}>
                    <h2 style={{ marginBottom: "1.5rem", color: "white" }}>Lifetime Statistics</h2>

                    {/* Top Level Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem", marginBottom: "2rem", textAlign: "center" }}>
                        <div className="stat-box">
                            <div className="label" style={{ color: "#aaa" }}>Win Rate</div>
                            <div className="value">{typeof stats?.winRate === 'number' ? stats.winRate : 0}%</div>
                        </div>
                        <div className="stat-box">
                            <div className="label" style={{ color: "#aaa" }}>Sets</div>
                            <div className="value">{stats?.matchesPlayed || 0}</div>
                        </div>
                        <div className="stat-box">
                            <div className="label" style={{ color: "#aaa" }}>Won</div>
                            <div className="value">{stats?.matchesWon || 0}</div>
                        </div>
                        <div className="stat-box">
                            <div className="label" style={{ color: "#aaa" }}>Lost</div>
                            <div className="value">{stats?.matchesLost || 0}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                        {/* 8-Ball & 9-Ball Stats - Stacked Vertically */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3rem", marginBottom: "2rem" }}>
                            {/* 8-Ball Stats */}
                            <div>
                                <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid #333", paddingBottom: "0.5rem", color: "#D4AF37", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>8-Ball</span>
                                    <span style={{ color: "#fff", fontSize: "0.9rem", fontWeight: "normal" }}>
                                        Sets: {stats?.matchesWon_8ball || 0}-{stats?.matchesLost_8ball || 0} ({stats?.winRate_8ball || 0}%)
                                    </span>
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", color: "white" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Rack Breakdown</span>
                                        <span>{stats?.racksPlayed_8ball || 0} Racks, {(stats?.racksWon_8ball || 0)}-{(stats?.racksPlayed_8ball || 0) - (stats?.racksWon_8ball || 0)} <span style={{ color: '#666', fontSize: '0.9em' }}>({stats?.racksPlayed_8ball ? Math.round((stats.racksWon_8ball / stats.racksPlayed_8ball) * 100) : 0}%)</span></span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Break & Run</span>
                                        <span>{stats?.breakAndRuns_8ball || 0}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Rack & Run</span>
                                        <span>{stats?.rackAndRuns_8ball || 0}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Win-Zip</span>
                                        <span>{stats?.racklessSets_8ball || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 9-Ball Stats */}
                            <div>
                                <h3 style={{ marginBottom: "1.5rem", borderBottom: "1px solid #333", paddingBottom: "0.5rem", color: "#D4AF37", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <span>9-Ball</span>
                                    <span style={{ color: "#fff", fontSize: "0.9rem", fontWeight: "normal" }}>
                                        Sets: {stats?.matchesWon_9ball || 0}-{stats?.matchesLost_9ball || 0} ({stats?.winRate_9ball || 0}%)
                                    </span>
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", color: "white" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Rack Breakdown</span>
                                        <span>{stats?.racksPlayed_9ball || 0} Racks, {(stats?.racksWon_9ball || 0)}-{(stats?.racksPlayed_9ball || 0) - (stats?.racksWon_9ball || 0)} <span style={{ color: '#666', fontSize: '0.9em' }}>({stats?.racksPlayed_9ball ? Math.round((stats.racksWon_9ball / stats.racksPlayed_9ball) * 100) : 0}%)</span></span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Break & Run</span>
                                        <span>{stats?.breakAndRuns_9ball || 0}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>9 on Snap</span>
                                        <span>{stats?.nineOnSnaps_9ball || 0}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #222" }}>
                                        <span style={{ color: "#888" }}>Win-Zip</span>
                                        <span>{stats?.racklessSets_9ball || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Top Statistics Section */}
                {/* ... (existing stats) ... */}

                {/* Admin Controls */}
                <div className="card" style={{ padding: "2rem", border: "1px solid #333" }}>
                    <h2 style={{ marginBottom: "1rem", color: "white" }}>Admin Controls</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <div style={{ fontWeight: "bold", color: "white" }}>Role:</div>
                            <RoleSelector userId={id} currentRole={player?.role || 'player'} />
                        </div>
                        <SubscriptionManager userId={id} currentStatus={player?.subscription_status} expiresAt={player?.subscription_expires_at} />
                        {/* Fargo Editor Removed as per request */}
                    </div>
                </div>
            </div>

            <style>{`
                .badge {
                    background: var(--primary);
                    color: black;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: bold;
                }
                .badge.secondary {
                    background: var(--surface);
                    color: var(--foreground);
                    border: 1px solid var(--border);
                }
                .stat-box {
                    background: var(--surface);
                    padding: 1rem;
                    border-radius: 8px;
                }
                .stat-box .value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: white;
                }
                .stat-box .label {
                    font-size: 0.8rem;
                    color: #888;
                }
            `}</style>
        </main>
    );
}
