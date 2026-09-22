import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Plus, Copy, Check, ExternalLink, Calendar, 
  Users, Play, Sparkles, BookOpen, Layers
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

    // Directly navigate into the newly created room
    navigate(`/admin/interview/${newSession.id}`);
  };

  const copyInviteLink = (id: string) => {
    const link = `${window.location.origin}/interview/lobby/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-primary border border-blue-500/20">
              <Video size={24} />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Live Technical Interviews</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Conduct 1-on-1 coding interviews with real-time video, collaborative Monaco editor, and live candidate queue.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 text-sm"
        >
          <Plus size={18} />
          <span>New Interview Session</span>
        </button>
      </div>

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Drag & Drop Queue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All candidates wait in a live lobby. Drag or click "Admit" to pull them one-by-one into the hot seat.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Live Collaborative Code</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-language Monaco editor with zero syncing lag, live execution, and instant question pusher.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Video size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Direct WebRTC Streaming</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Encrypted Peer-to-Peer video & audio with screen sharing. Zero media bandwidth strain on Render.
            </p>
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <Layers size={18} className="text-primary" />
          <span>Active Interview Rooms ({sessions.length})</span>
        </h2>

        {sessions.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-white/15 rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-primary flex items-center justify-center mx-auto">
              <Video size={30} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No active interview rooms yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first interview room to generate candidate invitation links and start evaluating candidates live.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-xl text-xs shadow-md transition-all"
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
                className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 hover:border-primary/50 transition-all flex flex-col justify-between group shadow-lg shadow-black/20"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-mono text-primary-light bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md font-semibold">
                      ID: {s.id.slice(0, 12)}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center space-x-1">
                      <Calendar size={13} />
                      <span>{s.createdAt}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                      {s.title}
                    </h3>
                    {s.assessmentTitle && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-1">
                        <BookOpen size={12} className="text-slate-500" />
                        <span>Assessment: {s.assessmentTitle}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-white/5 flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/admin/interview/${s.id}`)}
                    className="flex-1 flex items-center justify-center space-x-1.5 bg-primary/20 hover:bg-primary border border-primary/30 hover:border-primary text-primary-light hover:text-white font-semibold py-2 px-3 rounded-xl text-xs transition-all"
                  >
                    <Play size={14} className="fill-current" />
                    <span>Open Room</span>
                  </button>

                  <button
                    onClick={() => copyInviteLink(s.id)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      copiedId === s.id
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                    title="Copy candidate invite link"
                  >
                    {copiedId === s.id ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedId === s.id ? 'Copied!' : 'Link'}</span>
                  </button>

                  <a
                    href={`/interview/lobby/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    title="Preview candidate lobby"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white">Create Interview Session</h3>
              <p className="text-xs text-slate-400 mt-1">
                Link this session to an assessment to automatically load coding questions into your question bank.
              </p>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Session Title (Optional)</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer - Round 1"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Link to Assessment (Optional)</label>
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">-- Standalone Interview Room --</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Linking loads the assessment's coding problems directly into your in-interview question pusher.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-md transition-all"
                >
                  Create & Launch Room
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
