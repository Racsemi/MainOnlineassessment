import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, CheckCircle2, Clock, 
  Video, Mic, MicOff, VideoOff, ArrowRight, RotateCcw, 
  Award, Sparkles, Copy, Check, Search, GripVertical
} from 'lucide-react';

export interface CandidateItem {
  socketId: string;
  candidateId: string;
  name: string;
  email: string;
  college?: string;
  branch?: string;
  joinedAt: number;
  deviceStatus: {
    audio: boolean;
    video: boolean;
  };
  status: 'waiting' | 'in_interview' | 'completed' | 'disconnected';
}

interface LiveQueueBoardProps {
  sessionId: string;
  queue: CandidateItem[];
  activeCandidate: CandidateItem | null;
  onAdmitCandidate: (candidateSocketId: string) => void;
  onReturnToQueue: (candidateSocketId: string) => void;
  onFinishInterview: (candidateSocketId: string) => void;
  evaluations?: Record<string, any>;
}

export const LiveQueueBoard: React.FC<LiveQueueBoardProps> = ({
  sessionId,
  queue,
  activeCandidate,
  onAdmitCandidate,
  onReturnToQueue,
  onFinishInterview,
  evaluations = {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragOverHotSeat, setIsDragOverHotSeat] = useState(false);
  const [draggedCandidateSocketId, setDraggedCandidateSocketId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Ticker for wait time
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitTime = (joinedAt: number) => {
    const elapsedSec = Math.max(0, Math.floor((now - joinedAt) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/interview/lobby/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, socketId: string) => {
    setDraggedCandidateSocketId(socketId);
    e.dataTransfer.setData('text/plain', socketId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverHotSeat(true);
  };

  const handleDragLeave = () => {
    setIsDragOverHotSeat(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverHotSeat(false);
    const socketId = e.dataTransfer.getData('text/plain') || draggedCandidateSocketId;
    if (socketId) {
      onAdmitCandidate(socketId);
    }
    setDraggedCandidateSocketId(null);
  };

  const waitingCandidates = queue.filter(
    (c) => c.status === 'waiting' && (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const completedCandidates = queue.filter((c) => c.status === 'completed');

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate in queue..."
              className="bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary w-52 sm:w-64 transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-primary-light border border-blue-500/20">
              {waitingCandidates.length} Waiting
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeCandidate ? '1 In Room' : '0 In Room'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-white/5">
              {completedCandidates.length} Completed
            </span>
          </div>
        </div>

        <button
          onClick={copyInvite}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl transition-all"
        >
          {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
          <span>{copiedLink ? 'Invite Link Copied!' : 'Copy Candidate Invite Link'}</span>
        </button>
      </div>

      {/* 3-Column Drag and Drop Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Column 1: Waiting Candidates (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center space-x-2">
              <Users size={17} className="text-primary" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Waiting Lobby ({waitingCandidates.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">
              Drag card or click "Admit"
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1">
            {waitingCandidates.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                <Users size={28} className="stroke-1 mb-2 opacity-50" />
                <p className="font-semibold text-slate-400">No candidates waiting</p>
                <p className="text-[11px] mt-1 max-w-[200px]">
                  Share the invite link with candidates to let them queue up.
                </p>
              </div>
            ) : (
              waitingCandidates.map((candidate, idx) => (
                <div
                  key={candidate.socketId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, candidate.socketId)}
                  className="bg-slate-950/90 hover:bg-slate-900 border border-white/10 hover:border-primary/40 rounded-xl p-3.5 transition-all shadow-md cursor-grab active:cursor-grabbing group relative"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1 text-slate-500 group-hover:text-primary transition-colors">
                        <GripVertical size={16} />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-white line-clamp-1">{candidate.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5">
                            #{idx + 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{candidate.email}</p>
                        {candidate.college && (
                          <p className="text-[10px] text-slate-500 mt-0.5">{candidate.college}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onAdmitCandidate(candidate.socketId)}
                      className="flex items-center space-x-1 bg-primary/20 hover:bg-primary border border-primary/30 text-primary-light hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                    >
                      <span>Admit</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock size={12} className="text-slate-500" />
                      <span>Waited: {formatWaitTime(candidate.joinedAt)}</span>
                    </span>

                    <div className="flex items-center space-x-2">
                      <span className="flex items-center space-x-0.5 text-emerald-400" title="Camera Ready">
                        {candidate.deviceStatus?.video ? <Video size={12} /> : <VideoOff size={12} className="text-red-400" />}
                      </span>
                      <span className="flex items-center space-x-0.5 text-emerald-400" title="Mic Ready">
                        {candidate.deviceStatus?.audio ? <Mic size={12} /> : <MicOff size={12} className="text-red-400" />}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Hot Seat - In Interview (4 cols) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`lg:col-span-4 rounded-2xl p-4 flex flex-col transition-all border ${
            isDragOverHotSeat
              ? 'bg-blue-950/40 border-primary shadow-xl shadow-primary/20 scale-[1.01]'
              : 'bg-slate-900/60 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles size={17} className="text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Hot Seat (Active)
              </h3>
            </div>
            <span className="text-[10px] text-amber-400/90 font-medium">
              Drop candidate here
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {activeCandidate ? (
              <div className="bg-gradient-to-b from-blue-950/40 to-slate-950 border-2 border-primary/60 rounded-xl p-5 shadow-2xl space-y-4 animate-fade-in">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary text-primary-light flex items-center justify-center font-bold text-base uppercase">
                    {activeCandidate.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-white">{activeCandidate.name}</h4>
                      <span className="bg-emerald-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                        LIVE
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{activeCandidate.email}</p>
                    {activeCandidate.college && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{activeCandidate.college}</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-white/5 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Interview Duration:</span>
                    <span className="font-mono text-white font-bold">{formatWaitTime(activeCandidate.joinedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Devices:</span>
                    <span className="text-emerald-400 font-medium flex items-center space-x-1">
                      <CheckCircle2 size={13} />
                      <span>Cam & Audio Connected</span>
                    </span>
                  </div>
                </div>

                {/* Hot seat controls */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => onFinishInterview(activeCandidate.socketId)}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2 px-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <Award size={15} />
                    <span>Complete & Score Interview</span>
                  </button>

                  <button
                    onClick={() => onReturnToQueue(activeCandidate.socketId)}
                    className="w-full flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white py-1.5 px-3 rounded-xl text-xs transition-all border border-white/5"
                  >
                    <RotateCcw size={13} />
                    <span>Move Back to Waiting Queue</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-56 border-2 border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                  <UserCheck size={24} />
                </div>
                <p className="text-xs font-semibold text-slate-300">Hot Seat is Empty</p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  Drag a candidate here from the waiting queue, or click their "Admit" button.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Completed Interviews (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center space-x-2">
              <Award size={17} className="text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Finished ({completedCandidates.length})
              </h3>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
            {completedCandidates.length === 0 ? (
              <div className="h-36 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-3 text-slate-500 text-xs">
                <p>No completed interviews yet.</p>
              </div>
            ) : (
              completedCandidates.map((c) => {
                const evalData = evaluations[c.candidateId];
                return (
                  <div
                    key={c.socketId}
                    className="bg-slate-950/80 border border-white/5 rounded-xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{c.name}</span>
                      {evalData?.recommendation && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          evalData.recommendation === 'STRONG_HIRE' || evalData.recommendation === 'HIRE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {evalData.recommendation.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{c.email}</p>
                    {evalData?.ratings && (
                      <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-white/5">
                        <span>Code: {evalData.ratings.codeQuality}/5</span>
                        <span>Problem: {evalData.ratings.problemSolving}/5</span>
                        <span>Comm: {evalData.ratings.communication}/5</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LiveQueueBoard;
