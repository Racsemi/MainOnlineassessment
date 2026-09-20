import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Search, Filter, ShieldAlert, X, Eye, Printer, ArrowLeft, Download, 
  AlertTriangle, Check, FileText, Code, CheckCircle, XCircle, Award, 
  User, Clock, Phone, GraduationCap, Building, ExternalLink, RefreshCw,
  ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import api from '../../lib/axios';

interface ResultsViewProps {
  assessmentId?: string;
}

const ResultsView: React.FC<ResultsViewProps> = ({ assessmentId: propId }) => {
  const { id: paramId } = useParams();
  const id = propId || paramId;

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [activeModalTab, setActiveModalTab] = useState<'ANSWERS' | 'CODING' | 'INTEGRITY' | 'PROFILE'>('ANSWERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  const fetchResults = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/assessments/${id}/results`);
      setResults(res.data);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [id]);

  const handleStatusChange = async (resultId: string, newStatus: string) => {
    try {
      await api.put(`/assessments/${id}/results/${resultId}/status`, { status: newStatus });
      setResults(prev => prev.map(r => (r.id === resultId || r.candidateId === resultId) ? { ...r, status: newStatus } : r));
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
        updatedCandidate.standardAnswers = updatedCandidate.standardAnswers.map((ans: any) => ans.id === answerId ? { ...ans, score } : ans);
      }
      
      if (res.data?.updatedResult) {
        updatedCandidate.score = res.data.updatedResult.totalScore;
        updatedCandidate.percentage = Math.round(res.data.updatedResult.percentage * 10) / 10;
      }
      
      setSelectedCandidate(updatedCandidate);
      
      setResults(prev => prev.map(r => (r.id === selectedCandidate.id || r.candidateId === selectedCandidate.candidateId) ? { 
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

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const toggleAnswerExpand = (ansId: string) => {
    setExpandedAnswers(prev => ({ ...prev, [ansId]: !prev[ansId] }));
  };

  const handleExportCsv = () => {
    if (results.length === 0) return;
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
    
    const rows = results.map(r => {
      const resumeFile = r.files?.[0]?.fileName || r.customFields?.field_3 || '';
      return [
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
        `"${resumeFile.replace(/"/g, '""')}"`,
        `"${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}"`
      ];
    });

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

  const filteredResults = results.filter(r => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (r.name && r.name.toLowerCase().includes(query)) || 
      (r.email && r.email.toLowerCase().includes(query)) ||
      (r.college && r.college.toLowerCase().includes(query)) ||
      (r.phone && r.phone.toLowerCase().includes(query));
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level KPIs
  const totalCandidates = results.length;
  const completedCandidates = results.filter(r => r.status === 'EVALUATED' || r.status === 'SHORTLISTED').length;
  const avgScore = totalCandidates > 0 
    ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalCandidates) 
    : 0;
  const topScore = totalCandidates > 0 
    ? Math.max(...results.map(r => r.score || 0)) 
    : 0;
  const flaggedCandidates = results.filter(r => r.integrityEventsCount > 0).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
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
          <p className="text-gray-500 text-sm mt-0.5">Comprehensive performance, answer evaluation, coding solutions, and proctoring reports</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchResults}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 p-2.5 rounded-xl transition-colors shadow-sm"
            title="Refresh results"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
          </button>
          <button 
            onClick={handleExportCsv}
            disabled={results.length === 0}
            className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center space-x-2 text-sm disabled:opacity-50"
          >
            <Download size={16} />
            <span>Export Complete CSV</span>
          </button>
        </div>
      </div>

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

      {/* Main Table Container */}
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
              <option value="ALL">All Statuses ({results.length})</option>
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
                <th className="px-5 py-3.5 font-bold">Integrity</th>
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
                  const hasResume = r.files && r.files.length > 0;
                  const firstFile = hasResume ? r.files[0] : null;

                  return (
                    <tr key={r.id || r.candidateId} className="hover:bg-blue-50/30 transition-colors">
                      {/* Candidate Name & Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          {r.photo ? (
                            <img src={r.photo} alt={r.name} className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm flex-shrink-0" />
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
                            {r.phone && <div className="text-[11px] text-gray-400 mt-0.5">📞 {r.phone}</div>}
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
                          <span className="font-bold text-dark text-base">{r.score}</span>
                          <span className="text-xs text-gray-400">/ {r.maxScore || 100}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-1 ${
                            r.percentage >= 70 ? 'bg-emerald-100 text-emerald-800' :
                            r.percentage >= 40 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {r.percentage}%
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center space-x-2">
                          <span>MCQ: <strong>{r.mcqScore ?? '—'}</strong></span>
                          <span>•</span>
                          <span className="text-purple-700 font-semibold">
                            Code: <strong>{r.codingScore ?? 0}</strong> ({r.codingSubmissions?.length || 0} submitted)
                          </span>
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="px-5 py-4">
                        <select
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-md border outline-none cursor-pointer transition-colors ${
                            r.status === 'SHORTLISTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                            r.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-300' :
                            r.status === 'ON_HOLD' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                            'bg-blue-50 text-blue-700 border-blue-300'
                          }`}
                        >
                          <option value="EVALUATED">EVALUATED</option>
                          <option value="SHORTLISTED">SHORTLISTED</option>
                          <option value="ON_HOLD">ON HOLD</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </td>

                      {/* Integrity */}
                      <td className="px-5 py-4">
                        {r.integrityEventsCount > 0 ? (
                          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                            <ShieldAlert size={14} className="mr-1" />
                            <span>{r.integrityEventsCount} flags</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-emerald-600 text-xs font-bold">
                            <Check size={14} className="mr-1" /> Clean
                          </span>
                        )}
                      </td>

                      {/* Resume / Files */}
                      <td className="px-5 py-4">
                        {firstFile ? (
                          <a
                            href={`${import.meta.env.VITE_API_URL}/candidates/${r.candidateId}/files/${firstFile.id}`}
                            download={firstFile.fileName}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 text-xs font-bold text-primary hover:text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors max-w-[140px] truncate"
                            title={`Download ${firstFile.fileName}`}
                          >
                            <Download size={13} />
                            <span className="truncate">{firstFile.fileName}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No file</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedCandidate(r);
                            setActiveModalTab('ANSWERS');
                          }}
                          className="text-xs font-bold text-white bg-dark hover:bg-black px-3.5 py-2 rounded-lg transition-colors inline-flex items-center space-x-1.5 shadow-sm"
                        >
                          <Eye size={14} />
                          <span>View Report</span>
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

      {/* CANDIDATE COMPLETE DETAILS MODAL */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div id="printable-modal" className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap justify-between items-center z-10 gap-3">
              <div className="flex items-center space-x-4">
                {selectedCandidate.photo ? (
                  <img src={selectedCandidate.photo} alt={selectedCandidate.name} className="w-12 h-12 rounded-xl object-cover border border-gray-300 shadow-sm" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
                    {selectedCandidate.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-dark">{selectedCandidate.name}</h2>
                    <span className="bg-primary/10 text-primary font-bold text-xs px-2.5 py-0.5 rounded-full">
                      Score: {selectedCandidate.score} / {selectedCandidate.maxScore || 100} ({selectedCandidate.percentage}%)
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-3 mt-0.5">
                    <span>{selectedCandidate.email}</span>
                    {selectedCandidate.phone && <span>• 📞 {selectedCandidate.phone}</span>}
                    {selectedCandidate.college && <span>• 🎓 {selectedCandidate.college}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <select 
                  value={selectedCandidate.status}
                  onChange={(e) => handleStatusChange(selectedCandidate.id, e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-dark outline-none cursor-pointer"
                >
                  <option value="EVALUATED">EVALUATED</option>
                  <option value="SHORTLISTED">SHORTLISTED</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
                <button 
                  onClick={handleExportPdf}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-bold text-xs flex items-center space-x-1.5"
                  title="Print candidate dossier"
                >
                  <Printer size={15} />
                  <span>Print Report</span>
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
            <div className="bg-gray-50 px-6 border-b border-gray-200 flex space-x-1 sm:space-x-4 overflow-x-auto text-xs font-bold">
              <button 
                onClick={() => setActiveModalTab('ANSWERS')}
                className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'ANSWERS' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <FileText size={15} />
                <span>MCQ & Answers ({selectedCandidate.standardAnswers?.length || 0})</span>
              </button>
              <button 
                onClick={() => setActiveModalTab('CODING')}
                className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'CODING' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <Code size={15} />
                <span>Coding Submissions ({selectedCandidate.codingSubmissions?.length || 0})</span>
              </button>
              <button 
                onClick={() => setActiveModalTab('PROFILE')}
                className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'PROFILE' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <User size={15} />
                <span>Candidate Profile & Files</span>
              </button>
              <button 
                onClick={() => setActiveModalTab('INTEGRITY')}
                className={`py-3 px-3 border-b-2 flex items-center space-x-2 transition-colors ${activeModalTab === 'INTEGRITY' ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                <ShieldAlert size={15} />
                <span>Proctoring & Integrity ({selectedCandidate.integrityEventsCount || 0})</span>
              </button>
            </div>
            
            {/* Modal Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">

              {/* TAB 1: STANDARD ASSESSMENT ANSWERS */}
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
                      return (
                        <div key={ans.id || idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded">Q{idx + 1}</span>
                                <span className="text-[11px] font-bold text-gray-400 uppercase">{ans.type?.replace('_', ' ')}</span>
                                {ans.isCorrect ? (
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
                              <div className={`font-semibold ${ans.isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                {ans.response || <span className="italic text-gray-400">(No response given)</span>}
                              </div>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs">
                              <div className="font-bold text-emerald-600 uppercase tracking-wider text-[10px] mb-1">Correct Answer:</div>
                              <div className="font-semibold text-emerald-800">
                                {ans.correctAnswer || 'Evaluated manually / subjective'}
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

              {/* TAB 2: CODING SUBMISSIONS */}
              {activeModalTab === 'CODING' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-purple-50/60 p-4 rounded-xl border border-purple-200">
                    <div>
                      <h4 className="font-bold text-dark text-sm">Coding Evaluation</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Code submissions, chosen language, execution status and test cases</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-purple-700">{selectedCandidate.codingScore ?? 0}</span>
                      <span className="text-xs text-gray-500"> / {selectedCandidate.codingMaxScore ?? 0} pts</span>
                    </div>
                  </div>

                  {(!selectedCandidate.codingSubmissions || selectedCandidate.codingSubmissions.length === 0) ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No coding problems submitted by this candidate.</div>
                  ) : (
                    selectedCandidate.codingSubmissions.map((cs: any, idx: number) => (
                      <div key={cs.id || idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded">Problem {idx + 1}</span>
                              <h4 className="font-bold text-dark text-base">{cs.questionTitle || 'Coding Question'}</h4>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center space-x-3">
                              <span>Language: <span className="font-mono font-bold text-purple-700 uppercase">{cs.language}</span></span>
                              <span>•</span>
                              <span>Status: <strong className="text-emerald-700">{cs.status}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                              <span className="text-xs text-gray-500 font-bold">Grade:</span>
                              <input 
                                type="number" 
                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-gray-300 rounded focus:border-primary outline-none"
                                defaultValue={cs.score ?? 0}
                                onBlur={(e) => handleScoreUpdate(cs.id, true, Number(e.target.value))}
                                step="1"
                                title="Edit score to update candidate's total marks"
                              />
                              <span className="text-xs text-gray-500 font-bold">/ {cs.maxScore}</span>
                            </div>
                            <button 
                              onClick={() => handleCopyCode(cs.code, cs.id)}
                              className="p-2 text-gray-500 hover:text-dark hover:bg-gray-200 rounded-lg transition-colors"
                              title="Copy code to clipboard"
                            >
                              {copiedCodeId === cs.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Problem Description if available */}
                        {cs.questionDescription && (
                          <div className="p-4 bg-gray-50/50 border-b border-gray-100 text-xs text-gray-600 whitespace-pre-wrap">
                            <div className="font-bold text-dark mb-1 text-[11px] uppercase tracking-wider">Problem Statement:</div>
                            {cs.questionDescription}
                          </div>
                        )}

                        {/* Submitted Code Console */}
                        <div className="bg-[#1e1e1e] p-4 font-mono text-sm overflow-x-auto text-gray-200 max-h-[400px]">
                          <pre className="whitespace-pre-wrap leading-relaxed">{cs.code || '// No code submitted by candidate'}</pre>
                        </div>

                        {/* Test Cases Info if configured */}
                        {cs.testCases && cs.testCases.length > 0 && (
                          <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Test Cases Configuration ({cs.testCases.length}):</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {cs.testCases.map((tc: any, tcIdx: number) => (
                                <div key={tcIdx} className="bg-white p-2.5 rounded border border-gray-200">
                                  <div className="font-bold text-gray-600 mb-1 flex justify-between">
                                    <span>Case {tcIdx + 1} {tc.isHidden && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded font-normal">Hidden</span>}</span>
                                  </div>
                                  <div className="font-mono text-[11px] space-y-1">
                                    <div><span className="text-gray-400">In:</span> {tc.input || '(empty)'}</div>
                                    <div><span className="text-emerald-600">Expected:</span> {tc.expectedOutput}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: CANDIDATE PROFILE & FILES */}
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
                        <div className="font-semibold text-dark text-base mt-0.5">{selectedCandidate.phone || '—'}</div>
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

                      {/* Display custom registration fields with their proper human-readable labels */}
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
                    ) : (
                      <div className="text-sm text-gray-500 italic py-4">No files or resume attached for this candidate.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: INTEGRITY & PROCTORING REPORT */}
              {activeModalTab === 'INTEGRITY' && (
                <div className="space-y-6">
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

                      <div className="space-y-4">
                        {selectedCandidate.integrityEvents.map((event: any, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-6 shadow-sm">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 text-danger mb-1.5">
                                <ShieldAlert size={18} />
                                <h4 className="font-bold uppercase tracking-wider text-sm">{event.eventType}</h4>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">
                                <strong>Timestamp:</strong> {new Date(event.timestamp).toLocaleString()}
                              </p>
                              <p className="text-sm text-red-800 bg-red-50/70 p-3 rounded-lg border border-red-100">
                                {event.eventType === 'FULLSCREEN_EXIT' && "The candidate exited full-screen mode during the test."}
                                {event.eventType === 'TAB_SWITCH' && "The candidate switched browser tabs or minimized the browser window."}
                                {event.eventType === 'WINDOW_BLUR' && "The assessment browser window lost focus."}
                                {event.eventType === 'COPY' && "The candidate attempted to copy text from the assessment."}
                                {event.eventType === 'PASTE' && "The candidate attempted to paste external content into the test."}
                              </p>
                            </div>
                            
                            {/* Webcam Proctoring Snapshot */}
                            <div className="w-full md:w-56 shrink-0 bg-black rounded-xl border border-gray-300 overflow-hidden relative group">
                              {event.screenshot ? (
                                <>
                                  <img src={event.screenshot} alt="Proctoring Snapshot" className="w-full h-36 object-cover" />
                                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-1">
                                    Camera Snapshot
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-36 flex items-center justify-center text-gray-500 bg-gray-900 text-xs">
                                  No Camera Feed
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                      <CheckCircle size={48} className="mx-auto text-emerald-600 mb-3" />
                      <h3 className="text-lg font-bold text-emerald-800 mb-1">Clean Record</h3>
                      <p className="text-gray-600 text-sm">No integrity or proctoring flags were recorded during this test session.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsView;
