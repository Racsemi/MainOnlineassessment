'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Code2, 
  ShieldAlert, 
  ShieldCheck, 
  MessageSquare, 
  UserCheck, 
  UserX, 
  ChevronLeft,
  Sparkles,
  FileCode,
  Send,
  AlertTriangle
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CandidateDetailedReportPage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [decision, setDecision] = useState('PENDING');

  const loadDetailedReport = async () => {
    setLoading(true);
    const res = await fetchApi(`/reports/candidate/${candidateId}`);
    if (res.success && res.data) {
      setReport(res.data);
      setDecision(res.data.report?.recruiterDecision || 'PENDING');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetailedReport();
  }, [candidateId]);

  const handleUpdateDecision = async (newDec: string) => {
    if (!report?.session?.id) return;
    setDecision(newDec);
    await fetchApi('/reports/candidate/decision', {
      method: 'POST',
      body: JSON.stringify({ sessionId: report.session.id, decision: newDec })
    });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !report?.candidate?.id) return;
    setAddingNote(true);

    const res = await fetchApi('/reports/candidate/note', {
      method: 'POST',
      body: JSON.stringify({
        candidateId: report.candidate.id,
        assessmentId: report.assessment.id,
        note: newNote
      })
    });

    setAddingNote(false);
    if (res.success) {
      setNewNote('');
      loadDetailedReport();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="Candidate Evaluation Scorecard" />
        <div className="p-12 text-center text-gray-500 text-sm">Loading comprehensive scorecard...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 flex flex-col min-w-0 p-8 space-y-4">
        <Link href="/reports" className="text-xs text-blue-600 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="p-8 text-center text-red-600 bg-white rounded-2xl border border-gray-200 shadow-sm">
          Candidate evaluation report not found or assessment pending completion.
        </div>
      </div>
    );
  }

  const { candidate, assessment, result, report: integrityReport, integrityEvents, mcqAnswers, codingSubmissions, interviewerNotes } = report;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Candidate Scorecard & Audit" />

      <main className="p-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Assessment Leaderboard
        </Link>

        {/* Candidate Profile Header Card */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-50 to-blue-100 border border-blue-200 flex items-center justify-center font-black text-2xl text-blue-700">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">{candidate.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                    {assessment.role || 'Software Intern'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{candidate.email} • {candidate.candidateIdentifier || 'ID: CAND-001'}</p>
                <p className="text-xs text-gray-500 mt-1">{assessment.title}</p>
              </div>
            </div>

            {/* Score Pill & Decision Buttons */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-gray-900">
                    {result ? `${result.totalScore} / ${result.maxScore}` : 'Pending'}
                  </div>
                  <div className="text-xs text-green-600 font-semibold">
                    {result ? `${result.percentage}% • ${result.passed ? 'PASSED' : 'FAILED'}` : 'In Progress'}
                  </div>
                </div>
              </div>

              {/* Recruiter Decision Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleUpdateDecision('SHORTLISTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    decision === 'SHORTLISTED'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Shortlist</span>
                </button>
                <button
                  onClick={() => handleUpdateDecision('REJECTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    decision === 'REJECTED'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section Score Breakdown Grid */}
        {result?.sectionResults && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Sectional Performance Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {result.sectionResults.map((sr: any) => (
                <div key={sr.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                  <div className="text-xs font-semibold text-gray-500">{sr.section?.title || 'Section'}</div>
                  <div className="text-lg font-bold text-gray-900">{sr.score} / {sr.maxScore} <span className="text-xs text-gray-500 font-normal">Marks</span></div>
                  <div className="text-[11px] text-gray-500">{sr.questionsCorrect} Correct / {sr.questionsAttempted} Attempted</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coding Submissions Evaluation Details */}
        {codingSubmissions && codingSubmissions.length > 0 && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">Coding Challenges Sandbox Submissions</h3>
            </div>

            <div className="space-y-4">
              {codingSubmissions.map((sub: any) => (
                <div key={sub.id} className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{sub.question?.title || 'Coding Problem'}</h4>
                      <p className="text-xs text-gray-600">Language: <span className="font-mono text-blue-600">{sub.language}</span> • Status: <strong className="text-green-600">{sub.status}</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{sub.scoreObtained} Marks</span>
                      <p className="text-[11px] text-gray-500">{sub.passedTestCases} / {sub.totalTestCases} Test Cases Passed</p>
                    </div>
                  </div>

                  {/* Candidate Source Code Viewer */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Candidate Source Code:</span>
                    <pre className="p-4 bg-gray-100 rounded-xl text-xs font-mono text-gray-800 overflow-x-auto border border-gray-200">
                      {sub.sourceCode}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ethical Integrity & Anti-Cheat Timeline */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <h3 className="text-base font-bold text-gray-900">Ethical Integrity & Monitoring Telemetry</h3>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
              integrityReport?.overallRiskLevel === 'HIGH' || integrityReport?.overallRiskLevel === 'CRITICAL'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              Overall Risk: {integrityReport?.overallRiskLevel || 'LOW'} (Score: {integrityReport?.integrityScore || 100}/100)
            </span>
          </div>

          {integrityEvents && integrityEvents.length > 0 ? (
            <div className="space-y-2">
              {integrityEvents.map((evt: any) => (
                <div key={evt.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="font-semibold text-gray-900">{evt.eventType}</span>
                    <span className="text-gray-500 text-[11px]">Weight: +{evt.riskWeight}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-[11px]">
                    {new Date(evt.clientTimestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Clean session. No suspicious tab switches, copy attempts, or window blurs detected.</span>
            </div>
          )}
        </div>

        {/* Private Interviewer Notes */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900">Private Recruiter & Interviewer Notes</h3>
          </div>

          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              rows={3}
              required
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add confidential evaluation notes regarding candidate problem-solving style..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={addingNote}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{addingNote ? 'Saving Note...' : 'Add Private Note'}</span>
            </button>
          </form>

          {interviewerNotes && interviewerNotes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-200">
              {interviewerNotes.map((n: any) => (
                <div key={n.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span className="font-semibold text-gray-700">{n.author.firstName} {n.author.lastName}</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-900">{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
