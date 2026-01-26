'use client';

import { useState } from 'react';
import { updateSystemSetting } from '@/app/actions/admin-actions';

interface LandingPageSettingsFormProps {
    titleLine1: string;
    titleLine2: string;
    location: string;
    boxText: string;
}

export default function LandingPageSettingsForm({ titleLine1, titleLine2, location, boxText }: LandingPageSettingsFormProps) {
    const [loading, setLoading] = useState<string | null>(null);

    const handleUpdate = async (formData: FormData) => {
        const key = formData.get("key") as string;
        setLoading(key);
        const value = formData.get("value") as string;

        const res = await updateSystemSetting(key, value);

        if (res?.error) {
            alert(res.error);
        } else {
            // alert("Setting updated successfully.");
        }
        setLoading(null);
    };

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <div className="card">
                <h3 className="text-lg font-bold text-primary mb-2">Announcement Title Line 1</h3>
                <p className="text-sm text-gray-400 mb-4">
                    The main headline inside the box (e.g. MONEY MONDAYS...)
                </p>
                <form action={handleUpdate} className="flex gap-4">
                    <input type="hidden" name="key" value="landing_page_box_title_line_1" />
                    <input
                        name="value"
                        defaultValue={titleLine1}
                        required
                        className="input flex-1"
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading === 'landing_page_box_title_line_1'}>
                        {loading === 'landing_page_box_title_line_1' ? "..." : "Save"}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 className="text-lg font-bold text-primary mb-2">Announcement Location</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Location text (e.g. Fort Worth, TX)
                </p>
                <form action={handleUpdate} className="flex gap-4">
                    <input type="hidden" name="key" value="landing_page_box_location" />
                    <input
                        name="value"
                        defaultValue={location}
                        required
                        className="input flex-1"
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading === 'landing_page_box_location'}>
                        {loading === 'landing_page_box_location' ? "..." : "Save"}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 className="text-lg font-bold text-primary mb-2">Announcement Title Line 2</h3>
                <p className="text-sm text-gray-400 mb-4">
                    The highlighted sub-headline (e.g. STARTS FEBRUARY 16)
                </p>
                <form action={handleUpdate} className="flex gap-4">
                    <input type="hidden" name="key" value="landing_page_box_title_line_2" />
                    <input
                        name="value"
                        defaultValue={titleLine2}
                        required
                        className="input flex-1"
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading === 'landing_page_box_title_line_2'}>
                        {loading === 'landing_page_box_title_line_2' ? "..." : "Save"}
                    </button>
                </form>
            </div>

            <div className="card md:col-span-2 lg:col-span-1">
                <h3 className="text-lg font-bold text-primary mb-2">Announcement Text</h3>
                <p className="text-sm text-gray-400 mb-4">
                    The descriptive text below the title.
                </p>
                <form action={handleUpdate} className="flex gap-4 items-start">
                    <input type="hidden" name="key" value="landing_page_box_text" />
                    <textarea
                        name="value"
                        defaultValue={boxText}
                        required
                        className="input flex-1 min-h-[80px]"
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading === 'landing_page_box_text'}>
                        {loading === 'landing_page_box_text' ? "..." : "Save"}
                    </button>
                </form>
            </div>
        </div>
    );
}
