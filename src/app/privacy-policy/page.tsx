
import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-300 font-sans selection:bg-yellow-500/30">

            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-neutral-900/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold tracking-tighter text-white">
                        BREAKPOINT <span className="text-yellow-500">BILLIARDS</span>
                    </Link>
                    <Link href="/" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
                <p className="text-neutral-500 text-lg mb-12">Last Updated: January 3, 2026</p>

                <section className="space-y-8">
                    <div className="prose prose-invert max-w-none">

                        <p className="text-lg leading-relaxed mb-6">
                            Breakpoint Billiards ("we," "our," or "us") respects your privacy and is committed to protecting your personal data.
                            This privacy policy explains how we collect, use, and share information about you when you use our mobile application and website (collectively, the "Service").
                        </p>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">1. Information We Collect</h2>
                        <ul className="list-disc pl-6 space-y-2 text-neutral-300 mb-6">
                            <li><strong>Account Information:</strong> When you sign up, we collect your name, email address, and profile photo (via Clerk authentication).</li>
                            <li><strong>Game Data:</strong> We collect statistics, match results, league participation, and scoring data generated while playing.</li>
                            <li><strong>Device Information:</strong> We may collect information about your mobile device, including model, operating system, and unique device identifiers (for analytics and crash reporting).</li>
                            <li><strong>User Content:</strong> Any photos or other content you voluntarily upload to your profile.</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">2. How We Use Your Information</h2>
                        <p className="mb-4">We use your information to:</p>
                        <ul className="list-disc pl-6 space-y-2 text-neutral-300 mb-6">
                            <li>Provide, operate, and maintain the Breakpoint Billiards Service.</li>
                            <li>Calculated and display your player rating (“Breakpoint Level”) and leaderboard functionality.</li>
                            <li>Manage league memberships and process session fees (if applicable).</li>
                            <li>Send you administrative notifications, such as match schedules or security updates.</li>
                            <li>Improve the app performance and fix bugs.</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">3. Data Sharing and Disclosure</h2>
                        <p className="mb-4">We do not sell your personal data. We may share information only in the following ways:</p>
                        <ul className="list-disc pl-6 space-y-2 text-neutral-300 mb-6">
                            <li><strong>Service Providers:</strong> We use third-party services like Clerk (for authentication) and Supabase (for database hosting) to operate the app. These providers are bound by confidentiality agreements.</li>
                            <li><strong>League Operators:</strong> Your name, stats, and match history are visible to League Operators and other players within the app as part of the core gameplay and leaderboard features.</li>
                            <li><strong>Legal Requirements:</strong> If required by law or to protect our rights.</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">4. Data Retention and Deletion</h2>
                        <p className="mb-6">
                            We retain your personal data for as long as your account is active.
                            <strong>You have the right to request deletion of your account and data at any time.</strong>
                            You can delete your account directly within the Mobile App settings (Profile &rarr; Delete Account), or by contacting us at privacy@breakpointbilliards.com.
                            Upon deletion request, your personal identifiers (name, email, photo) will be permanently removed from our systems within 30 days.
                        </p>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">5. Security</h2>
                        <p className="mb-6">
                            We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                        </p>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">6. Children's Privacy</h2>
                        <p className="mb-6">
                            Our Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we discover that a child under 13 has provided us with personal information, we will delete such information.
                        </p>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">7. Changes to This Policy</h2>
                        <p className="mb-6">
                            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
                        </p>

                        <h2 className="text-2xl font-bold text-white mt-10 mb-4">8. Contact Us</h2>
                        <p className="mb-6">
                            If you have any questions about this Privacy Policy, please contact us at: <br />
                            <a href="mailto:support@breakpointbilliards.com" className="text-yellow-500 hover:text-yellow-400">support@breakpointbilliards.com</a>
                        </p>

                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-neutral-900 border-t border-white/5 py-12">
                <div className="max-w-7xl mx-auto px-6 text-center text-neutral-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Breakpoint Billiards. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
