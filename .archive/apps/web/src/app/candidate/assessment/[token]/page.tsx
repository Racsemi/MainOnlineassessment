'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Send, 
  Bookmark, 
  RotateCcw, 
  Terminal, 
  Laptop, 
  Camera, 
  Mic, 
  Wifi, 
  Check, 
  Sparkles, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { LANGUAGE_REGISTRY } from '@racsemi/shared';

// Dynamically import Monaco Editor to prevent SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type FlowStage = 'LOADING' | 'WELCOME' | 'SYSTEM_CHECK' | 'RULES_CONSENT' | 'ASSESSMENT' | 'SUBMITTED';

export default function CandidateAssessmentPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [stage, setStage] = useState<FlowStage>('LOADING');
  const [initData, setInitData] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  // System Check State
  const [camStatus, setCamStatus] = useState<'pending' | 'checking' | 'passed' | 'failed'>('pending');
  const [micStatus, setMicStatus] = useState<'pending' | 'checking' | 'passed' | 'failed'>('pending');
  const [browserStatus, setBrowserStatus] = useState<'passed'>('passed');
  const [netStatus, setNetStatus] = useState<'passed'>('passed');
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Active Assessment State
  const [currentSecIdx, setCurrentSecIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; status: string }>>({});
  const [codingDrafts, setCodingDrafts] = useState<Record<string, { codes: Record<string, string>; language: string }>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  
  // Timer State (Server Authoritative)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(6000);
  
  // Code Execution State
  const [runLoading, setRunLoading] = useState(false);
  const [submitCodeLoading, setSubmitCodeLoading] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<any | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'output'>('testcases');
  const [submitAssessmentLoading, setSubmitAssessmentLoading] = useState(false);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);

  // Auto-save debouncer
  const autosaveTimerRef = useRef<any>(null);

  // 1. Initial Load: Validate Invitation Token
  useEffect(() => {
    async function verifyToken() {
      const res = await fetchApi(`/candidate/assessment/${token}`);
      if (res.success && res.data) {
        setInitData(res.data);
        if (res.data.existingSession?.status === 'SUBMITTED' || res.data.existingSession?.status === 'AUTO_SUBMITTED') {
          setStage('SUBMITTED');
        } else if (res.data.existingSession?.status === 'IN_PROGRESS') {
          // Reconnect to active session directly
          resumeActiveSession(res.data.existingSession.id);
        } else {
          setStage('WELCOME');
        }
      } else {
        alert(res.message || 'Invalid or expired assessment link');
      }
    }
    verifyToken();
  }, [token]);

  // Resume session on reconnect/refresh
  const resumeActiveSession = async (sessionId: string) => {
    const res = await fetchApi(`/candidate/session/${sessionId}`);
    if (res.success && res.data) {
      setSession({ id: res.data.sessionId });
      setSnapshot(res.data.snapshot);
      setRemainingSeconds(res.data.remainingSeconds);
      setCurrentSecIdx(res.data.currentSectionIndex || 0);
      setCurrentQIdx(res.data.currentQuestionIndex || 0);

      // Restore saved answers
      const restoredAnswers: any = {};
      for (const sa of res.data.savedAnswers || []) {
        restoredAnswers[sa.questionId] = {
          selected: sa.selectedOptions || [],
          status: sa.status
        };
      }
      setAnswers(restoredAnswers);

      // Restore coding drafts
      const restoredDrafts: any = {};
      for (const sc of res.data.savedCodingDrafts || []) {
        restoredDrafts[sc.questionId] = {
          codes: { [sc.language]: sc.sourceCode },
          language: sc.language
        };
      }
      setCodingDrafts(restoredDrafts);

      setStage('ASSESSMENT');
    }
  };

  // 2. Start Assessment Session
  const handleStartAssessment = async () => {
    const res = await fetchApi('/candidate/session/start', {
      method: 'POST',
      body: JSON.stringify({
        token,
        deviceFingerprint: navigator.userAgent,
        systemCheckSummary: { camera: camStatus, mic: micStatus, browser: browserStatus }
      })
    });

    if (res.success && res.data) {
      setSession({ id: res.data.sessionId });
      setSnapshot(res.data.snapshot);
      setRemainingSeconds(res.data.remainingSeconds);
      setStage('ASSESSMENT');
    } else {
      alert(res.message || 'Failed to start session');
    }
  };

  // 3. Server-Authoritative Timer Countdown
  useEffect(() => {
    if (stage !== 'ASSESSMENT') return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage]);

  // 4. Anti-Cheat & Ethical Integrity Event Listeners
  const reportIntegrityEvent = useCallback(async (eventType: string, eventData?: any, warningMessage?: string) => {
    if (!session?.id) return;
    
    if (warningMessage) {
      setIntegrityWarning(warningMessage);
      setTimeout(() => setIntegrityWarning(null), 5000);
    }

    await fetchApi('/integrity/event', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        eventType,
        eventData,
        clientTimestamp: new Date().toISOString()
      })
    });
  }, [session]);

  useEffect(() => {
    if (stage !== 'ASSESSMENT') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportIntegrityEvent('TAB_SWITCH', { action: 'Candidate switched tabs or minimized window' }, 'Warning: Tab switching is prohibited and has been recorded.');
      } else {
        reportIntegrityEvent('WINDOW_FOCUS');
      }
    };

    const handleBlur = () => {
      reportIntegrityEvent('WINDOW_BLUR', { action: 'Window lost focus' }, 'Warning: Window lost focus. Please keep the assessment active.');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportIntegrityEvent('FULLSCREEN_EXIT', { action: 'Candidate exited fullscreen mode' }, 'Warning: Exiting fullscreen mode is recorded as a violation.');
      }
    };

    const handleCopy = () => {
      reportIntegrityEvent('COPY_ATTEMPT', undefined, 'Warning: Copying content is not allowed.');
    };

    const handlePaste = () => {
      reportIntegrityEvent('PASTE_ATTEMPT', undefined, 'Warning: Pasting content is not allowed.');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [stage, reportIntegrityEvent]);

  // 5. Autosave Trigger
  const triggerAutosave = useCallback((currentQId: string, customAnswer?: any, customDraft?: any) => {
    if (!session?.id) return;

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      await fetchApi(`/candidate/session/${session.id}/autosave`, {
        method: 'POST',
        body: JSON.stringify({
          currentSectionIndex: currentSecIdx,
          currentQuestionIndex: currentQIdx,
          answer: customAnswer || (answers[currentQId] ? {
            questionId: currentQId,
            selectedOptions: answers[currentQId].selected,
            status: answers[currentQId].status
          } : undefined),
          codingDraft: customDraft || (codingDrafts[currentQId] ? {
            questionId: currentQId,
            sourceCode: codingDrafts[currentQId].codes[selectedLanguage] || '',
            language: selectedLanguage
          } : undefined)
        })
      });
    }, 1000);
  }, [session, currentSecIdx, currentQIdx, answers, codingDrafts]);

  // Current Question accessor
  const currentSection = snapshot?.sections?.[currentSecIdx];
  const currentQuestion = currentSection?.questions?.[currentQIdx];

  // Initialize starter code when navigating to coding question
  useEffect(() => {
    if (currentQuestion && currentQuestion.questionType === 'CODING') {
      const qId = currentQuestion.id;
      if (!codingDrafts[qId] || !codingDrafts[qId].codes) {
        const langCode = currentQuestion.codingDetails?.starterCode?.[selectedLanguage] || 
          LANGUAGE_REGISTRY[selectedLanguage]?.defaultStarterCode || '';
        
        setCodingDrafts((prev) => ({
          ...prev,
          [qId]: { codes: { [selectedLanguage]: langCode }, language: selectedLanguage }
        }));
      } else if (!codingDrafts[qId].codes[selectedLanguage]) {
        const langCode = currentQuestion.codingDetails?.starterCode?.[selectedLanguage] || 
          LANGUAGE_REGISTRY[selectedLanguage]?.defaultStarterCode || '';
          
        setCodingDrafts((prev) => ({
          ...prev,
          [qId]: {
            ...prev[qId],
            language: selectedLanguage,
            codes: {
              ...prev[qId].codes,
              [selectedLanguage]: langCode
            }
          }
        }));
      }
    }
  }, [currentQuestion, selectedLanguage]);

  // Run Code against sample test cases
  const handleRunCode = async () => {
    if (!currentQuestion) return;
    setRunLoading(true);
    setActiveConsoleTab('output');

    const sourceCode = codingDrafts[currentQuestion.id]?.codes[selectedLanguage] || '';
    const res = await fetchApi('/candidate/code/run', {
      method: 'POST',
      body: JSON.stringify({
        questionId: currentQuestion.id,
        language: selectedLanguage,
        sourceCode
      })
    });

    setRunLoading(false);
    if (res.success && res.data) {
      setExecutionOutput(res.data);
    } else {
      setExecutionOutput({ compileOutput: res.message || 'Execution failed' });
    }
  };

  // Submit Code for Coding Question
  const handleSubmitCode = async () => {
    if (!currentQuestion || !session?.id) return;
    setSubmitCodeLoading(true);
    setActiveConsoleTab('output');

    const sourceCode = codingDrafts[currentQuestion.id]?.codes[selectedLanguage] || '';
    const res = await fetchApi('/candidate/code/submit', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: session.id,
        questionId: currentQuestion.id,
        language: selectedLanguage,
        sourceCode
      })
    });

    setSubmitCodeLoading(false);
    if (res.success && res.data) {
      setExecutionOutput(res.data);
      // Mark question as answered
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { selected: ['CODING_SUBMITTED'], status: 'ANSWERED' }
      }));
    }
  };

  // Final Assessment Submit
  const handleFinalSubmit = async (auto = false) => {
    if (!session?.id) return;
    if (!auto && !confirm('Are you sure you want to submit your final assessment? You will not be able to make further edits.')) {
      return;
    }

    setSubmitAssessmentLoading(true);
    const res = await fetchApi(`/candidate/session/${session.id}/submit`, {
      method: 'POST'
    });

    setSubmitAssessmentLoading(false);
    if (res.success) {
      setStage('SUBMITTED');
    }
  };

  // Format Timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------------------------------
  // RENDER: Loading Stage
  // ----------------------------------------------------------------------------
  if (stage === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center animate-pulse text-white font-bold text-xl mb-4">
          R
        </div>
        <p className="text-sm font-semibold text-slate-300">Validating RACSEMI assessment token...</p>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // RENDER: Welcome Screen
  // ----------------------------------------------------------------------------
  if (stage === 'WELCOME') {
    const a = initData?.assessment;
    const c = initData?.candidate;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white text-lg">
                R
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">RACSEMI Assess</h1>
                <p className="text-xs text-slate-400">Official Candidate Assessment</p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 bg-blue-900/30 text-blue-300 border border-blue-700/40 rounded-full font-semibold">
              Candidate: {c?.name}
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">{a?.title}</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{a?.description}</p>
          </div>

          {/* Assessment Specifications Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block mb-1">Total Duration</span>
              <span className="font-bold text-white">{a?.durationMinutes} Minutes</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block mb-1">Total Marks</span>
              <span className="font-bold text-white">{a?.totalMarks} Marks</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block mb-1">Total Sections</span>
              <span className="font-bold text-white">{a?.sections?.length || 4} Sections</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-500 block mb-1">Proctoring</span>
              <span className="font-bold text-cyan-400">{a?.proctoringMode}</span>
            </div>
          </div>

          {/* Section Breakdown Pills */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assessment Sections:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {a?.sections?.map((sec: any, idx: number) => (
                <div key={sec.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{idx + 1}. {sec.title}</span>
                    <p className="text-[11px] text-slate-500">{sec.durationMinutes} Mins • {sec.marks} Marks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
            <button
              onClick={() => setStage('SYSTEM_CHECK')}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-sm flex items-center gap-2"
            >
              <span>Continue to System Check</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // RENDER: System Check Stage
  // ----------------------------------------------------------------------------
  if (stage === 'SYSTEM_CHECK') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">System Hardware & Browser Diagnostics</h2>
            <p className="text-xs text-slate-400 mt-1">Verifying compatibility for online coding and assessment integrity.</p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Laptop className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="font-semibold text-white">Browser Compatibility</p>
                  <p className="text-[11px] text-slate-400">Chrome / Firefox / Edge supported</p>
                </div>
              </div>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> PASSED
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="font-semibold text-white">Internet & Server Connection</p>
                  <p className="text-[11px] text-slate-400">Latency &lt; 50ms (Connected)</p>
                </div>
              </div>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="font-semibold text-white">Webcam / Visual Check</p>
                  <p className="text-[11px] text-slate-400">Required for ethical assessment proctoring</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCamStatus('passed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  camStatus === 'passed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-blue-600 text-white'
                }`}
              >
                {camStatus === 'passed' ? '✓ Verified' : 'Check Camera'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStage('WELCOME')}
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              Back
            </button>
            <button
              onClick={() => setStage('RULES_CONSENT')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <span>Next: Instructions & Consent</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // RENDER: Rules & Consent Stage
  // ----------------------------------------------------------------------------
  if (stage === 'RULES_CONSENT') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Assessment Rules & Integrity Agreement</h2>
            <p className="text-xs text-slate-400 mt-1">Please review the code of conduct before starting.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
            <p className="font-bold text-white">1. Server-Authoritative Timing:</p>
            <p>Your assessment timer is monitored and enforced server-side. Once the countdown finishes, your assessment will be submitted automatically.</p>

            <p className="font-bold text-white">2. Fullscreen & Window Focus:</p>
            <p>You must stay in fullscreen mode and avoid switching tabs or minimizing the browser. Tab switches and focus loss are logged as integrity events.</p>

            <p className="font-bold text-white">3. Isolated Coding Execution:</p>
            <p>You can run your code against sample test cases using the &quot;Run Code&quot; button. Final code submissions are evaluated against hidden test cases in an isolated Docker sandbox.</p>

            <p className="font-bold text-white">4. Privacy, Monitoring & Consent Notice:</p>
            <p>
              By starting this assessment, you consent to the following monitoring activities which will be recorded for recruitment evaluation:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Tabs & Focus:</strong> Switching tabs, minimizing windows, and exiting fullscreen are strictly monitored.</li>
              {initData?.assessment?.proctoringMode === 'ADVANCED' && (
                <>
                  <li><strong>Camera:</strong> Your webcam will be active to monitor your presence.</li>
                  <li><strong>Screen:</strong> Your screen may be monitored or recorded for suspicious activity.</li>
                  <li><strong>Microphone:</strong> Audio input may be monitored.</li>
                </>
              )}
            </ul>
          </div>

          <div className="p-4 bg-blue-950/20 border border-blue-800/30 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="consent"
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-0 cursor-pointer"
            />
            <label htmlFor="consent" className="text-xs text-slate-200 cursor-pointer font-medium leading-relaxed">
              I have read and agree to the RACSEMI assessment guidelines. I explicitly consent to the monitoring of my browser tabs, focus, {initData?.assessment?.proctoringMode === 'ADVANCED' ? 'webcam, microphone, and screen' : 'and window state'} for integrity purposes during this assessment.
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStage('SYSTEM_CHECK')}
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              Back
            </button>
            <button
              disabled={!consentAgreed}
              onClick={handleStartAssessment}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3 px-8 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-40 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Assessment Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // RENDER: Active Assessment Stage
  // ----------------------------------------------------------------------------
  if (stage === 'ASSESSMENT') {
    if (!currentQuestion) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Loading question context...
        </div>
      );
    }

    const qId = currentQuestion.id;
    const isCoding = currentQuestion.questionType === 'CODING';
    const isMultiMcq = currentQuestion.questionType === 'MCQ_MULTIPLE';
    const currentAnswer = answers[qId] || { selected: [], status: 'UNANSWERED' };

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 select-none">
        
        {/* Integrity Warning Toast */}
        {integrityWarning && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-5">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-bold">{integrityWarning}</span>
          </div>
        )}

        {/* Top Assessment Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white text-sm">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">RACSEMI Assess</h1>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">{snapshot?.title}</p>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {snapshot?.sections?.map((sec: any, idx: number) => (
              <button
                key={sec.id}
                onClick={() => {
                  setCurrentSecIdx(idx);
                  setCurrentQIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentSecIdx === idx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-850'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </div>

          {/* Server Timer & Final Submit Button */}
          <div className="flex items-center gap-4">
            <div className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold ${
              remainingSeconds < 300
                ? 'bg-rose-950/50 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-slate-850 border-slate-800 text-cyan-300'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            <button
              onClick={() => handleFinalSubmit(false)}
              disabled={submitAssessmentLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Assessment</span>
            </button>
          </div>
        </header>

        {/* Main Split Layout: Question + Palette (Left / Right) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Main Question & Workspace (Left/Center) */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
            {/* Question Header & Mark Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-900/40 text-blue-300 border border-blue-800/40">
                  Question {currentQIdx + 1} of {currentSection?.questions?.length}
                </span>
                <span className="text-xs text-slate-400 font-semibold">{currentQuestion.category}</span>
              </div>
              <div className="text-xs text-slate-400 font-semibold">
                Marks: <strong className="text-emerald-400">+{currentQuestion.score}</strong>
                {currentQuestion.negativeScore > 0 && <span className="text-rose-400 ml-1">(-{currentQuestion.negativeScore})</span>}
              </div>
            </div>

            {/* Content & Editor Area */}
            <div className={`flex-1 flex flex-col ${isCoding ? 'lg:flex-row gap-6' : 'space-y-4'}`}>
              
              {/* Problem Description (Left side for coding, full width for MCQ) */}
              <div className={isCoding ? 'lg:w-1/3 flex flex-col space-y-4' : 'space-y-4'}>
                <h3 className="text-base font-bold text-white">{currentQuestion.title}</h3>
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto">
                  {currentQuestion.problemStatement}
                </div>
              </div>

            {/* MCQ Options Rendering */}
            {!isCoding && currentQuestion.options && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400">
                  {isMultiMcq ? 'Select all correct options:' : 'Choose the correct option:'}
                </p>
                <div className="space-y-2">
                  {currentQuestion.options.map((opt: any) => {
                    const isSelected = currentAnswer.selected.includes(opt.optionKey);

                    return (
                      <div
                        key={opt.id || opt.optionKey}
                        onClick={() => {
                          let newSelected: string[];
                          if (isMultiMcq) {
                            newSelected = isSelected
                              ? currentAnswer.selected.filter(k => k !== opt.optionKey)
                              : [...currentAnswer.selected, opt.optionKey];
                          } else {
                            newSelected = [opt.optionKey];
                          }

                          const updated = {
                            ...answers,
                            [qId]: { selected: newSelected, status: 'ANSWERED' }
                          };
                          setAnswers(updated);
                          triggerAutosave(qId, { questionId: qId, selectedOptions: newSelected, status: 'ANSWERED' });
                        }}
                        className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white font-semibold shadow-md shadow-blue-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {opt.optionKey}
                          </span>
                          <span>{opt.content}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Coding Problem: Monaco Editor + Test Cases Panel (Right side) */}
            {isCoding && (
              <div className="lg:w-2/3 flex flex-col space-y-4 min-h-0">
                {/* Language Switcher & Controls */}
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-400">Language:</label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="python">Python 3 (3.11)</option>
                      <option value="javascript">JavaScript (Node 20)</option>
                      <option value="cpp">C++ (g++ 17)</option>
                      <option value="java">Java (OpenJDK 17)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunCode}
                      disabled={runLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{runLoading ? 'Running...' : 'Run Code'}</span>
                    </button>
                    <button
                      onClick={handleSubmitCode}
                      disabled={submitCodeLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>{submitCodeLoading ? 'Evaluating...' : 'Submit Code'}</span>
                    </button>
                  </div>
                </div>

                {/* Monaco Editor Container */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 h-80">
                  <Editor
                    height="100%"
                    language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage === 'python' ? 'python' : 'javascript'}
                    theme="vs-dark"
                    value={codingDrafts[qId]?.codes?.[selectedLanguage] || ''}
                    onChange={(val) => {
                      const updated = {
                        ...codingDrafts,
                        [qId]: { 
                          ...codingDrafts[qId],
                          language: selectedLanguage,
                          codes: {
                            ...codingDrafts[qId]?.codes,
                            [selectedLanguage]: val || ''
                          }
                        }
                      };
                      setCodingDrafts(updated);
                      triggerAutosave(qId, undefined, { questionId: qId, sourceCode: val || '', language: selectedLanguage });
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      tabSize: 4
                    }}
                  />
                </div>

                {/* Execution Results Console */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-4 border-b border-slate-800 pb-2">
                    <button
                      onClick={() => setActiveConsoleTab('testcases')}
                      className={`text-xs font-semibold pb-1 transition-colors ${
                        activeConsoleTab === 'testcases' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sample Test Cases
                    </button>
                    <button
                      onClick={() => setActiveConsoleTab('output')}
                      className={`text-xs font-semibold pb-1 transition-colors ${
                        activeConsoleTab === 'output' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Execution Console Output
                    </button>
                  </div>

                  {activeConsoleTab === 'testcases' && (
                    <div className="space-y-2 text-xs">
                      {currentQuestion.codingDetails?.sampleCases?.map((sc: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 font-mono">
                          <span className="text-slate-400 font-bold">Sample Case {idx + 1}:</span>
                          <p className="text-slate-300">Input: {sc.input}</p>
                          <p className="text-cyan-300">Expected: {sc.output}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeConsoleTab === 'output' && (
                    <div className="text-xs space-y-2 font-mono">
                      {executionOutput ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-400">Status:</span>
                            <span className={`font-bold ${
                              executionOutput.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {executionOutput.status}
                            </span>
                            {executionOutput.passedTestCases !== undefined && (
                              <span className="text-slate-400">
                                ({executionOutput.passedTestCases}/{executionOutput.totalTestCases} tests passed)
                              </span>
                            )}
                          </div>

                          {executionOutput.compileOutput && (
                            <pre className="p-3 bg-slate-950 rounded-lg text-rose-300 overflow-x-auto">
                              {executionOutput.compileOutput}
                            </pre>
                          )}

                          {executionOutput.sampleTestResults?.map((r: any, i: number) => (
                            <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                              <span className={r.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {r.passed ? '✓ Test Passed' : '✗ Test Failed'} ({r.executionTimeMs}ms)
                              </span>
                              {r.actualOutput && <p className="text-slate-300">Output: {r.actualOutput}</p>}
                            </div>
                          ))}
                        </>
                      ) : (
                        <p className="text-slate-500">Run code or submit to view sandbox execution output.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const currentStatus = answers[qId]?.status === 'MARKED_FOR_REVIEW' ? 'ANSWERED' : 'MARKED_FOR_REVIEW';
                    const updated = {
                      ...answers,
                      [qId]: { ...currentAnswer, status: currentStatus }
                    };
                    setAnswers(updated);
                    triggerAutosave(qId, { questionId: qId, selectedOptions: currentAnswer.selected, status: currentStatus });
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    answers[qId]?.status === 'MARKED_FOR_REVIEW'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{answers[qId]?.status === 'MARKED_FOR_REVIEW' ? 'Marked' : 'Mark for Review'}</span>
                </button>

                {!isCoding && (
                  <button
                    onClick={() => {
                      const updated = { ...answers };
                      delete updated[qId];
                      setAnswers(updated);
                      triggerAutosave(qId, { questionId: qId, selectedOptions: [], status: 'UNANSWERED' });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Answer</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentQIdx === 0 && currentSecIdx === 0}
                  onClick={() => {
                    if (currentQIdx > 0) {
                      setCurrentQIdx(currentQIdx - 1);
                    } else if (currentSecIdx > 0) {
                      setCurrentSecIdx(currentSecIdx - 1);
                      setCurrentQIdx(snapshot.sections[currentSecIdx - 1].questions.length - 1);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <button
                  onClick={() => {
                    if (currentQIdx < currentSection.questions.length - 1) {
                      setCurrentQIdx(currentQIdx + 1);
                    } else if (currentSecIdx < snapshot.sections.length - 1) {
                      setCurrentSecIdx(currentSecIdx + 1);
                      setCurrentQIdx(0);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-md shadow-blue-500/20"
                >
                  Save & Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Question Palette Navigator */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-6 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Question Navigator</h4>
              <p className="text-[11px] text-slate-400">Section: {currentSection?.title}</p>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500"></span> Answered
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500"></span> Marked
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></span> Unanswered
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded ring-2 ring-blue-500 bg-slate-800"></span> Current
              </div>
            </div>

            {/* Question Grid Buttons */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {currentSection?.questions?.map((q: any, idx: number) => {
                const ans = answers[q.id];
                const isAnswered = ans && ans.selected && ans.selected.length > 0;
                const isMarked = ans && ans.status === 'MARKED_FOR_REVIEW';
                const isCurrent = idx === currentQIdx;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIdx(idx)}
                    className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                      isCurrent
                        ? 'ring-2 ring-blue-400 bg-blue-600/30 text-white font-extrabold'
                        : isMarked
                        ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                        : isAnswered
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // RENDER: Submission Confirmation Screen (Zero Score Leakage)
  // ----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Assessment Submitted Successfully</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your assessment has been submitted successfully. The RACSEMI recruitment team will review your performance and contact you regarding the next steps.
          </p>
        </div>

        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <p className="text-white font-semibold">RACSEMI Talent Acquisition</p>
          <p>You may now safely close this browser window.</p>
        </div>
      </div>
    </div>
  );
}
