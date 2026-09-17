import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 max-w-4xl mx-auto space-y-6 text-xs leading-relaxed">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white">RACSEMI Assess — Privacy & Monitoring Policy</h1>
        <p className="text-slate-400 mt-1">Effective Date: August 2026</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-white">1. Information We Collect</h2>
        <p>
          RACSEMI Assess collects candidate verification credentials, submitted answers, source code drafts, and assessment integrity telemetry (e.g. window blur events, tab visibility changes, and fullscreen state) solely for recruitment assessment evaluation.
        </p>

        <h2 className="text-base font-bold text-white">2. Ethical Anti-Cheat Monitoring</h2>
        <p>
          All proctoring and telemetry data is processed ethically. No single integrity signal automatically rejects a candidate; all data is aggregated into risk summaries for human recruiter review.
        </p>

        <h2 className="text-base font-bold text-white">3. Data Retention & Security</h2>
        <p>
          Assessment telemetry is retained according to organization policy (default 30 days) and purged automatically thereafter. All data is encrypted in transit and at rest.
        </p>
      </div>

      <div className="pt-6 border-t border-slate-800">
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold">
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
