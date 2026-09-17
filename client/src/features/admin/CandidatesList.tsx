import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Edit, Upload, X, CheckCircle, AlertTriangle, Loader2, Download } from 'lucide-react';
import api from '../../lib/axios';

const CandidatesList = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  
  // Single Invite State
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAssessmentId, setInviteAssessmentId] = useState('');
  
  // CSV Upload State
  const [file, setFile] = useState<File | null>(null);
  const [csvAssessmentId, setCsvAssessmentId] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candRes, assmRes] = await Promise.all([
        api.get('/candidates'),
        api.get('/assessments')
      ]);
      setCandidates(candRes.data);
      setAssessments(assmRes.data);
      if (assmRes.data.length > 0) {
        setInviteAssessmentId(assmRes.data[0].id);
        setCsvAssessmentId(assmRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail || !inviteAssessmentId) return;
    setUploading(true);
    try {
      await api.post('/candidates/invite', {
        name: inviteName,
        email: inviteEmail,
        assessmentId: inviteAssessmentId
      });
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to send invitation.');
    } finally {
      setUploading(false);
    }
  };

  const handleResetTest = async (candidateId: string, assessmentId: string) => {
    if (!confirm("Are you sure you want to reset this test? This will permanently delete the candidate's answers, results, and session for this assessment.")) return;
    
    try {
      await api.delete(`/candidates/${assessmentId}/reset/${candidateId}`);
      alert('Test reset successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to reset test.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete candidate "${name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/candidates/${id}`);
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert("Failed to delete candidate.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setValidationResult(null);
    }
  };

  const handleValidateCsv = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/candidates/csv/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setValidationResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to validate CSV file. Check formatting.");
    } finally {
      setUploading(false);
    }
  };

  const handleImportCsv = async () => {
    if (!validationResult?.validRows || !csvAssessmentId) return;
    setUploading(true);
    try {
      await api.post('/candidates/csv/import', {
        assessmentId: csvAssessmentId,
        candidates: validationResult.validRows
      });
      setShowCsvModal(false);
      setFile(null);
      setValidationResult(null);
      fetchData(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to import CSV.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="page-subtitle">Manage and invite candidates to assessments</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-outline flex items-center space-x-2"
          >
            <Upload size={16} />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Invite Candidate</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Candidates', value: candidates.length, color: 'from-indigo-500 to-violet-600', icon: '👤' },
          { label: 'Completed', value: candidates.filter((c: any) => c.results?.length > 0).length, color: 'from-emerald-500 to-teal-600', icon: '✅' },
          { label: 'Invited / Pending', value: candidates.filter((c: any) => !c.results?.length).length, color: 'from-amber-500 to-orange-500', icon: '📨' },
        ].map(s => (
          <div key={s.label} className="card p-5 flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-dark">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search by name or email…" className="form-input pl-9" />
          </div>
        </div>

        <table className="w-full data-table text-left">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Assessment</th>
              <th>Status</th>
              <th>Attachments</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-16 text-center">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-slate-400 text-sm">Loading candidates…</span>
                </div>
              </td></tr>
            ) : candidates.length === 0 ? (
              <tr><td colSpan={4} className="py-16 text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-slate-500 font-medium">No candidates yet</p>
                <p className="text-slate-400 text-sm mt-1">Invite a candidate or import via CSV.</p>
              </td></tr>
            ) : candidates.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center space-x-3">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        {c.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-dark">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="text-slate-500 text-sm">{c.assessment?.title || '—'}</td>
                <td>
                  <span className={c.results?.length > 0 ? 'badge-success' : 'badge-info'}>
                    {c.results?.length > 0 ? 'Completed' : 'Invited'}
                  </span>
                </td>
                <td>
                  {c.files && c.files.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {c.files.map((file: any) => (
                        <a 
                          key={file.id} 
                          href={`${import.meta.env.VITE_API_URL}/candidates/${c.id}/files/${file.id}`}
                          download={file.fileName}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs flex items-center space-x-1 text-primary hover:underline"
                        >
                          <Download size={14} />
                          <span className="truncate max-w-[120px]" title={file.fileName}>{file.fieldName}</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {(c.results?.length > 0 || c.sessions?.length > 0) && (
                      <button
                        onClick={() => handleResetTest(c.id, c.assessmentId)}
                        className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Reset Test
                      </button>
                    )}
                    <button onClick={() => handleDelete(c.id, c.name)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Candidate Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-100 animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-dark">Invite Candidate</h2>
                <p className="text-sm text-slate-500 mt-0.5">Send an assessment invitation by email</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Select Assessment</label>
                <select value={inviteAssessmentId} onChange={(e) => setInviteAssessmentId(e.target.value)} className="form-input">
                  {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="form-input" placeholder="e.g. Jane Smith" />
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="form-input" placeholder="e.g. jane@example.com" />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => setShowInviteModal(false)}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleInvite}
                disabled={uploading || !inviteName || !inviteEmail || !inviteAssessmentId}
                className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                <span>Send Invitation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h2 className="text-xl font-bold text-dark">Bulk Import Candidates</h2>
              <button onClick={() => { setShowCsvModal(false); setFile(null); setValidationResult(null); }} className="text-gray-500 hover:text-dark">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {!validationResult ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Target Assessment</label>
                    <select 
                      value={csvAssessmentId}
                      onChange={(e) => setCsvAssessmentId(e.target.value)}
                      className="w-full md:w-1/2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {assessments.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-2">CSV Format Requirements</h3>
                    <p className="text-sm text-blue-700 mb-3">Your CSV file must include exactly these two headers in the first row.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap bg-white rounded border border-blue-200">
                        <thead className="bg-blue-100 text-blue-800">
                          <tr>
                            <th className="px-3 py-2">name</th>
                            <th className="px-3 py-2">email</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-600">
                          <tr className="border-t border-blue-100">
                            <td className="px-3 py-2">Alice Johnson</td>
                            <td className="px-3 py-2">alice@example.com</td>
                          </tr>
                          <tr className="border-t border-blue-100">
                            <td className="px-3 py-2">Bob Smith</td>
                            <td className="px-3 py-2">bob@example.com</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input 
                      type="file" 
                      accept=".csv"
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <p className="text-dark font-medium mb-1">
                      {file ? file.name : 'Select a CSV file'}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5MB'}
                    </p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-primary transition-colors bg-white"
                    >
                      Browse Files
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-4">
                      <CheckCircle className="text-green-500" size={32} />
                      <div>
                        <p className="text-sm text-green-800 font-semibold">Valid Candidates</p>
                        <p className="text-2xl font-bold text-green-900">{validationResult.validCount}</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-4">
                      <AlertTriangle className="text-red-500" size={32} />
                      <div>
                        <p className="text-sm text-red-800 font-semibold">Errors Found</p>
                        <p className="text-2xl font-bold text-red-900">{validationResult.invalidCount}</p>
                      </div>
                    </div>
                  </div>

                  {validationResult.invalidCount > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark mb-3">Validation Errors</h4>
                      <div className="bg-red-50 rounded-lg border border-red-100 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-red-100 text-red-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2">Row</th>
                              <th className="px-4 py-2">Field</th>
                              <th className="px-4 py-2">Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {validationResult.invalidRows.map((err: any, i: number) => (
                              <tr key={i}>
                                <td className="px-4 py-2 font-medium text-red-900">Row {err.row}</td>
                                <td className="px-4 py-2 text-red-800">{err.field}</td>
                                <td className="px-4 py-2 text-red-700">{err.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => { setShowCsvModal(false); setFile(null); setValidationResult(null); }}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              
              {!validationResult ? (
                <button 
                  onClick={handleValidateCsv}
                  disabled={!file || !csvAssessmentId || uploading}
                  className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                  <span>Validate File</span>
                </button>
              ) : (
                <button 
                  onClick={handleImportCsv}
                  disabled={validationResult.validCount === 0 || uploading}
                  className="bg-success text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                  <span>Import {validationResult.validCount} Candidates</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatesList;
