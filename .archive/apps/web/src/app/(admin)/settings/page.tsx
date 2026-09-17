'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Settings, Building, Lock, Mail, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const [orgName, setOrgName] = useState('RACSEMI');
  const [retentionDays, setRetentionDays] = useState(30);
  const [emailSender, setEmailSender] = useState('RACSEMI Recruitment <no-reply@racsemi.com>');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Platform Settings" />

      <main className="p-8 space-y-6 max-w-4xl mx-auto w-full">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Organization & Security Configuration</h2>
          <p className="text-xs text-gray-500">
            Manage organization branding, email dispatch settings, and monitoring retention.
          </p>
        </div>

        <form onSubmit={handleSave} className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-6 text-xs">
          {/* Org Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" /> Organization Profile
            </h3>
            <div>
              <label className="block text-gray-700 mb-1 font-semibold">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Email Settings */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" /> Transactional Email Dispatcher
            </h3>
            <div>
              <label className="block text-gray-700 mb-1 font-semibold">Sender Display Name & Address</label>
              <input
                type="text"
                value={emailSender}
                onChange={(e) => setEmailSender(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Data Retention */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" /> Compliance & Data Retention
            </h3>
            <div>
              <label className="block text-gray-700 mb-1 font-semibold">Proctoring Telemetry Retention (Days)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {saved ? (
              <span className="text-green-600 font-semibold">✓ Settings saved successfully!</span>
            ) : <span></span>}

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
