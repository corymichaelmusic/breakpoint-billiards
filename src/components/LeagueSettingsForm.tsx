'use client';

import { useState } from 'react';
import { updateLeagueDetails } from '@/app/actions/league-actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LeagueSettingsFormProps {
    league: {
        id: string;
        name: string;
        location: string | null;
        city: string | null;
        state: string | null;
        schedule_day: string | null;
        type: string;
        session_fee?: number;
        start_date?: string;
    };
    isAdmin?: boolean;
}

export default function LeagueSettingsForm({ league, isAdmin = false }: LeagueSettingsFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        setError(null);

        const name = formData.get("name") as string;
        const location = formData.get("location") as string;
        const city = formData.get("city") as string;
        const state = formData.get("state") as string;
        const schedule_day = formData.get("schedule_day") as string;

        // Session specific
        const session_fee = formData.get("session_fee") ? Number(formData.get("session_fee")) : undefined;
        const start_date = formData.get("start_date") as string | undefined;

        try {
            console.log("Submitting form for league:", league.id);
            const res = await updateLeagueDetails(league.id, { name, location, city, state, schedule_day, session_fee, start_date });
            console.log("Result:", res);

            if (res?.error) {
                setError(res.error);
                alert(`Error: ${res.error}`);
            } else {
                alert("Changes saved successfully!");
                router.refresh(); // Refresh the current route
                router.push(`/dashboard/operator/leagues/${league.id}`);
            }
        } catch (err) {
            console.error("Submission error:", err);
            setError("An unexpected error occurred.");
            alert("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isAdmin) return;

        if (!confirm("Are you sure you want to delete this? This action cannot be undone.")) {
            return;
        }

        setLoading(true);
        try {
            const { deleteLeague } = await import('@/app/actions/league-actions');
            const res = await deleteLeague(league.id);

            if (res?.error) {
                alert(`Error: ${res.error}`);
            } else {
                alert("Deleted successfully.");
                router.push("/dashboard/operator");
                router.refresh();
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form action={handleSubmit}>
            {error && (
                <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.1)", color: "var(--error)", marginBottom: "1.5rem", borderRadius: "var(--radius)", border: "1px solid var(--error)" }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">League Name</label>
                <input
                    type="text"
                    name="name"
                    defaultValue={league.name}
                    required
                    className="input"
                />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">Location Name (Venue)</label>
                <input
                    type="text"
                    name="location"
                    defaultValue={league.location || ""}
                    placeholder="e.g. Metro Pool Hall"
                    className="input"
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                <div>
                    <label className="label">City</label>
                    <input
                        type="text"
                        name="city"
                        defaultValue={league.city || ""}
                        placeholder="e.g. Chicago"
                        className="input"
                    />
                </div>
                <div>
                    <label className="label">State</label>
                    <select
                        name="state"
                        defaultValue={league.state || ""}
                        className="input"
                    >
                        <option value="">Select State...</option>
                        <option value="AL">Alabama</option>
                        <option value="AK">Alaska</option>
                        <option value="AZ">Arizona</option>
                        <option value="AR">Arkansas</option>
                        <option value="CA">California</option>
                        <option value="CO">Colorado</option>
                        <option value="CT">Connecticut</option>
                        <option value="DE">Delaware</option>
                        <option value="FL">Florida</option>
                        <option value="GA">Georgia</option>
                        <option value="HI">Hawaii</option>
                        <option value="ID">Idaho</option>
                        <option value="IL">Illinois</option>
                        <option value="IN">Indiana</option>
                        <option value="IA">Iowa</option>
                        <option value="KS">Kansas</option>
                        <option value="KY">Kentucky</option>
                        <option value="LA">Louisiana</option>
                        <option value="ME">Maine</option>
                        <option value="MD">Maryland</option>
                        <option value="MA">Massachusetts</option>
                        <option value="MI">Michigan</option>
                        <option value="MN">Minnesota</option>
                        <option value="MS">Mississippi</option>
                        <option value="MO">Missouri</option>
                        <option value="MT">Montana</option>
                        <option value="NE">Nebraska</option>
                        <option value="NV">Nevada</option>
                        <option value="NH">New Hampshire</option>
                        <option value="NJ">New Jersey</option>
                        <option value="NM">New Mexico</option>
                        <option value="NY">New York</option>
                        <option value="NC">North Carolina</option>
                        <option value="ND">North Dakota</option>
                        <option value="OH">Ohio</option>
                        <option value="OK">Oklahoma</option>
                        <option value="OR">Oregon</option>
                        <option value="PA">Pennsylvania</option>
                        <option value="RI">Rhode Island</option>
                        <option value="SC">South Carolina</option>
                        <option value="SD">South Dakota</option>
                        <option value="TN">Tennessee</option>
                        <option value="TX">Texas</option>
                        <option value="UT">Utah</option>
                        <option value="VT">Vermont</option>
                        <option value="VA">Virginia</option>
                        <option value="WA">Washington</option>
                        <option value="WV">West Virginia</option>
                        <option value="WI">Wisconsin</option>
                        <option value="WY">Wyoming</option>
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: "2rem" }}>
                <label className="label">Schedule Day</label>
                <select
                    name="schedule_day"
                    defaultValue={league.schedule_day || ""}
                    className="input"
                >
                    <option value="">Select a day...</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                </select>
            </div>

            {/* Session Specific Fields */}
            {league.type === 'session' && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", padding: "1.5rem", background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ gridColumn: "span 2", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--primary)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Session Configuration
                    </div>
                    <div>
                        <label className="label">Session Fee ($)</label>
                        <input
                            type="number"
                            name="session_fee"
                            defaultValue={league.session_fee || 0}
                            readOnly
                            className="input"
                            style={{ opacity: 0.7, cursor: "not-allowed" }}
                        />
                        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                            Fixed by Admin
                        </p>
                    </div>
                    <div>
                        <label className="label">Start Date</label>
                        <input
                            type="date"
                            name="start_date"
                            defaultValue={league.start_date || ""}
                            className="input"
                        />
                    </div>
                </div>
            )}

            <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid var(--border)" }}>
                <div>
                    {isAdmin ? (
                        <button type="button" onClick={handleDelete} className="btn btn-danger">
                            Delete {league.type === 'session' ? 'Session' : 'League'}
                        </button>
                    ) : (
                        <div style={{ fontSize: "0.8rem", color: "#666", fontStyle: "italic" }}>
                            Deletion restricted to Admins
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                    <Link href={`/dashboard/operator/leagues/${league.id}`} className="btn btn-secondary">
                        Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </form>
    );
}
