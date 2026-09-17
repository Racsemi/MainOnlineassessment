'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

export default function IntegrityLogsPage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Integrity & Anti-Cheat Telemetry" />

      <main className="p-8 space-y-6 max-w-5xl mx-auto w-full">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Ethical Integrity & Audit Logs</h2>
          <p className="text-xs text-gray-500">
            Real-time event logging, weighted risk calculations, and compliance verification.
          </p>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
            <span className="text-xs font-semibold text-gray-500">Telemetry Engine</span>
            <div className="text-lg font-bold text-green-600 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5" /> Active & Monitoring
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Multi-signal behavioral capture</p>
          </div>

          <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
            <span className="text-xs font-semibold text-gray-500">Retention Window</span>
            <div className="text-lg font-bold text-gray-900 mt-1">30 Days</div>
            <p className="text-[11px] text-gray-500 mt-1">Automatic telemetry purge</p>
          </div>

          <div className="p-5 bg-white border border-gray-200 shadow-sm rounded-2xl">
            <span className="text-xs font-semibold text-gray-500">Risk Assessment Mode</span>
            <div className="text-lg font-bold text-blue-600 mt-1">Weighted Review</div>
            <p className="text-[11px] text-gray-500 mt-1">No automatic candidate rejections</p>
          </div>
        </div>

        {/* Weighted Event Rules Table */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900">Event Weight Configuration</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Event Type</th>
                  <th className="py-2.5 px-4">Risk Weight</th>
                  <th className="py-2.5 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                <tr>
                  <td className="py-3 px-4 font-mono text-blue-600">TAB_SWITCH</td>
                  <td className="py-3 px-4 font-bold text-yellow-600">+3</td>
                  <td className="py-3 px-4 text-gray-500">Candidate switched away from assessment browser tab</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-blue-600">FULLSCREEN_EXIT</td>
                  <td className="py-3 px-4 font-bold text-yellow-600">+4</td>
                  <td className="py-3 px-4 text-gray-500">Candidate exited forced fullscreen mode</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-blue-600">PASTE_ATTEMPT</td>
                  <td className="py-3 px-4 font-bold text-yellow-600">+4</td>
                  <td className="py-3 px-4 text-gray-500">Pasted external code/text into assessment environment</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-blue-600">MULTIPLE_SESSION</td>
                  <td className="py-3 px-4 font-bold text-red-600">+10</td>
                  <td className="py-3 px-4 text-gray-500">Concurrent active session opened from another device/browser</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
