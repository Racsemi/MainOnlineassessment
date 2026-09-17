import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 max-w-4xl mx-auto space-y-6 text-xs leading-relaxed">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white">RACSEMI Assess — Terms of Assessment</h1>
        <p className="text-slate-400 mt-1">Effective Date: August 2026</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-white">1. Candidate Obligations</h2>
        <p>
          Candidates agree to complete assessments independently without unauthorized assistance, external collaboration, or artificial manipulation of client timers.
        </p>

        <h2 className="text-base font-bold text-white">2. Confidentiality of Assessment Materials</h2>
        <p>
          All questions, problem statements, and coding tasks are proprietary property of RACSEMI Inc. Reproduction or distribution is strictly prohibited.
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
