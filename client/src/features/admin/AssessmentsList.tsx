import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, Link as LinkIcon, MoreVertical, CheckCircle2, Clock, AlertCircle, Copy, Check, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/axios';

const statusConfig: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: 'Published', cls: 'badge-success' },
  DRAFT:     { label: 'Draft',     cls: 'badge-neutral' },
  ARCHIVED:  { label: 'Archived',  cls: 'badge-warning' },
};

const AssessmentsList = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/assessments');
        setAssessments(res.data);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/register/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/assessments/${id}`);
      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert('Failed to delete assessment');
    }
  };

  const filtered = assessments.filter((a: any) =>
    a.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">Create, manage and monitor your assessments</p>
        </div>
        <Link to="/admin/assessments/new" className="btn-primary flex items-center space-x-2">
          <Plus size={18} />
          <span>New Assessment</span>
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total', value: assessments.length, icon: <MoreVertical size={20} />, color: 'from-indigo-500 to-violet-600' },
          { label: 'Published', value: assessments.filter(a => a.status === 'PUBLISHED').length, icon: <CheckCircle2 size={20} />, color: 'from-emerald-500 to-teal-600' },
          { label: 'Draft', value: assessments.filter(a => a.status === 'DRAFT').length, icon: <Clock size={20} />, color: 'from-amber-500 to-orange-500' },
        ].map(s => (
          <div key={s.label} className="card p-5 flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-dark">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assessments..."
              className="form-input pl-9"
            />
          </div>
        </div>

        <table className="w-full data-table text-left">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Status</th>
              <th>Candidates</th>
              <th>Completed</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-slate-400 text-sm">Loading assessments…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No assessments found</p>
                  <p className="text-slate-400 text-sm mt-1">Click "New Assessment" to create your first one.</p>
                </td>
              </tr>
            ) : filtered.map((a: any) => {
              const sc = statusConfig[a.status] || statusConfig.DRAFT;
              return (
                <tr key={a.id}>
                  <td>
                    <div className="font-semibold text-dark">{a.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.description?.slice(0, 60) || '—'}</div>
                  </td>
                  <td><span className={sc.cls}>{sc.label}</span></td>
                  <td>
                    <div className="flex items-center space-x-1.5 text-slate-600">
                      <Users size={14} className="text-slate-400" />
                      <span>{a.candidates ?? '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center space-x-1.5 text-slate-600">
                      <CheckCircle2 size={14} className="text-slate-400" />
                      <span>{a.completed ?? '—'}</span>
                    </div>
                  </td>
                  <td className="text-slate-500 text-xs">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handleCopy(a.id)}
                        title="Copy public link"
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-indigo-50 transition-colors"
                      >
                        {copied === a.id ? <Check size={16} className="text-success" /> : <LinkIcon size={16} />}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/assessments/${a.id}/results`)}
                        title="View results"
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-indigo-50 transition-colors"
                      >
                        <Users size={16} />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/assessments/${a.id}`)}
                        title="Edit"
                        className="p-2 rounded-lg text-slate-400 hover:text-dark hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id, a.title)}
                        title="Delete"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssessmentsList;
