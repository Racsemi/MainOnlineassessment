'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  BarChart3, 
  Download, 
  Users, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ShieldAlert,
  ChevronRight,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { fetchApi, API_BASE_URL } from '@/lib/api';

export default function ReportsIndexPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAssessments() {
      const res = await fetchApi('/assessments');
      if (res.success && res.data && res.data.length > 0) {
        setAssessments(res.data);
        setSelectedAssessmentId(res.data[0].id);
      }
    }
    loadAssessments();
  }, []);

  useEffect(() => {
    if (!selectedAssessmentId) return;
    async function loadReport() {
      setLoading(true);
      const res = await fetchApi(`/reports/assessment/${selectedAssessmentId}`);
      if (res.success && res.data) {
        setReportData(res.data);
      }
      setLoading(false);
    }
    loadReport();
  }, [selectedAssessmentId]);

  const handleExportCsv = () => {
    if (!selectedAssessmentId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('racsemi_token') : '';
    window.open(`${API_BASE_URL}/reports/export/csv?assessmentId=${selectedAssessmentId}&token=${token}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Recruiter Reports & Leaderboard" />

      <main className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Performance Scorecards & Analytics</h2>
            <p className="text-xs text-gray-500">
              Aggregated section benchmarks, candidate score distributions, and exportable shortlists.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 shadow-sm"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>

            <button
              onClick={handleExportCsv}
              className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-300 transition-all flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-blue-500" />
              <span>Export CSV (Sanitized)</span>
            </button>
          </div>
        </div>

        {loading || !reportData ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading assessment analytics...</div>
        ) : (
          <>
            {/* Top Aggregate KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-2xl">
                <span className="text-xs font-semibold text-gray-500">Invited Candidates</span>
                <div className="text-2xl font-bold text-gray-900 mt-1">{reportData.metrics.totalInvited}</div>
                <div className="text-xs text-blue-600 mt-1">{reportData.metrics.completedCount} Submissions Evaluated</div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-2xl">
                <span className="text-xs font-semibold text-gray-500">Average Score</span>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {reportData.metrics.avgScore} <span className="text-xs text-gray-400 font-normal">/ {reportData.assessment.totalMarks}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Across all completed candidates</div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-2xl">
                <span className="text-xs font-semibold text-gray-500">Pass Rate</span>
                <div className="text-2xl font-bold text-green-600 mt-1">{reportData.metrics.passRate}%</div>
                <div className="text-xs text-green-600/80 mt-1">Threshold: &gt;= 60%</div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-2xl">
                <span className="text-xs font-semibold text-gray-500">Integrity Risk Status</span>
                <div className="text-2xl font-bold text-green-600 mt-1">Low</div>
                <div className="text-xs text-gray-500 mt-1">0 Critical Violations</div>
              </div>
            </div>

            {/* Score Distribution Chart */}
            <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Score Distribution Curve</h3>
                <p className="text-xs text-gray-500">Cohort performance across percentage brackets</p>
              </div>

              <div className="grid grid-cols-5 gap-3 pt-2">
                {reportData.metrics.scoreDistribution.map((item: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center space-y-2">
                    <div className="text-xs font-semibold text-gray-500">{item.range}</div>
                    <div className="text-xl font-extrabold text-gray-900">{item.count}</div>
                    <div className="text-[10px] text-gray-400 font-medium">Candidates</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Candidate Leaderboard Table */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Assessment Leaderboard & Decisions</h3>
                  <p className="text-xs text-gray-500">Recruiter evaluation, score breakdown, and candidate reports</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Result</th>
                      <th className="py-3 px-4">Integrity Risk</th>
                      <th className="py-3 px-4">Decision</th>
                      <th className="py-3 px-4 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.candidates.map((c: any, rankIdx: number) => (
                      <tr key={c.candidateId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-500">#{rankIdx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <div className="text-[11px] text-gray-500">{c.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                            c.status === 'SUBMITTED' || c.status === 'AUTO_SUBMITTED'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {c.totalScore !== null ? `${c.totalScore} / ${reportData.assessment.totalMarks}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-700">
                          {c.percentage !== null ? `${c.percentage}%` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.passed !== null ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.passed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {c.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {c.riskLevel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${
                            c.recruiterDecision === 'SHORTLISTED'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : c.recruiterDecision === 'REJECTED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}>
                            {c.recruiterDecision}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/reports/${c.candidateId}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-semibold"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
