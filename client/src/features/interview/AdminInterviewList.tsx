import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Plus, Copy, Check, ExternalLink, Calendar, 
  Users, Play, Sparkles, BookOpen, Layers, ShieldCheck, 
  Settings, MessageSquare, MonitorUp
} from 'lucide-react';
import api from '../../lib/axios';

interface AssessmentOption {
  id: string;
  title: string;
}

export const AdminInterviewList: React.FC = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stored recent interview sessions in localStorage for persistence
  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string;
    assessmentTitle?: string;
    createdAt: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('racsemi_interviews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    api.get('/assessments')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAssessments(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const saveSessions = (updated: any[]) => {
    setSessions(updated);
    localStorage.setItem('racsemi_interviews', JSON.stringify(updated));
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const selectedAss = assessments.find((a) => a.id === selectedAssessmentId);
    
    const newSession = {
      id: selectedAssessmentId || sessionId,
      title: sessionTitle.trim() || (selectedAss ? `Live Interview: ${selectedAss.title}` : `Interview Session #${sessionId.slice(0, 6)}`),
      assessmentTitle: selectedAss?.title,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    const updated = [newSession, ...sessions.filter((s) => s.id !== newSession.id)];
    saveSessions(updated);
    setShowCreateModal(false);
    setSessionTitle('');
    setSelectedAssessmentId('');

    navigate(`/admin/interview/${newSession.id}`);
  };

  const copyInviteLink = (id: string) => {
    const link = `${window.location.origin}/interview/lobby/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
              <Video size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Live Video Interviews</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Host Zoom/Teams-style video conferences with full admin controls, optional live coding, and candidate queue management.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all transform active:scale-95 text-sm"
        >
          <Plus size={18} />
          <span>New Interview Session</span>
        </button>
      </div>

      {/* Feature Highlights Banner - Clean Crisp Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <Video size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Zoom/Teams Conference Mode</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Starts in full HD video conference mode. Coding is 100% optional and only appears if the interviewer decides to enable it.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <ShieldCheck size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Complete Host Admin Controls</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Full host authority: enable/disable screen sharing, in-meeting chat, candidate camera/mic permissions, and room lock.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Drag & Drop Waiting Lobby</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Candidates queue in the lobby. Drag or click "Admit" to pull them one-by-one into the hot seat without disconnecting others.
          </p>
        </div>
      </div>

      {/* Sessions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Layers size={18} className="text-primary" />
            <span>Active Interview Rooms ({sessions.length})</span>
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Video size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No active interview rooms yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Create your first interview room to generate candidate invitation links and conduct technical or non-technical interviews live.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-primary/20 transition-all"
            >
              <Plus size={16} />
              <span>Create Interview Room</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 hover:border-primary/50 rounded-2xl p-5 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md">
                      ID: {s.id.slice(0, 10)}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center space-x-1">
                      <Calendar size={13} />
                      <span>{s.createdAt}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                      {s.title}
                    </h3>
                    {s.assessmentTitle && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
                        <BookOpen size={13} className="text-slate-400" />
                        <span>Linked Assessment: {s.assessmentTitle}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/admin/interview/${s.id}`)}
                    className="flex-1 flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-3 rounded-xl text-xs shadow-sm transition-all"
                  >
                    <Play size={14} className="fill-current" />
                    <span>Join Room</span>
                  </button>

                  <button
                    onClick={() => copyInviteLink(s.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      copiedId === s.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                    title="Copy candidate invite link"
                  >
                    {copiedId === s.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedId === s.id ? 'Copied!' : 'Link'}</span>
                  </button>

                  <a
                    href={`/interview/lobby/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all"
                    title="Open Candidate Lobby"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 border border-slate-100">
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Video size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Create Interview Session</h3>
              <p className="text-xs text-slate-500 mt-1">
                You can link an assessment to automatically load questions, or create a standalone conference room.
              </p>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Session Title</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Technical Round 1 - Backend Engineering"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Assessment (Optional)</label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all"
                >
                  <option value="">-- Standalone Interview Room (No Assessment) --</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Linking loads the assessment's coding problems directly into your optional question pusher.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary/20 transition-all"
                >
                  Create & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInterviewList;
