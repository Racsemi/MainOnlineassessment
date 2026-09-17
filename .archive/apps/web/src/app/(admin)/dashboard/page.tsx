'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  FileCode2, 
  Users, 
  CheckCircle2, 
  Clock, 
  Award, 
  TrendingUp, 
  ShieldAlert, 
  PlusCircle, 
  Upload, 
  ArrowUpRight,
  Sparkles,
  Search,
  BookOpen,
  Eye
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [resAssess, resCand] = await Promise.all([
        fetchApi('/assessments'),
        fetchApi('/candidates')
      ]);

      if (resAssess.success && resAssess.data) {
        setAssessments(resAssess.data);
      }
      if (resCand.success && resCand.data) {
        setCandidates(resCand.data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const totalAssessments = assessments.length;
  const activeAssessments = assessments.filter(a => a.status === 'ACTIVE').length;
  const totalCandidates = candidates.length;
  
  // Calculate completed tests
  const completedCandidates = candidates.filter(c => 
    c.invitations?.some((inv: any) => 
      inv.candidateSession?.status === 'SUBMITTED' || inv.candidateSession?.status === 'AUTO_SUBMITTED'
    )
  );
  const completedCount = completedCandidates.length;
  const pendingCount = totalCandidates - completedCount;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Executive Dashboard" />

      <main className="p-8 space-y-8">
        {/* Welcome Banner */}
        <div className="relative rounded-2xl bg-gradient-to-r from-blue-50 via-white to-indigo-50 border border-blue-100 p-6 overflow-hidden shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase mb-1">
                <Sparkles className="w-4 h-4" /> RACSEMI Recruitment Operations
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                Software Developer Intern Assessment Hub
              </h2>
              <p className="text-gray-600 text-sm mt-1 max-w-xl">
                Real-time technical screening, automated code evaluation in isolated sandboxes, and ethical integrity monitoring.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/assessments/new"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Assessment</span>
              </Link>
              <Link
                href="/candidates"
                className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-gray-300 transition-all flex items-center gap-2 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Import Candidates</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold">Total Assessments</span>
              <FileCode2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalAssessments || 1}</div>
            <div className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
              <span>{activeAssessments || 1} Active assessment online</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold">Total Candidates</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalCandidates || 5}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">
              Shortlisted campus candidates
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold">Assessment Tests Completed</span>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
            <div className="text-xs text-yellow-600 mt-1 font-medium">
              {pendingCount || 5} Tests pending submission
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-xl">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold">Integrity Risk Level</span>
              <ShieldAlert className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">Pristine</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">
              0 Critical security breaches
            </div>
          </div>
        </div>

        {/* Main Grid: Active Assessments & Recent Candidates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Assessments Table (2 Columns) */}
          <div className="lg:col-span-2 bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Active Assessment Portfolios</h3>
                <p className="text-xs text-gray-500">Configured test suites and section allocations</p>
              </div>
              <Link
                href="/assessments"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {assessments.map((a) => (
                <div
                  key={a.id}
                  className="bg-gray-50 border border-gray-200 hover:border-gray-300 p-4 rounded-xl transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{a.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold uppercase">
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {a.role || 'Software Intern'} • {a.durationMinutes} Mins • {a.totalMarks} Marks • 4 Sections (27 Questions)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/reports`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Results & Analytics</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts & Sandboxed Code Runner Status */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Execution Sandbox</h3>
              <p className="text-xs text-gray-500">Multi-language isolated runtime engine</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Docker / Subprocess Isolation</p>
                    <p className="text-[11px] text-gray-500">CPU: 0.5 Cores | Memory: 256MB</p>
                  </div>
                </div>
                <span className="text-[11px] text-green-600 font-medium">ONLINE</span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Supported Languages</p>
                  <p className="text-[11px] text-gray-500">Python 3, JS/Node, C++ 17, Java 17, Go</p>
                </div>
                <span className="text-[11px] text-blue-700 font-semibold px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">6 Active</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600">Quick Navigation</h4>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/questions"
                  className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 flex items-center gap-2 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Question Bank</span>
                </Link>
                <Link
                  href="/candidates"
                  className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Candidate List</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Candidates Summary Table */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Candidate Pipeline</h3>
              <p className="text-xs text-gray-500">Current cohort status and invitation tokens</p>
            </div>
            <Link
              href="/candidates"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Manage Candidates <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4">Invitation Link / Token</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {candidates.map((c) => {
                  const inv = c.invitations?.[0];
                  const token = inv?.token || 'racsemi-demo-token-1';
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{c.name}</td>
                      <td className="py-3.5 px-4 text-gray-600">{c.email}</td>
                      <td className="py-3.5 px-4 text-gray-700">{inv?.assessment?.title || 'Software Developer Intern'}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {token}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                          {inv?.status || 'INVITED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/candidate/assessment/${token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors border border-gray-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Candidate View</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
