import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Search, Filter, ShieldAlert, X, Eye, Printer, ArrowLeft, Download, 
  AlertTriangle, Check, FileText, Code, CheckCircle, XCircle, Award, 
  User, Clock, Phone, GraduationCap, Building, ExternalLink, RefreshCw,
  ChevronDown, ChevronUp, Copy, Play, Zap, Camera, Image, Maximize2, 
  Terminal, ZoomIn, ChevronLeft, ChevronRight, Sliders, CheckSquare, Sparkles
} from 'lucide-react';
import api from '../../lib/axios';

interface ResultsViewProps {
  assessmentId?: string;
}

const getViolationDescription = (eventType: string) => {
  switch (eventType) {
    case 'FULLSCREEN_EXIT':
      return 'The candidate exited full-screen mode during the examination.';
    case 'TAB_SWITCH':
      return 'The candidate navigated away from the assessment tab or minimized the window.';
    case 'WINDOW_BLUR':
      return 'The candidate clicked outside the assessment window or lost window focus.';
    case 'COPY':
      return 'The candidate attempted to copy text from the assessment.';
    case 'PASTE':
      return 'The candidate attempted to paste external content into the response area.';
    default:
      return 'Integrity event captured by proctoring engine.';
  }
};

const getViolationBadgeColor = (eventType: string) => {
  switch (eventType) {
    case 'ID_VERIFICATION':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'FULLSCREEN_EXIT':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'TAB_SWITCH':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'WINDOW_BLUR':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'COPY':
    case 'PASTE':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const ResultsView: React.FC<ResultsViewProps> = ({ assessmentId: propId }) => {
  const { id: paramId } = useParams();
  const id = propId || paramId;

  const [rawResults, setRawResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  // Top level view mode: 'CANDIDATES' table vs 'ALL_INTEGRITY_PHOTOS' gallery
  const [activeViewMode, setActiveViewMode] = useState<'CANDIDATES' | 'ALL_INTEGRITY_PHOTOS'>('CANDIDATES');

  // Candidate Modal Tab: 'CODING' | 'ANSWERS' | 'PHOTOS' | 'LOGS' | 'PROFILE'
  const [activeModalTab, setActiveModalTab] = useState<'CODING' | 'ANSWERS' | 'PHOTOS' | 'LOGS' | 'PROFILE'>('CODING');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  // Auto Grade & Evaluation states
  const [isAutoGradingAll, setIsAutoGradingAll] = useState(false);
  const [autoGradeMessage, setAutoGradeMessage] = useState<string | null>(null);
  const [evaluatingSubmissionId, setEvaluatingSubmissionId] = useState<string | null>(null);
  const [singleTestResults, setSingleTestResults] = useState<Record<string, any>>({});

  // Interactive Code Runner state
  const [activeTestCaseTabs, setActiveTestCaseTabs] = useState<Record<string, number | 'CUSTOM'>>({});
  const [customInputMap, setCustomInputMap] = useState<Record<string, string>>({});
  const [customExecutionResults, setCustomExecutionResults] = useState<Record<string, any>>({});
  const [isRunningCustomInput, setIsRunningCustomInput] = useState<boolean>(false);

  // Candidate-Wise Integrity Photos Gallery filters
  const [candidatePhotoFilter, setCandidatePhotoFilter] = useState<'ALL' | 'FLAGGED_ONLY' | 'CLEAN_ONLY'>('ALL');
  const [photoSearchQuery, setPhotoSearchQuery] = useState<string>('');

  // Lightbox Modal state
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number | null>(null);
  const [lightboxPhotoList, setLightboxPhotoList] = useState<any[]>([]);

  const fetchResults = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/assessments/${id}/results`);
      setRawResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [id]);

  // Handle keyboard events for Lightbox modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxPhotoIndex === null) return;
      if (e.key === 'Escape') {
        setLightboxPhotoIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setLightboxPhotoIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'ArrowRight') {
        setLightboxPhotoIndex(prev => prev !== null && prev < lightboxPhotoList.length - 1 ? prev + 1 : prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhotoIndex, lightboxPhotoList]);

  // Normalize candidate fields from either direct properties or nested customFields
  const normalizedResults = useMemo(() => {
    return rawResults.map((r: any) => {
      const rawCustom = r.customFields || {};
      const phone = r.phone || rawCustom.phone || '';
      const college = r.college || rawCustom.field_1 || rawCustom.college || '';
      const cgpa = (r.cgpa !== undefined && r.cgpa !== null && r.cgpa !== '') 
        ? String(r.cgpa) 
        : (rawCustom.field_2 || rawCustom.cgpa || '');
      const branch = r.branch || rawCustom.branch || '';
      const resumeName = r.files?.[0]?.fileName || rawCustom.field_3 || '';
      
      const standardAnswers = r.standardAnswers || [];
      const codingSubmissions = r.codingSubmissions || [];
      
      const mcqScore = r.mcqScore !== undefined 
        ? r.mcqScore 
        : standardAnswers.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
      const mcqMaxScore = r.mcqMaxScore !== undefined 
        ? r.mcqMaxScore 
        : standardAnswers.reduce((sum: number, a: any) => sum + (Number(a.maxScore) || 0), 0);
        
      const codingScore = r.codingScore !== undefined 
        ? r.codingScore 
        : codingSubmissions.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
      const codingMaxScore = r.codingMaxScore !== undefined 
        ? r.codingMaxScore 
        : codingSubmissions.reduce((sum: number, a: any) => sum + (Number(a.maxScore) || 10), 0);

      const totalScore = r.score !== undefined ? r.score : (mcqScore + codingScore);
      const maxScore = r.maxScore || (mcqMaxScore + codingMaxScore) || 100;
      const percentage = r.percentage !== undefined 
        ? r.percentage 
        : (maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0);

      const fieldLabels: Record<string, string> = {
        phone: 'Phone Number',
        field_1: 'College / Institute',
        field_2: 'CGPA / Percentage',
        field_3: 'Resume / Document',
        college: 'College / Institute',
        cgpa: 'CGPA / Percentage',
        branch: 'Branch / Degree'
      };

      const customFieldsWithLabels: Record<string, { label: string, value: any }> = {};
      if (r.customFieldsWithLabels) {
        Object.assign(customFieldsWithLabels, r.customFieldsWithLabels);
      } else {
        for (const [k, v] of Object.entries(rawCustom)) {
          customFieldsWithLabels[k] = {
            label: fieldLabels[k] || k,
            value: v
          };
        }
      }

      return {
        ...r,
        candidateId: r.candidateId || r.id,
        phone,
        college,
        cgpa,
        branch,
        resumeName,
        score: totalScore,
        maxScore,
        percentage,
        mcqScore,
        mcqMaxScore,
        codingScore,
        codingMaxScore,
        customFieldsWithLabels,
        standardAnswers,
        codingSubmissions
      };
    });
  }, [rawResults]);

  // Master Collection of candidate-wise integrity photos
  const candidatesWithPhotos = useMemo(() => {
    return normalizedResults.map((c: any) => {
      const photos: any[] = [];
      if (c.photo) {
        photos.push({
          id: `reg-${c.candidateId}`,
          candidateId: c.candidateId,
          candidateName: c.name,
          candidateEmail: c.email,
          type: 'REGISTRATION',
          eventType: 'ID_VERIFICATION',
          title: 'Identity Verification Snapshot',
          description: 'Webcam photo captured during candidate registration / exam entry.',
          url: c.photo,
          timestamp: c.startedAt || c.submittedAt || null
        });
      }
      if (Array.isArray(c.integrityEvents)) {
        c.integrityEvents.forEach((ev: any, idx: number) => {
          if (ev.screenshot) {
            photos.push({
              id: ev.id || `ev-${c.candidateId}-${idx}`,
              candidateId: c.candidateId,
              candidateName: c.name,
              candidateEmail: c.email,
              type: 'PROCTORING_VIOLATION',
              eventType: ev.eventType,
              title: ev.eventType?.replace(/_/g, ' ') || 'Proctoring Flag',
              description: getViolationDescription(ev.eventType),
              url: ev.screenshot,
              timestamp: ev.timestamp
            });
          }
        });
      }

      const violationPhotos = photos.filter(p => p.type === 'PROCTORING_VIOLATION');

      return {
        ...c,
        allPhotos: photos,
        violationPhotos,
        hasViolations: violationPhotos.length > 0
      };
    });
  }, [normalizedResults]);

  // Candidate photos for the currently opened modal
  const candidatePhotos = useMemo(() => {
    if (!selectedCandidate) return [];
    const list: any[] = [];
    if (selectedCandidate.photo) {
      list.push({
        id: `reg-${selectedCandidate.candidateId}`,
        candidateId: selectedCandidate.candidateId,
        candidateName: selectedCandidate.name,
        type: 'REGISTRATION',
        eventType: 'ID_VERIFICATION',
        title: 'Identity Verification Snapshot',
        description: 'Verified webcam photo captured during test registration.',
        url: selectedCandidate.photo,
        timestamp: selectedCandidate.startedAt || null
      });
    }
    if (Array.isArray(selectedCandidate.integrityEvents)) {
      selectedCandidate.integrityEvents.forEach((ev: any, idx: number) => {
        if (ev.screenshot) {
          list.push({
            id: ev.id || `ev-${idx}`,
            candidateId: selectedCandidate.candidateId,
            candidateName: selectedCandidate.name,
            type: 'PROCTORING_VIOLATION',
            eventType: ev.eventType,
            title: ev.eventType?.replace(/_/g, ' ') || 'Violation Snapshot',
            description: getViolationDescription(ev.eventType),
            url: ev.screenshot,
            timestamp: ev.timestamp
          });
        }
      });
    }
    return list;
  }, [selectedCandidate]);

  const handleStatusChange = async (resultId: string, newStatus: string) => {
    try {
      await api.put(`/assessments/${id}/results/${resultId}/status`, { status: newStatus });
      setRawResults(prev => prev.map(r => (r.id === resultId || r.candidateId === resultId) ? { ...r, status: newStatus } : r));
      if (selectedCandidate && (selectedCandidate.id === resultId || selectedCandidate.candidateId === resultId)) {
        setSelectedCandidate((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleScoreUpdate = async (answerId: string, isCoding: boolean, score: number) => {
    try {
      const res = await api.put(`/assessments/${id}/results/${selectedCandidate.id}/answers/${answerId}/score`, { score, isCoding });
      
      const updatedCandidate = { ...selectedCandidate };
      if (isCoding) {
        updatedCandidate.codingSubmissions = updatedCandidate.codingSubmissions.map((ca: any) => ca.id === answerId ? { ...ca, score } : ca);
      } else {
        updatedCandidate.standardAnswers = updatedCandidate.standardAnswers.map((ans: any) => ans.id === answerId ? { ...ans, score, isCorrect: score > 0 } : ans);
      }
      
      if (res.data?.updatedResult) {
        updatedCandidate.score = res.data.updatedResult.totalScore;
        updatedCandidate.percentage = Math.round(res.data.updatedResult.percentage * 10) / 10;
      } else {
        const newMcq = updatedCandidate.standardAnswers.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
        const newCoding = updatedCandidate.codingSubmissions.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
        updatedCandidate.mcqScore = newMcq;
        updatedCandidate.codingScore = newCoding;
        updatedCandidate.score = newMcq + newCoding;
        updatedCandidate.percentage = updatedCandidate.maxScore > 0 ? Math.round((updatedCandidate.score / updatedCandidate.maxScore) * 1000) / 10 : 0;
      }
      
      setSelectedCandidate(updatedCandidate);
      
      setRawResults(prev => prev.map(r => (r.id === selectedCandidate.id || r.candidateId === selectedCandidate.candidateId) ? { 
        ...r, 
        score: updatedCandidate.score, 
        percentage: updatedCandidate.percentage,
        standardAnswers: updatedCandidate.standardAnswers,
        codingSubmissions: updatedCandidate.codingSubmissions
      } : r));
    } catch (err) {
      alert("Failed to update score");
    }
  };

  const handleAutoGradeAllCoding = async () => {
    if (!window.confirm("Run test cases and allot marks for all candidates' coding submissions? This will compute scores proportionally based on passed test cases.")) {
      return;
    }
    setIsAutoGradingAll(true);
    setAutoGradeMessage("Evaluating candidate coding submissions against test cases... Please wait.");
    try {
      const res = await api.post(`/assessments/${id}/evaluate-coding`);
      setAutoGradeMessage(res.data?.message || "Successfully evaluated all coding submissions!");
      await fetchResults();
      setTimeout(() => setAutoGradeMessage(null), 6000);
    } catch (err: any) {
      console.error("Auto grade failed:", err);
      alert("Failed to auto-evaluate coding submissions: " + (err?.response?.data?.error || err.message));
      setAutoGradeMessage(null);
    } finally {
      setIsAutoGradingAll(false);
    }
  };

  const handleEvaluateSingleCoding = async (submissionId: string) => {
    setEvaluatingSubmissionId(submissionId);
    try {
      const res = await api.post(`/assessments/${id}/results/coding/${submissionId}/evaluate`);
      const { allottedScore, passedCount, totalCount, maxMarks, results, totalTimeMs, updatedTotalScore } = res.data;
      
      setSingleTestResults(prev => ({
        ...prev,
        [submissionId]: { results, passedCount, totalCount, allottedScore, maxMarks, totalTimeMs }
      }));

      // Default active tab to test case 1
      setActiveTestCaseTabs(prev => ({ ...prev, [submissionId]: 0 }));

      if (selectedCandidate) {
        const updatedCandidate = { ...selectedCandidate };
        updatedCandidate.codingSubmissions = (updatedCandidate.codingSubmissions || []).map((cs: any) => 
          cs.id === submissionId ? { ...cs, score: allottedScore, testResults: results } : cs
        );
        const newCoding = updatedCandidate.codingSubmissions.reduce((sum: number, c: any) => sum + (Number(c.score) || 0), 0);
        updatedCandidate.codingScore = newCoding;
        if (updatedTotalScore !== undefined) {
          updatedCandidate.score = updatedTotalScore;
        } else {
          updatedCandidate.score = (updatedCandidate.mcqScore || 0) + newCoding;
        }
        if (updatedCandidate.maxScore > 0) {
          updatedCandidate.percentage = Math.round((updatedCandidate.score / updatedCandidate.maxScore) * 1000) / 10;
        }
        setSelectedCandidate(updatedCandidate);

        setRawResults(prev => prev.map(r => 
          (r.id === selectedCandidate.id || r.candidateId === selectedCandidate.candidateId) 
            ? { 
                ...r, 
                score: updatedCandidate.score, 
                percentage: updatedCandidate.percentage,
                codingScore: updatedCandidate.codingScore,
                codingSubmissions: updatedCandidate.codingSubmissions 
              } 
            : r
        ));
      }
    } catch (err: any) {
      alert("Failed to evaluate submission: " + (err?.response?.data?.error || err.message));
    } finally {
      setEvaluatingSubmissionId(null);
    }
  };

  const handleRunCustomInput = async (submissionId: string, language: string, code: string) => {
    const customStdin = customInputMap[submissionId] || '';
    setIsRunningCustomInput(true);
    try {
      const res = await api.post(`/assessments/${id}/results/coding/${submissionId}/evaluate`, {
        code,
        language,
        customStdin
      });
      setCustomExecutionResults(prev => ({
        ...prev,
        [submissionId]: res.data.result
      }));
    } catch (err: any) {
      alert("Execution error: " + (err?.response?.data?.error || err.message));
    } finally {
      setIsRunningCustomInput(false);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const toggleAnswerExpand = (ansId: string) => {
    setExpandedAnswers(prev => ({ ...prev, [ansId]: !prev[ansId] }));
  };

  const openLightbox = (photos: any[], index: number) => {
    setLightboxPhotoList(photos);
    setLightboxPhotoIndex(index);
  };

  const handleExportCsv = () => {
    if (normalizedResults.length === 0) return;
    const headers = [
      'Candidate Name',
      'Email',
      'Phone',
      'College',
      'CGPA',
      'Branch',
      'Total Score',
      'Max Score',
      'Percentage',
      'MCQ Score',
      'Coding Score',
      'Status',
      'Integrity Flags',
      'Resume / File Name',
      'Submitted At'
    ];
    
    const rows = normalizedResults.map(r => [
      `"${(r.name || '').replace(/"/g, '""')}"`, 
      `"${(r.email || '').replace(/"/g, '""')}"`, 
      `"${(r.phone || '').replace(/"/g, '""')}"`,
      `"${(r.college || '').replace(/"/g, '""')}"`,
      `"${r.cgpa || ''}"`,
      `"${(r.branch || '').replace(/"/g, '""')}"`,
      r.score ?? 0, 
      r.maxScore ?? 0,
      `${r.percentage ?? 0}%`,
      r.mcqScore ?? 0,
      r.codingScore ?? 0,
      r.status || 'EVALUATED', 
      r.integrityEventsCount ?? 0,
      `"${(r.resumeName || '').replace(/"/g, '""')}"`,
      `"${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `assessment_results_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const filteredResults = normalizedResults.filter(r => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (r.name && r.name.toLowerCase().includes(query)) ||
      (r.email && r.email.toLowerCase().includes(query)) ||
      (r.college && r.college.toLowerCase().includes(query)) ||
      (r.phone && r.phone.toLowerCase().includes(query));

    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Filtered Candidate-Wise Photos
  const filteredCandidatesWithPhotos = useMemo(() => {
    return candidatesWithPhotos.filter(c => {
      const q = photoSearchQuery.toLowerCase();
      const matchesSearch = !q || 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.college && c.college.toLowerCase().includes(q));

      const matchesFilter = 
        candidatePhotoFilter === 'ALL' ||
        (candidatePhotoFilter === 'FLAGGED_ONLY' && c.hasViolations) ||
        (candidatePhotoFilter === 'CLEAN_ONLY' && !c.hasViolations);

      return matchesSearch && matchesFilter;
    });
  }, [candidatesWithPhotos, photoSearchQuery, candidatePhotoFilter]);

  // KPI Calculations
  const totalCandidates = normalizedResults.length;
  const completedCandidates = normalizedResults.filter(r => r.status === 'EVALUATED' || r.status === 'SHORTLISTED').length;
  const avgScore = totalCandidates > 0 
    ? Math.round(normalizedResults.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalCandidates) 
    : 0;
  const topScore = totalCandidates > 0 
    ? Math.max(...normalizedResults.map(r => r.score || 0)) 
    : 0;
  const flaggedCandidates = normalizedResults.filter(r => (r.integrityEventsCount || 0) > 0).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          {!propId && (
            <Link to="/admin/assessments" className="text-gray-500 hover:text-dark flex items-center space-x-1.5 text-sm font-medium mb-2 transition-colors">
              <ArrowLeft size={16} />
              <span>Back to Assessments</span>
            </Link>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-dark">Assessment Results & Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Comprehensive performance analytics, code execution engine, and proctoring photo evidence</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={fetchResults}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 p-2.5 rounded-xl transition-colors shadow-sm"
            title="Refresh results"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
          </button>
          <button 
            onClick={handleAutoGradeAllCoding}
            disabled={isAutoGradingAll || normalizedResults.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center space-x-2 text-sm disabled:opacity-50"
            title="Automatically run test cases and allot marks for all candidates"
          >
            <Zap size={16} className={isAutoGradingAll ? "animate-spin text-amber-300" : "text-amber-300"} />
            <span>{isAutoGradingAll ? "Allotting Marks..." : "Auto-Allot Coding Marks"}</span>
          </button>
          <button 
            onClick={handleExportCsv}
            disabled={normalizedResults.length === 0}
            className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center space-x-2 text-sm disabled:opacity-50"
          >
            <Download size={16} />
            <span>Export Complete CSV</span>
          </button>
        </div>
      </div>

      {/* Auto Grade Notification Banner */}
      {autoGradeMessage && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5 text-sm font-semibold">
            {isAutoGradingAll ? (
              <RefreshCw size={18} className="animate-spin text-purple-600" />
            ) : (
              <CheckCircle size={18} className="text-emerald-600" />
            )}
            <span>{autoGradeMessage}</span>
          </div>
          {!isAutoGradingAll && (
            <button onClick={() => setAutoGradeMessage(null)} className="text-purple-400 hover:text-purple-600 p-1">
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            <User size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Candidates</div>
            <div className="text-xl font-bold text-dark">{totalCandidates}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Evaluated</div>
            <div className="text-xl font-bold text-dark">{completedCandidates}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
            %
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Average Score</div>
            <div className="text-xl font-bold text-dark">{avgScore}%</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            <Award size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Highest Score</div>
            <div className="text-xl font-bold text-dark">{topScore} pts</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3 col-span-2 md:col-span-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${flaggedCandidates > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Integrity Flags</div>
            <div className="text-xl font-bold text-dark">{flaggedCandidates} flagged</div>
          </div>
        </div>
      </div>

      {/* TOP VIEW SWITCHER: Candidate Scores vs Candidate-Wise Integrity Photos */}
      <div className="flex border border-gray-200 mb-6 bg-white rounded-xl p-1.5 shadow-sm gap-2">
        <button
          onClick={() => setActiveViewMode('CANDIDATES')}
          className={`flex-1 py-3 px-5 rounded-lg text-sm font-bold flex items-center justify-center space-x-2.5 transition-all ${
            activeViewMode === 'CANDIDATES'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:text-dark hover:bg-gray-50'
          }`}
        >
          <Award size={18} />
          <span>Candidate Results & Scores</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            activeViewMode === 'CANDIDATES' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
            {normalizedResults.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewMode('ALL_INTEGRITY_PHOTOS')}
          className={`flex-1 py-3 px-5 rounded-lg text-sm font-bold flex items-center justify-center space-x-2.5 transition-all ${
            activeViewMode === 'ALL_INTEGRITY_PHOTOS'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-dark hover:bg-gray-50'
          }`}
        >
          <Camera size={18} />
          <span>Candidate-Wise Integrity Photos</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            activeViewMode === 'ALL_INTEGRITY_PHOTOS' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
          }`}>
            {candidatesWithPhotos.reduce((acc, c) => acc + c.allPhotos.length, 0)} Photos
          </span>
        </button>
      </div>

      {/* VIEW 1: CANDIDATES RESULTS TABLE */}
      {activeViewMode === 'CANDIDATES' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-center bg-gray-50/50">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by candidate name, email, college, phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
              />
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-700 font-medium"
              >
                <option value="ALL">All Statuses ({normalizedResults.length})</option>
                <option value="EVALUATED">Evaluated</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
          
          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="px-5 py-3.5 font-bold">Candidate</th>
                  <th className="px-5 py-3.5 font-bold">College & CGPA</th>
                  <th className="px-5 py-3.5 font-bold">Score Breakdown</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold">Integrity Photos</th>
                  <th className="px-5 py-3.5 font-bold">Resume</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                      <RefreshCw size={24} className="animate-spin mx-auto text-primary mb-2" />
                      <span>Loading candidate results…</span>
                    </td>
                  </tr>
                ) : filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                      <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="font-bold text-gray-700">No matching candidates found</p>
                      <p className="text-xs text-gray-400 mt-1">No candidate records match your filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r: any) => {
                    const firstFile = r.files && r.files.length > 0 ? r.files[0] : null;

                    return (
                      <tr key={r.id || r.candidateId} className="hover:bg-blue-50/30 transition-colors">
                        {/* Candidate Name & Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center space-x-3">
                            {r.photo ? (
                              <img 
                                src={r.photo} 
                                alt={r.name} 
                                className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" 
                                onClick={() => openLightbox([{ url: r.photo, title: 'Identity Photo', candidateName: r.name, description: 'Verified candidate photo' }], 0)}
                                title="Click to enlarge"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                                {r.name?.charAt(0)?.toUpperCase() || 'C'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-dark flex items-center space-x-1.5">
                                <span>{r.name}</span>
                              </div>
                              <div className="text-xs text-gray-500">{r.email}</div>
                              {r.phone && <div className="text-[11px] text-gray-400 mt-0.5 font-mono">📞 {r.phone}</div>}
                            </div>
                          </div>
                        </td>

                        {/* College & CGPA */}
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-800 text-xs line-clamp-2 max-w-[200px]" title={r.college}>
                            {r.college || '—'}
                          </div>
                          {r.cgpa && (
                            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-bold">
                              CGPA: {r.cgpa}
                            </div>
                          )}
                          {r.branch && <div className="text-[11px] text-gray-400 mt-0.5">{r.branch}</div>}
                        </td>

                        {/* Total Score & Breakdown */}
                        <td className="px-5 py-4">
                          <div className="flex items-baseline space-x-1.5">
                            <span className="text-base font-bold text-dark">{r.score}</span>
                            <span className="text-xs text-gray-400 font-medium">/ {r.maxScore}</span>
                            <span className="text-xs font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-full ml-1">
                              {r.percentage}%
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[11px] text-gray-500 mt-1">
                            <span title="Multiple Choice Questions">MCQ: <strong>{r.mcqScore}</strong></span>
                            <span>•</span>
                            <span title="Coding Problems">Code: <strong>{r.codingScore}</strong></span>
                          </div>
                        </td>

                        {/* Evaluation Status Dropdown */}
                        <td className="px-5 py-4">
                          <select
                            value={r.status || 'EVALUATED'}
                            onChange={(e) => handleStatusChange(r.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none transition-all cursor-pointer ${
                              r.status === 'SHORTLISTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              r.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                              r.status === 'ON_HOLD' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-primary border-blue-200'
                            }`}
                          >
                            <option value="EVALUATED">Evaluated</option>
                            <option value="SHORTLISTED">Shortlisted</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>

                        {/* Candidate Integrity Photos Column */}
                        <td className="px-5 py-4">
                          {r.integrityEventsCount > 0 ? (
                            <button
                              onClick={() => { setSelectedCandidate(r); setActiveModalTab('PHOTOS'); }}
                              className="inline-flex items-center space-x-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-200 transition-all shadow-sm"
                              title="Click to view candidate's integrity flag photos"
                            >
                              <Camera size={13} className="text-red-500" />
                              <span>{r.integrityEventsCount} flag photos</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSelectedCandidate(r); setActiveModalTab('PHOTOS'); }}
                              className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-200 transition-all"
                              title="Click to view verified ID photo"
                            >
                              <Check size={13} />
                              <span>Clean (View ID)</span>
                            </button>
                          )}
                        </td>

                        {/* Resume / Document */}
                        <td className="px-5 py-4">
                          {firstFile ? (
                            <a
                              href={`${import.meta.env.VITE_API_URL}/candidates/${r.candidateId}/files/${firstFile.id}`}
                              download={firstFile.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-primary hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors max-w-[140px] truncate"
                              title={`Download ${firstFile.fileName}`}
                            >
                              <Download size={13} />
                              <span className="truncate">{firstFile.fileName}</span>
                            </a>
                          ) : r.resumeName ? (
                            <span className="inline-flex items-center space-x-1 text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded max-w-[140px] truncate" title={r.resumeName}>
                              <FileText size={12} className="text-gray-400" />
                              <span className="truncate">{r.resumeName}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No file</span>
                          )}
                        </td>

                        {/* Action: VIEW DOSSIER (Opens directly with coding answers & run button) */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => { 
                              setSelectedCandidate(r); 
                              setActiveModalTab(r.codingSubmissions?.length > 0 ? 'CODING' : 'ANSWERS'); 
                            }}
                            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center space-x-1.5 hover:shadow"
                            title="Open candidate dossier with coding solutions and evaluation"
                          >
                            <Eye size={14} />
                            <span>View Dossier</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CANDIDATE-WISE INTEGRITY PHOTOS TAB */}
      {activeViewMode === 'ALL_INTEGRITY_PHOTOS' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-dark text-lg flex items-center space-x-2">
                  <Camera className="text-purple-600" size={20} />
                  <span>Candidate-Wise Integrity & Proctoring Photos</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review webcam verification snapshots and violation photos grouped candidate-by-candidate ({filteredCandidatesWithPhotos.length} candidates)
                </p>
              </div>

              {/* Candidate Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search candidate name, email, college..."
                  value={photoSearchQuery}
                  onChange={(e) => setPhotoSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                />
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 text-xs font-bold">
              <span className="text-gray-400 uppercase tracking-wider text-[11px] mr-1 flex items-center">
                <Filter size={13} className="mr-1" /> Filter Candidates:
              </span>
              
              <button 
                onClick={() => setCandidatePhotoFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg border transition-all ${
                  candidatePhotoFilter === 'ALL' 
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                All Candidates ({candidatesWithPhotos.length})
              </button>

              <button 
                onClick={() => setCandidatePhotoFilter('FLAGGED_ONLY')}
                className={`px-3.5 py-1.5 rounded-lg border transition-all ${
                  candidatePhotoFilter === 'FLAGGED_ONLY' 
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Candidates with Violation Photos ({candidatesWithPhotos.filter(c => c.hasViolations).length})
              </button>

              <button 
                onClick={() => setCandidatePhotoFilter('CLEAN_ONLY')}
                className={`px-3.5 py-1.5 rounded-lg border transition-all ${
                  candidatePhotoFilter === 'CLEAN_ONLY' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Clean Records Only ({candidatesWithPhotos.filter(c => !c.hasViolations).length})
              </button>
            </div>
          </div>

          {/* Candidate-Wise Photo Cards Stream */}
          {filteredCandidatesWithPhotos.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <Camera size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700 mb-1">No Candidates Found</h3>
              <p className="text-xs text-gray-400">No candidates match the selected filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredCandidatesWithPhotos.map((candidate: any) => (
                <div 
                  key={candidate.candidateId}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Candidate Summary Header */}
                  <div className="p-4 sm:p-5 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center space-x-3.5">
                      {candidate.photo ? (
                        <img 
                          src={candidate.photo} 
                          alt={candidate.name} 
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform" 
                          onClick={() => openLightbox(candidate.allPhotos, 0)}
                          title="Click to enlarge ID photo"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                          {candidate.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-dark text-base">{candidate.name}</h4>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            candidate.hasViolations ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {candidate.hasViolations ? `${candidate.violationPhotos.length} Violation Snapshots` : 'Clean Session'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>{candidate.email}</span>
                          {candidate.college && <span>• 🏛️ {candidate.college}</span>}
                          <span>• Score: <strong>{candidate.score} / {candidate.maxScore}</strong> ({candidate.percentage}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          setActiveModalTab(candidate.codingSubmissions?.length > 0 ? 'CODING' : 'ANSWERS');
                        }}
                        className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
                      >
                        <Eye size={14} />
                        <span>View Dossier & Code</span>
                      </button>
                    </div>
                  </div>

                  {/* Candidate Photos Stream */}
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* 1. Registration ID Photo */}
                      {candidate.photo ? (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col group">
                          <div 
                            className="relative h-40 bg-gray-900 cursor-pointer overflow-hidden flex items-center justify-center"
                            onClick={() => openLightbox(candidate.allPhotos, 0)}
                          >
                            <img 
                              src={candidate.photo} 
                              alt="Identity Verification"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="bg-white/90 text-dark px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 shadow">
                                <ZoomIn size={13} />
                                <span>Enlarge</span>
                              </span>
                            </div>
                            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white shadow-sm">
                              Verified ID Photo
                            </span>
                          </div>
                          <div className="p-3 text-xs flex-1 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-dark text-xs">Registration Webcam Capture</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">Identity photo verified at exam entry.</div>
                            </div>
                            <div className="mt-2 text-[10px] font-mono text-gray-400">
                              Entry: {candidate.startedAt ? new Date(candidate.startedAt).toLocaleTimeString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                          No registration photo
                        </div>
                      )}

                      {/* 2. Candidate Violation Snapshots */}
                      {candidate.violationPhotos.map((vPhoto: any, vpIdx: number) => {
                        const photoGlobalIndex = candidate.allPhotos.findIndex((p: any) => p.id === vPhoto.id);

                        return (
                          <div 
                            key={vPhoto.id || vpIdx}
                            className="bg-red-50/20 rounded-xl border border-red-200 overflow-hidden shadow-sm flex flex-col group"
                          >
                            <div 
                              className="relative h-40 bg-gray-900 cursor-pointer overflow-hidden flex items-center justify-center"
                              onClick={() => openLightbox(candidate.allPhotos, photoGlobalIndex >= 0 ? photoGlobalIndex : 0)}
                            >
                              <img 
                                src={vPhoto.url} 
                                alt={vPhoto.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/90 text-dark px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 shadow">
                                  <ZoomIn size={13} />
                                  <span>Enlarge</span>
                                </span>
                              </div>
                              <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm ${getViolationBadgeColor(vPhoto.eventType)}`}>
                                {vPhoto.title}
                              </span>
                            </div>
                            <div className="p-3 text-xs flex-1 flex flex-col justify-between">
                              <div>
                                <div className="font-bold text-dark text-xs">{vPhoto.title}</div>
                                <div className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{vPhoto.description}</div>
                              </div>
                              <div className="mt-2 text-[10px] font-mono text-red-600 font-bold flex items-center justify-between">
                                <span>{vPhoto.timestamp ? new Date(vPhoto.timestamp).toLocaleTimeString() : 'Session Capture'}</span>
                                <span className="text-[10px] text-gray-400">Flag #{vpIdx + 1}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* If no violations, show clean indicator card */}
                      {!candidate.hasViolations && (
                        <div className="p-5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex flex-col justify-center items-center text-center col-span-1 sm:col-span-2">
                          <CheckCircle size={32} className="text-emerald-600 mb-1.5" />
                          <div className="font-bold text-emerald-800 text-xs">Clean Proctoring Session</div>
                          <div className="text-[11px] text-emerald-600 mt-0.5">0 integrity violation snapshots recorded during the test.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CANDIDATE FULL REPORT / VIEW DOSSIER MODAL */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
            
            {/* Modal Top Header */}
            <div className="p-5 border-b border-gray-200 flex flex-wrap justify-between items-center bg-gray-50/70 gap-4">
              <div className="flex items-center space-x-3.5">
                {selectedCandidate.photo ? (
                  <img 
                    src={selectedCandidate.photo} 
                    alt={selectedCandidate.name} 
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform" 
                    onClick={() => openLightbox([{ url: selectedCandidate.photo, title: 'Verified ID Snapshot', candidateName: selectedCandidate.name }], 0)}
                    title="Click to zoom identity photo"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {selectedCandidate.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-dark text-lg flex items-center space-x-2">
                    <span>{selectedCandidate.name}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      selectedCandidate.status === 'SHORTLISTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      selectedCandidate.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-blue-50 text-primary border border-blue-200'
                    }`}>
                      {selectedCandidate.status || 'EVALUATED'}
                    </span>
                  </h3>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span>{selectedCandidate.email}</span>
                    {selectedCandidate.phone && <span>• 📞 {selectedCandidate.phone}</span>}
                    {selectedCandidate.college && <span>• 🏛️ {selectedCandidate.college}</span>}
                    <span>• Score: <strong className="text-dark">{selectedCandidate.score} / {selectedCandidate.maxScore}</strong> ({selectedCandidate.percentage}%)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <button 
                  onClick={handleExportPdf}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-bold text-xs flex items-center space-x-1.5"
                >
                  <Printer size={15} />
                  <span>Print Dossier</span>
                </button>
                <button 
                  onClick={() => setSelectedCandidate(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-dark transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="bg-gray-50 px-6 border-b border-gray-200 flex space-x-1 sm:space-x-3 overflow-x-auto text-xs font-bold">
              {/* 1. CODING ANSWERS & RUN EVALUATION TAB */}
              <button 
                onClick={() => setActiveModalTab('CODING')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'CODING' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <Code size={15} />
                <span>Coding Answers & Run ({selectedCandidate.codingSubmissions?.length || 0})</span>
              </button>

              {/* 2. MCQ & STANDARD QUESTIONS TAB */}
              <button 
                onClick={() => setActiveModalTab('ANSWERS')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'ANSWERS' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <FileText size={15} />
                <span>MCQ & Answers ({selectedCandidate.standardAnswers?.length || 0})</span>
              </button>

              {/* 3. DEDICATED SEPARATE INTEGRITY PHOTOS TAB */}
              <button 
                onClick={() => setActiveModalTab('PHOTOS')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'PHOTOS' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <Camera size={15} />
                <span>📷 Integrity Photos ({candidatePhotos.length})</span>
              </button>

              {/* 4. PROCTORING EVENT LOGS */}
              <button 
                onClick={() => setActiveModalTab('LOGS')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'LOGS' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <ShieldAlert size={15} />
                <span>Event Logs ({selectedCandidate.integrityEventsCount || 0})</span>
              </button>

              {/* 5. CANDIDATE PROFILE */}
              <button 
                onClick={() => setActiveModalTab('PROFILE')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'PROFILE' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <User size={15} />
                <span>Candidate Profile & Files</span>
              </button>
            </div>
            
            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">

              {/* TAB: CODING ANSWERS WITH RUN & EVALUATE CONSOLE */}
              {activeModalTab === 'CODING' && (
                <div className="space-y-6">
                  {/* Top Score Banner */}
                  <div className="flex flex-wrap justify-between items-center bg-gradient-to-r from-purple-50 to-indigo-50/50 p-5 rounded-2xl border border-purple-200 gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Code className="text-purple-600" size={20} />
                        <h4 className="font-bold text-dark text-base">Coding Submissions & Remote Test Runner</h4>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        View candidate source code, run test cases remotely, check stdout/stderr, and automatically allot marks.
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Coding Score</div>
                        <div className="text-2xl font-bold text-purple-700">
                          {selectedCandidate.codingScore ?? 0} <span className="text-sm font-normal text-gray-500">/ {selectedCandidate.codingMaxScore ?? 0} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(!selectedCandidate.codingSubmissions || selectedCandidate.codingSubmissions.length === 0) ? (
                    <div className="text-center py-16 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-gray-200">
                      <Code size={40} className="mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-gray-600">No coding solutions submitted</p>
                      <p className="text-xs text-gray-400 mt-1">This candidate did not submit code for programming questions.</p>
                    </div>
                  ) : (
                    selectedCandidate.codingSubmissions.map((cs: any, idx: number) => {
                      const runInfo = singleTestResults[cs.id];
                      const activeTab = activeTestCaseTabs[cs.id] ?? 0;
                      const customRunResult = customExecutionResults[cs.id];

                      return (
                        <div key={cs.id || idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                          {/* Problem Header Bar */}
                          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
                            <div>
                              <div className="flex items-center space-x-2.5">
                                <span className="bg-purple-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-lg shadow-sm">
                                  Problem {idx + 1}
                                </span>
                                <h4 className="font-bold text-dark text-base">{cs.questionTitle || 'Coding Question'}</h4>
                              </div>
                              <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-3">
                                <span>Language: <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase">{cs.language}</span></span>
                                <span>Status: <strong className="text-emerald-700 font-bold">{cs.status}</strong></span>
                                {runInfo?.totalTimeMs !== undefined && (
                                  <span className="text-gray-500 font-mono">⚡ Execution: {runInfo.totalTimeMs}ms</span>
                                )}
                              </div>
                            </div>

                            {/* Actions & PROMINENT RUN BUTTON */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* PROMINENT RUN & EVALUATE BUTTON */}
                              <button 
                                onClick={() => handleEvaluateSingleCoding(cs.id)}
                                disabled={evaluatingSubmissionId === cs.id || !cs.code}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 disabled:opacity-50 hover:shadow-lg"
                                title="Run code on remote compiler and evaluate all test cases"
                              >
                                <Play size={15} className={evaluatingSubmissionId === cs.id ? "animate-spin" : ""} />
                                <span>{evaluatingSubmissionId === cs.id ? "Running Tests..." : "▶ Run & Evaluate Code"}</span>
                              </button>

                              {/* Marks Input */}
                              <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                                <span className="text-xs text-gray-500 font-bold">Marks:</span>
                                <input 
                                  type="number" 
                                  className="w-16 px-2 py-1 text-xs font-bold text-center border border-gray-300 rounded-lg focus:border-primary outline-none"
                                  defaultValue={cs.score ?? 0}
                                  key={`score-${cs.id}-${cs.score}`}
                                  onBlur={(e) => handleScoreUpdate(cs.id, true, Number(e.target.value))}
                                  step="1"
                                  title="Edit score to update candidate's total marks"
                                />
                                <span className="text-xs text-gray-500 font-bold">/ {cs.maxScore}</span>
                              </div>

                              <button 
                                onClick={() => handleCopyCode(cs.code, cs.id)}
                                className="p-2 text-gray-500 hover:text-dark hover:bg-gray-200 rounded-xl transition-colors border border-gray-200 bg-white"
                                title="Copy code to clipboard"
                              >
                                {copiedCodeId === cs.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* Problem Description if provided */}
                          {cs.questionDescription && (
                            <div className="p-4 bg-gray-50/60 border-b border-gray-100 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                              <div className="font-bold text-gray-500 mb-1 text-[10px] uppercase tracking-wider">Problem Statement:</div>
                              {cs.questionDescription}
                            </div>
                          )}

                          {/* IDE Code Viewer */}
                          <div className="bg-[#0f172a] text-gray-200 font-mono text-xs overflow-hidden border-b border-gray-800">
                            <div className="bg-[#1e293b] px-4 py-2 flex items-center justify-between border-b border-gray-800 text-[11px] text-gray-400">
                              <div className="flex items-center space-x-2">
                                <Terminal size={14} className="text-purple-400" />
                                <span>solution.{cs.language?.toLowerCase() === 'python' ? 'py' : cs.language?.toLowerCase() === 'java' ? 'java' : 'js'}</span>
                              </div>
                              <span>{cs.code ? `${cs.code.split('\n').length} lines` : '0 lines'}</span>
                            </div>

                            <div className="p-4 overflow-x-auto max-h-[380px] leading-relaxed">
                              <pre className="whitespace-pre-wrap font-mono">{cs.code || '// No code submitted by candidate'}</pre>
                            </div>
                          </div>

                          {/* Interactive Test Cases & Runner Drawer */}
                          <div className="p-5 bg-gray-50/70">
                            {/* Summary Banner if executed */}
                            {runInfo && (
                              <div className="mb-4 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 shadow-sm bg-white border-purple-200">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                    runInfo.passedCount === runInfo.totalCount 
                                      ? 'bg-emerald-50 text-emerald-600' 
                                      : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {runInfo.passedCount === runInfo.totalCount ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                  </div>
                                  <div>
                                    <div className="font-bold text-dark text-xs">
                                      Evaluation: {runInfo.passedCount} of {runInfo.totalCount} Test Cases Passed
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                      Allotted Marks: <strong>{runInfo.allottedScore} / {runInfo.maxMarks} marks</strong> ({Math.round((runInfo.allottedScore / runInfo.maxMarks) * 100)}%)
                                    </div>
                                  </div>
                                </div>
                                
                                {runInfo.totalTimeMs !== undefined && (
                                  <span className="text-xs text-gray-400 font-mono">
                                    Total Execution: {runInfo.totalTimeMs}ms
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Test Cases Tab Switcher */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {(cs.testCases || []).map((tc: any, tcIdx: number) => {
                                const tr = runInfo?.results?.[tcIdx];
                                const isPassed = tr?.passed;

                                return (
                                  <button
                                    key={tcIdx}
                                    onClick={() => setActiveTestCaseTabs(prev => ({ ...prev, [cs.id]: tcIdx }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                                      activeTab === tcIdx
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                  >
                                    <span>Case {tcIdx + 1}</span>
                                    {tr !== undefined && (
                                      <span className={`w-2 h-2 rounded-full ${isPassed ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    )}
                                  </button>
                                );
                              })}

                              {/* Custom Input Tab */}
                              <button
                                onClick={() => setActiveTestCaseTabs(prev => ({ ...prev, [cs.id]: 'CUSTOM' }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                                  activeTab === 'CUSTOM'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                                }`}
                              >
                                <Sliders size={13} />
                                <span>+ Custom Input</span>
                              </button>
                            </div>

                            {/* Active Standard Test Case Content */}
                            {typeof activeTab === 'number' && cs.testCases?.[activeTab] && (() => {
                              const tc = cs.testCases[activeTab];
                              const tr = runInfo?.results?.[activeTab];
                              const isRun = !!tr;

                              return (
                                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
                                  {/* Status Banner */}
                                  <div className="flex items-center justify-between border-b pb-2.5">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-sm text-dark">Test Case {activeTab + 1}</span>
                                      {tc.isHidden && <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold">Hidden Test</span>}
                                    </div>
                                    {isRun ? (
                                      <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ${
                                        tr.passed 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                          : 'bg-red-50 text-red-700 border border-red-200'
                                      }`}>
                                        {tr.passed ? <CheckCircle size={14} className="mr-1.5" /> : <XCircle size={14} className="mr-1.5" />}
                                        {tr.passed ? 'Passed (Outputs Match)' : 'Failed (Wrong Output)'}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400 italic">Click "▶ Run & Evaluate Code" to execute</span>
                                    )}
                                  </div>

                                  {/* Inputs & Outputs Comparison */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Standard Input:</div>
                                      <pre className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg font-mono text-[11px] text-gray-800 whitespace-pre-wrap min-h-[48px]">
                                        {tc.input || '(no stdin)'}
                                      </pre>
                                    </div>

                                    <div>
                                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Expected Output:</div>
                                      <pre className="bg-emerald-50/50 border border-emerald-200 p-2.5 rounded-lg font-mono text-[11px] text-emerald-900 whitespace-pre-wrap min-h-[48px]">
                                        {tc.expectedOutput || '(no output)'}
                                      </pre>
                                    </div>
                                  </div>

                                  {/* Actual Output from Candidate Program */}
                                  {isRun && (
                                    <div className="pt-2">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${tr.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                          Candidate Output:
                                        </div>
                                        {tr.executionTimeMs !== undefined && (
                                          <span className="text-[10px] font-mono text-gray-400">⏱️ {tr.executionTimeMs}ms</span>
                                        )}
                                      </div>
                                      <pre className={`p-3 rounded-lg font-mono text-xs whitespace-pre-wrap border ${
                                        tr.passed 
                                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                                          : 'bg-red-50 text-red-900 border-red-200'
                                      }`}>
                                        {tr.actualOutput || '(no output returned)'}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Active Custom Input Console */}
                            {activeTab === 'CUSTOM' && (
                              <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-4 shadow-sm">
                                <div className="flex justify-between items-center border-b pb-2.5">
                                  <div>
                                    <h5 className="font-bold text-dark text-sm">Custom Stdin Test Runner</h5>
                                    <p className="text-xs text-gray-500">Provide any custom stdin and test candidate's code on remote compiler.</p>
                                  </div>
                                  <button
                                    onClick={() => handleRunCustomInput(cs.id, cs.language, cs.code)}
                                    disabled={isRunningCustomInput || !cs.code}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                                  >
                                    <Play size={13} className={isRunningCustomInput ? "animate-spin" : ""} />
                                    <span>{isRunningCustomInput ? "Executing..." : "Run Custom Input"}</span>
                                  </button>
                                </div>

                                <div>
                                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Custom Stdin Input:</div>
                                  <textarea
                                    rows={3}
                                    value={customInputMap[cs.id] || ''}
                                    onChange={(e) => setCustomInputMap(prev => ({ ...prev, [cs.id]: e.target.value }))}
                                    placeholder="Enter custom input lines here..."
                                    className="w-full p-2.5 font-mono text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  />
                                </div>

                                {customRunResult && (
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="text-[10px] font-bold text-dark uppercase tracking-wider">Program Output:</div>
                                      <span className="text-[10px] font-mono text-gray-400">⏱️ {customRunResult.executionTimeMs}ms</span>
                                    </div>
                                    <pre className="bg-[#1e293b] text-gray-100 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                                      {customRunResult.output || '(no output)'}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB: MCQ & WRITTEN ANSWERS */}
              {activeModalTab === 'ANSWERS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                    <div>
                      <h4 className="font-bold text-dark text-sm">MCQ & Standard Questions Score</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Evaluation of multiple-choice, numerical, and written questions</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">{selectedCandidate.mcqScore ?? 0}</span>
                      <span className="text-xs text-gray-500"> / {selectedCandidate.mcqMaxScore ?? 0} pts</span>
                    </div>
                  </div>

                  {(!selectedCandidate.standardAnswers || selectedCandidate.standardAnswers.length === 0) ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No standard answers recorded for this candidate.</div>
                  ) : (
                    selectedCandidate.standardAnswers.map((ans: any, idx: number) => {
                      const isExpanded = !!expandedAnswers[ans.id];
                      const isCorrect = ans.isCorrect !== undefined ? ans.isCorrect : (Number(ans.score) > 0);

                      return (
                        <div key={ans.id || idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded">Q{idx + 1}</span>
                                <span className="text-[11px] font-bold text-gray-400 uppercase">{ans.type?.replace('_', ' ')}</span>
                                {isCorrect ? (
                                  <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                    <CheckCircle size={13} className="mr-1" /> Correct (+{ans.score} pts)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                                    <XCircle size={13} className="mr-1" /> Incorrect (0 pts)
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-dark text-sm leading-snug">{ans.questionText}</h4>
                            </div>

                            {/* Score Adjuster */}
                            <div className="flex items-center space-x-1.5 shrink-0 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                              <span className="text-xs text-gray-400 font-bold">Score:</span>
                              <input 
                                type="number" 
                                className="w-14 px-1.5 py-0.5 text-xs font-bold text-center border border-gray-300 rounded focus:border-primary outline-none"
                                defaultValue={ans.score ?? 0}
                                onBlur={(e) => handleScoreUpdate(ans.id, false, Number(e.target.value))}
                                step="0.5"
                                title="Click and edit score to manually re-grade"
                              />
                              <span className="text-xs text-gray-400 font-bold">/ {ans.maxScore}</span>
                            </div>
                          </div>

                          {/* Response & Correct Answer Comparison */}
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-200/60">
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs">
                              <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Candidate Selected:</div>
                              <div className={`font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                {ans.response || <span className="italic text-gray-400">(No response given)</span>}
                              </div>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs">
                              <div className="font-bold text-emerald-600 uppercase tracking-wider text-[10px] mb-1">Correct Answer:</div>
                              <div className="font-semibold text-emerald-800">
                                {ans.correctAnswer || (isCorrect ? ans.response : 'Evaluated manually / subjective')}
                              </div>
                            </div>
                          </div>

                          {/* View All Options Toggle */}
                          {ans.options && ans.options.length > 0 && (
                            <div className="mt-2">
                              <button 
                                onClick={() => toggleAnswerExpand(ans.id)} 
                                className="text-[11px] font-bold text-primary hover:underline flex items-center space-x-1"
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                <span>{isExpanded ? 'Hide Options' : 'Show All Question Options'}</span>
                              </button>
                              
                              {isExpanded && (
                                <div className="mt-2 space-y-1 bg-white p-3 rounded-lg border border-gray-200 text-xs">
                                  {ans.options.map((opt: any, optIdx: number) => (
                                    <div 
                                      key={opt.id || optIdx}
                                      className={`p-2 rounded flex items-center justify-between ${
                                        opt.isCorrect 
                                          ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200' 
                                          : opt.isSelected 
                                            ? 'bg-red-50 text-red-800 border border-red-200' 
                                            : 'text-gray-600'
                                      }`}
                                    >
                                      <span>{opt.text}</span>
                                      <div className="text-[10px] font-bold">
                                        {opt.isCorrect && <span className="text-emerald-600 mr-2">✓ Correct</span>}
                                        {opt.isSelected && <span className="text-blue-600">• Candidate Pick</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB: CANDIDATE-WISE INTEGRITY PHOTOS TAB */}
              {activeModalTab === 'PHOTOS' && (
                <div className="space-y-6">
                  {/* Top Stats Banner */}
                  <div className="flex flex-wrap justify-between items-center bg-purple-50 p-5 rounded-2xl border border-purple-200 gap-4">
                    <div>
                      <h4 className="font-bold text-dark text-base flex items-center space-x-2">
                        <Camera className="text-purple-600" size={20} />
                        <span>Candidate Integrity Flags & Webcam Photos</span>
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Examine all identity verification captures and violation screenshots recorded for {selectedCandidate.name}.
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="bg-purple-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm">
                        {candidatePhotos.length} Photos Captured
                      </span>
                    </div>
                  </div>

                  {candidatePhotos.length === 0 ? (
                    <div className="text-center py-16 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                      <CheckCircle size={48} className="mx-auto text-emerald-600 mb-3" />
                      <h3 className="text-lg font-bold text-emerald-800 mb-1">Clean Record</h3>
                      <p className="text-gray-600 text-sm">No webcam or proctoring snapshots were captured for this candidate.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                      {candidatePhotos.map((photo: any, pIdx: number) => (
                        <div 
                          key={photo.id || pIdx}
                          className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                        >
                          {/* Photo Container */}
                          <div 
                            className="relative h-48 bg-gray-900 cursor-pointer overflow-hidden flex items-center justify-center"
                            onClick={() => openLightbox(candidatePhotos, pIdx)}
                          >
                            <img 
                              src={photo.url} 
                              alt={photo.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white/90 text-dark px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-lg">
                                <ZoomIn size={14} />
                                <span>Zoom Photo</span>
                              </div>
                            </div>

                            <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2.5 py-0.5 rounded-md border shadow-sm ${getViolationBadgeColor(photo.eventType)}`}>
                              {photo.title}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-bold text-dark">{photo.title}</div>
                              <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                {photo.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-400 font-mono">
                              <span>{photo.timestamp ? new Date(photo.timestamp).toLocaleString() : 'Captured on Entry'}</span>
                              <button
                                onClick={() => openLightbox(candidatePhotos, pIdx)}
                                className="text-primary font-bold hover:underline"
                              >
                                Enlarge
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PROCTORING AUDIT LOGS */}
              {activeModalTab === 'LOGS' && (
                <div className="space-y-4">
                  {selectedCandidate.integrityEvents?.length > 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-red-700">
                          <ShieldAlert size={24} />
                          <div>
                            <div className="font-bold text-sm">Integrity Violations Detected</div>
                            <div className="text-xs text-red-600">{selectedCandidate.integrityEvents.length} flags were recorded during the active session.</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedCandidate.integrityEvents.map((event: any, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                            <div>
                              <div className="flex items-center space-x-2 text-red-600 mb-1">
                                <ShieldAlert size={16} />
                                <h4 className="font-bold uppercase tracking-wider text-xs">{event.eventType}</h4>
                              </div>
                              <div className="text-xs text-gray-700 font-medium">
                                {getViolationDescription(event.eventType)}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-1 font-mono">
                                Timestamp: {new Date(event.timestamp).toLocaleString()}
                              </div>
                            </div>

                            {event.screenshot && (
                              <button
                                onClick={() => openLightbox([{ url: event.screenshot, title: event.eventType, candidateName: selectedCandidate.name, description: getViolationDescription(event.eventType) }], 0)}
                                className="shrink-0 text-xs font-bold text-primary hover:underline bg-blue-50 px-3 py-1.5 rounded-lg flex items-center space-x-1"
                              >
                                <Camera size={13} />
                                <span>View Snapshot</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                      <CheckCircle size={48} className="mx-auto text-emerald-600 mb-3" />
                      <h3 className="text-lg font-bold text-emerald-800 mb-1">Clean Proctoring Record</h3>
                      <p className="text-gray-600 text-sm">No integrity or proctoring flags were recorded during this test session.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: CANDIDATE PROFILE & FILES */}
              {activeModalTab === 'PROFILE' && (
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50">
                    <h3 className="text-base font-bold text-dark mb-4 border-b pb-2">Full Registration Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Candidate Name</div>
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.name}</div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</div>
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.email}</div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</div>
                        <div className="font-semibold text-dark text-base mt-0.5 font-mono">{selectedCandidate.phone || '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">College / University</div>
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.college || '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Branch / Specialization</div>
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.branch || '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">CGPA / Percentage</div>
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.cgpa || '—'}</div>
                      </div>

                      {selectedCandidate.customFieldsWithLabels && Object.entries(selectedCandidate.customFieldsWithLabels).map(([key, item]: any) => {
                        if (['phone', 'college', 'branch', 'cgpa'].includes(key)) return null;
                        return (
                          <div key={key}>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.label}</div>
                            <div className="font-semibold text-dark text-base mt-0.5">{String(item.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uploaded Files / Resumes */}
                  <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50">
                    <h3 className="text-base font-bold text-dark mb-4 border-b pb-2">Uploaded Attachments & Resume</h3>
                    {selectedCandidate.files && selectedCandidate.files.length > 0 ? (
                      <div className="space-y-3">
                        {selectedCandidate.files.map((file: any) => (
                          <div key={file.id} className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FileText size={20} />
                              </div>
                              <div>
                                <div className="font-bold text-dark text-sm">{file.fileName}</div>
                                <div className="text-xs text-gray-400">Field: {file.fieldName} • Uploaded on Registration</div>
                              </div>
                            </div>
                            <a
                              href={`${import.meta.env.VITE_API_URL}/candidates/${selectedCandidate.candidateId}/files/${file.id}`}
                              download={file.fileName}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1.5 shadow-sm"
                            >
                              <Download size={14} />
                              <span>Download File</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : selectedCandidate.resumeName ? (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-dark text-sm">{selectedCandidate.resumeName}</div>
                            <div className="text-xs text-gray-400">Registered Resume</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                          Attached on registration
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic py-4">No files or resume attached for this candidate.</div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxPhotoIndex !== null && lightboxPhotoList[lightboxPhotoIndex] && (() => {
        const activePhoto = lightboxPhotoList[lightboxPhotoIndex];

        return (
          <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 md:p-6 animate-fade-in"
            onClick={() => setLightboxPhotoIndex(null)}
          >
            {/* Top Bar */}
            <div className="flex justify-between items-center text-white z-10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getViolationBadgeColor(activePhoto.eventType)}`}>
                  {activePhoto.title}
                </span>
                <span className="text-sm text-gray-300">
                  Photo {lightboxPhotoIndex + 1} of {lightboxPhotoList.length}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <a 
                  href={activePhoto.url} 
                  download={`integrity_snapshot_${activePhoto.candidateName || 'candidate'}_${activePhoto.eventType}.png`}
                  className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
                  onClick={e => e.stopPropagation()}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button 
                  onClick={() => setLightboxPhotoIndex(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Center Image with Navigation Buttons */}
            <div className="flex-1 flex items-center justify-center relative my-4" onClick={e => e.stopPropagation()}>
              {lightboxPhotoList.length > 1 && (
                <button 
                  onClick={() => setLightboxPhotoIndex(prev => prev !== null && prev > 0 ? prev - 1 : lightboxPhotoList.length - 1)}
                  className="absolute left-2 md:left-6 z-10 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full border border-white/20 transition-all shadow-xl hover:scale-105"
                  title="Previous Photo (Left Arrow)"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <div className="max-w-4xl max-h-[70vh] flex flex-col items-center">
                <img 
                  src={activePhoto.url} 
                  alt={activePhoto.title} 
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl border border-white/10"
                />
              </div>

              {lightboxPhotoList.length > 1 && (
                <button 
                  onClick={() => setLightboxPhotoIndex(prev => prev !== null && prev < lightboxPhotoList.length - 1 ? prev + 1 : 0)}
                  className="absolute right-2 md:right-6 z-10 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full border border-white/20 transition-all shadow-xl hover:scale-105"
                  title="Next Photo (Right Arrow)"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Bottom Caption Bar */}
            <div className="bg-black/60 border border-white/10 p-4 rounded-xl max-w-2xl mx-auto w-full text-white text-xs z-10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-bold text-sm text-white">{activePhoto.candidateName || 'Candidate'}</div>
                  {activePhoto.candidateEmail && <div className="text-gray-400 text-[11px]">{activePhoto.candidateEmail}</div>}
                  <div className="text-gray-300 mt-1">{activePhoto.description}</div>
                </div>
                {activePhoto.timestamp && (
                  <div className="text-right text-gray-400 shrink-0 font-mono text-[11px]">
                    <Clock size={12} className="inline mr-1" />
                    {new Date(activePhoto.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ResultsView;
