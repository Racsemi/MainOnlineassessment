'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  Users, 
  Upload, 
  Send, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  Mail, 
  ExternalLink,
  Plus,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Papa from 'papaparse';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('Rahul Sharma,rahul.sharma@example.com,+91 98765 43210\nPriya Patel,priya.patel@example.com,+91 98765 43211\nAnanya Iyer,ananya.iyer@example.com,+91 98765 43212');
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const loadCandidates = async () => {
    setLoading(true);
    let query = '/candidates?limit=100';
    if (search) query += `&search=${encodeURIComponent(search)}`;
    const res = await fetchApi(query);
    if (res.success && res.data) {
      setCandidates(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleImportCsv = async () => {
    setImporting(true);
    setImportResult(null);

    const rows = csvText.trim().split('\n');
    const parsedList = rows.map((r) => {
      const parts = r.split(',');
      return {
        name: parts[0]?.trim(),
        email: parts[1]?.trim(),
        phone: parts[2]?.trim()
      };
    }).filter(c => c.email && c.name);

    const res = await fetchApi('/candidates/import', {
      method: 'POST',
      body: JSON.stringify({ candidates: parsedList })
    });

    setImporting(false);
    if (res.success) {
      setImportResult(res);
      loadCandidates();
    } else {
      setImportResult({ error: res.message || 'Import failed' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const rows = results.data.map((r: any) => `${r.name || r.Name || ''},${r.email || r.Email || ''},${r.phone || r.Phone || ''}`);
          setCsvText(rows.join('\n'));
        }
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Candidate Directory" />

      <main className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Candidate Management</h2>
            <p className="text-xs text-gray-500">
              Manage candidate cohorts, dispatch cryptographically secure invitation links, and review submissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import Candidates (CSV)</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCandidates()}
              placeholder="Search candidate name, email, or candidate ID..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <span className="text-xs text-gray-500 font-semibold">
            {candidates.length} Registered Candidates
          </span>
        </div>

        {/* Candidate Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Candidate</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Assigned Assessment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Score</th>
                  <th className="py-3.5 px-4">Risk Level</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">Loading candidates...</td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">No candidates found. Import candidates via CSV to begin.</td>
                  </tr>
                ) : (
                  candidates.map((c) => {
                    const inv = c.invitations?.[0];
                    const session = inv?.candidateSession;
                    const result = session?.assessmentResult;
                    const report = session?.candidateReport;
                    const token = inv?.token || 'racsemi-demo-token-1';

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <div className="text-[11px] text-gray-500">{c.candidateIdentifier || 'ID: CAND-001'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-gray-700">{c.email}</div>
                          <div className="text-[11px] text-gray-500">{c.phone || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          {inv?.assessment?.title || 'Software Developer Intern Assessment'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                            session?.status === 'SUBMITTED' || session?.status === 'AUTO_SUBMITTED'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : session?.status === 'IN_PROGRESS'
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {session?.status || inv?.status || 'INVITED'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          {result ? `${result.totalScore} / ${result.maxScore}` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            report?.overallRiskLevel === 'HIGH' || report?.overallRiskLevel === 'CRITICAL'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {report?.overallRiskLevel || 'LOW'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <Link
                            href={`/reports/${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors"
                          >
                            <span>Report</span>
                          </Link>
                          <a
                            href={`/candidate/assessment/${token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 text-xs font-medium transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: CSV Candidate Import */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 shadow-xl rounded-2xl max-w-xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <span>Batch Candidate CSV Import</span>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-gray-600 space-y-4">
                <p>Upload a CSV file or paste comma-separated candidate rows in format: <code className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded">Name, Email, Phone</code></p>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />

                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {importResult && (
                <div className={`p-3 rounded-xl text-xs ${
                  importResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {importResult.message || importResult.error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={importing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm"
                >
                  {importing ? 'Processing Import...' : 'Import Candidates'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
