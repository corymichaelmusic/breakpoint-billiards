'use client';

import { submitOperatorApplication } from '@/app/actions/operator-actions';
import { useState } from 'react';

export default function OperatorApplicationForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        const result = await submitOperatorApplication(formData);
        setIsSubmitting(false);

        if (result?.error) {
            alert(result.error);
        }
    };

    return (
        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
                    <label htmlFor="firstName">First Name *</label>
                    <input type="text" name="firstName" id="firstName" required className="input" placeholder="Jane" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
                    <label htmlFor="lastName">Last Name *</label>
                    <input type="text" name="lastName" id="lastName" required className="input" placeholder="Doe" />
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
                    <label htmlFor="email">Email Address *</label>
                    <input type="email" name="email" id="email" required className="input" placeholder="jane@example.com" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 200px' }}>
                    <label htmlFor="phone">Phone Number *</label>
                    <input type="tel" name="phone" id="phone" required className="input" placeholder="(555) 123-4567" />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="location">Your Current Location *</label>
                <input type="text" name="location" id="location" required className="input" placeholder="City, State" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="desiredLeagueLocation">Desired League Location *</label>
                <input type="text" name="desiredLeagueLocation" id="desiredLeagueLocation" required className="input" placeholder="Where do you want to run the league?" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="notes">Notes / Experience</label>
                <textarea name="notes" id="notes" rows={5} className="input" placeholder="Tell us about your pool experience..." style={{ padding: '0.75rem' }}></textarea>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
                {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
            </button>

            <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginTop: '1rem' }}>
                By submitting this form, you agree to be contacted by Breakpoint Billiards regarding this opportunity.
            </p>
        </form>
    );
}
