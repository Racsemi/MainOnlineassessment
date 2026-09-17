'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { 
  FileCode2, 
  Plus, 
  Search, 
  Clock, 
  Award, 
  Users, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function AssessmentsListPage() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAssessments = async () => {
    setLoading(true);
    const res = await fetchApi('/assessments');
    if (res.success && res.data) {
      setAssessments(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAssessments();
  }, []);

  const handlePublish = async (id: string) => {
    const res = await fetchApi(`/assessments/${id}/publish`, { method: 'POST' });
    if (res.success) {
      loadAssessments();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Assessment Management" />

      <main className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Recruitment Assessments</h2>
            <p className="text-xs text-gray-500">
              Manage sections, question allocations, timing modes, and candidate access.
            </p>
          </div>

          <Link
            href="/assessments/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Assessment</span>
          </Link>
        </div>

        {/* Assessment Cards */}
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="p-12 text-center text-gray-500 text-sm">Loading assessments...</div>
          ) : assessments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-200">
              No assessments found. Create your first assessment to begin.
            </div>
          ) : (
            assessments.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md p-6 rounded-2xl transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">{a.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        a.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {a.status}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                        {a.role || 'Software Intern'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 max-w-2xl">
                      {a.description || 'Comprehensive technical assessment evaluating problem solving, algorithms and CS fundamentals.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(a.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    <Link
                      href="/reports"
                      className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200 transition-colors flex items-center gap-1.5"
                    >
                      <Award className="w-3.5 h-3.5 text-blue-500" />
                      <span>View Results</span>
                    </Link>
                  </div>
                </div>

                {/* Meta details bar */}
                <div className="pt-3 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Duration: <strong className="text-gray-900">{a.durationMinutes} Mins</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Award className="w-4 h-4 text-gray-400" />
                    <span>Total Marks: <strong className="text-gray-900">{a.totalMarks}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>Invited Candidates: <strong className="text-gray-900">{a._count?.invitations || 5}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>Proctoring: <strong className="text-blue-600">{a.proctoringMode}</strong></span>
                  </div>
                </div>

                {/* Section Pills */}
                {a.sections && a.sections.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 overflow-x-auto text-[11px]">
                    <span className="text-gray-500 font-semibold">Sections:</span>
                    {a.sections.map((s: any, idx: number) => (
                      <span key={s.id || idx} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
                        {idx + 1}. {s.title} ({s.marks} Marks • {s.durationMinutes}m)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
