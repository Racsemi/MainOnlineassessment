import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Video, VideoOff, Mic, MicOff, ScreenShare, PhoneOff, 
  Play, Lock, Unlock, BookOpen, Award, Users, 
  Terminal, CheckCircle2, AlertCircle, Loader2, Sparkles,
  MessageSquare, ShieldCheck, ShieldAlert, Code2, Hand,
  Maximize2, Send, X, MoreVertical, LayoutGrid, User,
  Sliders, Volume2, ThumbsUp, Heart, Check
} from 'lucide-react';
import { getInterviewSocket, closeInterviewSocket } from '../../lib/socket';
import { WebRTCManager } from '../../lib/webrtc';
import QuestionPusherModal from './QuestionPusherModal';
import InterviewScorecardModal from './InterviewScorecardModal';
import LiveQueueBoard, { type CandidateItem } from './LiveQueueBoard';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'CANDIDATE';
  text: string;
  timestamp: number;
}

interface HostPermissions {
  codingEnabled: boolean;
  screenShareAllowed: boolean;
  chatAllowed: boolean;
  candidateAudioAllowed: boolean;
  candidateVideoAllowed: boolean;
}

export const LiveInterviewRoom: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Role
  const roleParam = searchParams.get('role');
  const isAdmin = roleParam !== 'candidate';
  const candidateName = searchParams.get('name') || 'Candidate';
  const candidateEmail = searchParams.get('email') || '';

  // Host Permissions
  const [permissions, setPermissions] = useState<HostPermissions>({
    codingEnabled: false, // Default is pure video conference (Zoom/Teams style)
    screenShareAllowed: true,
    chatAllowed: true,
    candidateAudioAllowed: true,
    candidateVideoAllowed: true,
  });

  // Media states
  const [localAudio, setLocalAudio] = useState(true);
  const [localVideo, setLocalVideo] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [remoteAudioActive, setRemoteAudioActive] = useState(true);
  const [remoteVideoActive, setRemoteVideoActive] = useState(true);

  // Layout View (Gallery vs Speaker Spotlight)
  const [layoutMode, setLayoutMode] = useState<'gallery' | 'speaker'>('gallery');

  // Drawers & Modals
  const [activeSidePanel, setActiveSidePanel] = useState<'chat' | 'queue' | 'security' | null>(null);
  const [showQuestionPusher, setShowQuestionPusher] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Reactions & Hand raise
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; text: string; sender: string }>>([]);

  // Monaco Editor & Problem
  const [code, setCode] = useState<string>(
    `// Live Collaborative Coding Space\n// Language: JavaScript\n\nfunction solution() {\n  console.log("Ready!");\n}\n\nsolution();\n`
  );
  const [language, setLanguage] = useState('javascript');
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<any>(null);

  // Output terminal
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Queue & Active Candidate
  const [queue, setQueue] = useState<CandidateItem[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateItem | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const isUpdatingFromSocketRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize Socket & WebRTC
  useEffect(() => {
    if (!sessionId) return;
    const socket = getInterviewSocket();

    // 1. Join room
    socket.emit('lobby:join', {
      sessionId,
      role: isAdmin ? 'ADMIN' : 'CANDIDATE',
      candidateData: isAdmin ? undefined : {
        name: candidateName,
        email: candidateEmail,
      },
    });

    // 2. Setup WebRTC
    const rtc = new WebRTCManager(
      '',
      (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          setIsPeerConnected(true);
        }
      },
      (signal) => {
        socket.emit('webrtc:signal', {
          sessionId,
          targetSocketId: '',
          signalData: signal,
        });
      }
    );
    rtcManagerRef.current = rtc;

    rtc.getLocalMedia(true, true).then((stream) => {
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });

    // 3. Socket Listeners
    socket.on('session:state', (data: any) => {
      if (data.features) setPermissions(data.features);
      if (data.chatMessages) setChatMessages(data.chatMessages);
      if (data.editorState) {
        setCode(data.editorState.code);
        setLanguage(data.editorState.language || 'javascript');
        setIsEditorLocked(!!data.editorState.isLocked);
      }
      if (data.currentProblem) setCurrentProblem(data.currentProblem);
      if (data.queue) setQueue(data.queue);
      if (data.activeCandidate) setActiveCandidate(data.activeCandidate);
      if (data.evaluations) setEvaluations(data.evaluations);
    });

    socket.on('lobby:queue-update', (data: any) => {
      if (data.queue) setQueue(data.queue);
      if (data.activeCandidate !== undefined) setActiveCandidate(data.activeCandidate);
      if (data.evaluations) setEvaluations(data.evaluations);
    });

    socket.on('interview:admitted', (data: any) => {
      if (data.features) setPermissions(data.features);
      if (data.chatMessages) setChatMessages(data.chatMessages);
      if (data.editorState) {
        setCode(data.editorState.code);
        setLanguage(data.editorState.language || 'javascript');
      }
      if (data.currentProblem) setCurrentProblem(data.currentProblem);
      rtc.initPeerConnection(true);
    });

    socket.on('webrtc:signal', async (data: any) => {
      await rtc.handleSignal(data.signalData);
    });

    // Host permissions update
    socket.on('host:permissions-updated', (data: any) => {
      setPermissions(data.features);
      // If host turned off candidate mic, mute candidate
      if (!isAdmin && data.features.candidateAudioAllowed === false) {
        rtc.toggleAudio(false);
        setLocalAudio(false);
      }
    });

    // Host force mute
    socket.on('host:forced-mute', () => {
      if (!isAdmin) {
        rtc.toggleAudio(false);
        setLocalAudio(false);
        alert('You have been muted by the host.');
      }
    });

    // Chat
    socket.on('chat:new-message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (activeSidePanel !== 'chat') {
        setUnreadChatCount((prev) => prev + 1);
      }
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Reactions
    socket.on('meeting:reaction-received', (data: any) => {
      const id = `${Date.now()}-${Math.random()}`;
      setFloatingReactions((prev) => [...prev, { id, text: data.reaction, sender: data.senderName }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);
    });

    // Code collaboration
    socket.on('code:sync', (data: any) => {
      isUpdatingFromSocketRef.current = true;
      setCode(data.code);
      if (data.language) setLanguage(data.language);
      setTimeout(() => {
        isUpdatingFromSocketRef.current = false;
      }, 50);
    });

    socket.on('code:lock-sync', (data: any) => {
      setIsEditorLocked(data.isLocked);
    });

    socket.on('code:problem-pushed', (data: any) => {
      setCurrentProblem(data.problem);
      if (data.editorState?.code) {
        isUpdatingFromSocketRef.current = true;
        setCode(data.editorState.code);
        setTimeout(() => {
          isUpdatingFromSocketRef.current = false;
        }, 50);
      }
      if (data.editorState?.language) {
        setLanguage(data.editorState.language);
      }
    });

    socket.on('code:run-start', () => {
      setIsRunning(true);
      setOutput('Compiling and executing code...');
    });

    socket.on('code:run-result', (result: any) => {
      setIsRunning(false);
      setOutput(result.output || result.error || 'Program finished with no output.');
      setExecutionTime(result.executionTimeMs || null);
    });

    socket.on('interview:returned-to-lobby', () => {
      navigate(`/interview/lobby/${sessionId}?name=${encodeURIComponent(candidateName)}&email=${encodeURIComponent(candidateEmail)}`);
    });

    socket.on('interview:completed', () => {
      alert('Thank you! Your interview has concluded.');
      navigate(`/`);
    });

    return () => {
      rtc.destroy();
      socket.off('session:state');
      socket.off('lobby:queue-update');
      socket.off('interview:admitted');
      socket.off('webrtc:signal');
      socket.off('host:permissions-updated');
      socket.off('host:forced-mute');
      socket.off('chat:new-message');
      socket.off('meeting:reaction-received');
      socket.off('code:sync');
      socket.off('code:lock-sync');
      socket.off('code:problem-pushed');
      socket.off('code:run-start');
      socket.off('code:run-result');
      socket.off('interview:returned-to-lobby');
      socket.off('interview:completed');
    };
  }, [sessionId, isAdmin, candidateName, candidateEmail, navigate, activeSidePanel]);

  // Host Permission Updaters
  const updateHostPermissions = (updated: Partial<HostPermissions>) => {
    if (!isAdmin) return;
    const socket = getInterviewSocket();
    const nextPerms = { ...permissions, ...updated };
    setPermissions(nextPerms);
    socket.emit('host:update-permissions', {
      sessionId,
      permissions: nextPerms,
    });
  };

  const handleToggleCodingRound = () => {
    updateHostPermissions({ codingEnabled: !permissions.codingEnabled });
  };

  const handleForceMuteCandidate = () => {
    if (!isAdmin || !activeCandidate) return;
    const socket = getInterviewSocket();
    socket.emit('host:force-mute-candidate', {
      sessionId,
      targetSocketId: activeCandidate.socketId,
    });
  };

  // Chat message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;
    if (!isAdmin && !permissions.chatAllowed) {
      alert('Chat is currently disabled by host.');
      return;
    }

    const socket = getInterviewSocket();
    socket.emit('chat:send', {
      sessionId,
      text: newMessageText.trim(),
      senderName: isAdmin ? 'Interviewer (Host)' : candidateName,
    });
    setNewMessageText('');
  };

  // Reaction / Hand raise
  const handleSendReaction = (reaction: string) => {
    const socket = getInterviewSocket();
    socket.emit('meeting:reaction', {
      sessionId,
      reaction,
      senderName: isAdmin ? 'Host' : candidateName,
    });
  };

  const handleToggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    handleSendReaction(nextState ? '✋ Raised Hand' : 'Lowered Hand');
  };

  // Media Controls
  const toggleMic = () => {
    if (!isAdmin && !permissions.candidateAudioAllowed) {
      alert('Your microphone has been disabled by the host.');
      return;
    }
    if (rtcManagerRef.current) {
      rtcManagerRef.current.toggleAudio(!localAudio);
      setLocalAudio(!localAudio);
    }
  };

  const toggleVideo = () => {
    if (!isAdmin && !permissions.candidateVideoAllowed) {
      alert('Your camera has been disabled by the host.');
      return;
    }
    if (rtcManagerRef.current) {
      rtcManagerRef.current.toggleVideo(!localVideo);
      setLocalVideo(!localVideo);
    }
  };

  const toggleScreenShare = async () => {
    if (!isAdmin && !permissions.screenShareAllowed) {
      alert('Screen sharing is currently disabled by the host.');
      return;
    }
    if (!rtcManagerRef.current) return;
    if (!isScreenSharing) {
      const stream = await rtcManagerRef.current.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
    } else {
      rtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
      const camStream = await rtcManagerRef.current.getLocalMedia(localVideo, localAudio);
      if (camStream && localVideoRef.current) localVideoRef.current.srcObject = camStream;
    }
  };

  // Code editor handlers
  const handleEditorChange = (newCode: string | undefined) => {
    if (newCode === undefined || isUpdatingFromSocketRef.current) return;
    setCode(newCode);
    const socket = getInterviewSocket();
    socket.emit('code:change', { sessionId, code: newCode, language });
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const socket = getInterviewSocket();
    socket.emit('code:change', { sessionId, code, language: newLang });
  };

  const handleRunCode = () => {
    const socket = getInterviewSocket();
    socket.emit('code:run', { sessionId, code, language, customInput });
  };

  const toggleEditorLock = () => {
    const socket = getInterviewSocket();
    const nextLocked = !isEditorLocked;
    setIsEditorLocked(nextLocked);
    socket.emit('code:lock', { sessionId, isLocked: nextLocked });
  };

  // Queue Actions
  const handleAdmitCandidate = (candidateSocketId: string) => {
    const socket = getInterviewSocket();
    socket.emit('interview:admit', { sessionId, candidateSocketId });
  };

  const handleReturnToQueue = (candidateSocketId: string) => {
    const socket = getInterviewSocket();
    socket.emit('interview:return-to-queue', { sessionId, candidateSocketId });
  };

  const handleFinishCandidate = (evaluation: any) => {
    const socket = getInterviewSocket();
    socket.emit('interview:finish-candidate', {
      sessionId,
      candidateSocketId: activeCandidate?.socketId,
      evaluation,
    });
    setShowScorecard(false);
  };

  return (
    <div className="h-screen w-screen bg-[#090d16] text-white flex flex-col overflow-hidden font-sans selection:bg-primary selection:text-white">
      
      {/* 1. Top Conference Header */}
      <header className="h-14 border-b border-white/10 bg-[#0d1322] px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <img src="/logo2.png" alt="Racsemi" className="h-7 w-7 object-contain" />
            <h1 className="text-sm font-bold text-white tracking-tight">Racsemi Meeting</h1>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30 font-semibold">
            {isAdmin ? 'HOST / INTERVIEWER' : 'PARTICIPANT'}
          </span>
          {permissions.codingEnabled && (
            <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
              <Code2 size={12} />
              <span>Live Coding Round Active</span>
            </span>
          )}
        </div>

        {/* Center: Active Meeting Status */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 bg-slate-900/90 border border-white/10 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-slate-400">In Call:</span>
            <span className="font-bold text-white">
              {isAdmin ? (activeCandidate ? activeCandidate.name : 'Waiting for Candidate') : 'Connected with Host'}
            </span>
          </div>
        </div>

        {/* Right: Layout & Leave */}
        <div className="flex items-center space-x-2">
          {/* Layout switcher */}
          <button
            onClick={() => setLayoutMode(layoutMode === 'gallery' ? 'speaker' : 'gallery')}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 transition-colors"
            title="Switch Video Layout"
          >
            <LayoutGrid size={14} />
            <span>{layoutMode === 'gallery' ? 'Speaker View' : 'Gallery View'}</span>
          </button>

          {/* End Call / Leave Button */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit the interview call?')) {
                closeInterviewSocket();
                navigate(isAdmin ? '/admin/interviews' : '/');
              }
            }}
            className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-lg shadow-red-600/20"
          >
            <PhoneOff size={14} />
            <span>{isAdmin ? 'End Meeting' : 'Leave'}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Conference Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left / Center Area: Video Stage & Optional Code Editor */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Video Stage: Fullscreen Conference when coding is OFF, or split-screen when coding is ON */}
          <div className={`${permissions.codingEnabled ? 'w-80 lg:w-96 border-r border-white/10' : 'flex-1'} flex flex-col p-4 bg-[#090d16] transition-all duration-300 overflow-y-auto`}>
            
            {/* Conference Video Tiles */}
            <div className={`grid gap-4 h-full ${
              !permissions.codingEnabled && layoutMode === 'gallery'
                ? 'grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto w-full items-center' 
                : 'grid-cols-1 flex-1 content-start'
            }`}>
              
              {/* Remote Peer Video Tile (Candidate for Admin / Interviewer for Candidate) */}
              <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isPeerConnected && (
                  <div className="flex flex-col items-center text-slate-500 text-xs space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center">
                      <User size={24} className="text-slate-600" />
                    </div>
                    <span>{isAdmin ? 'Admit a candidate from queue...' : 'Connecting to Interviewer...'}</span>
                  </div>
                )}

                {/* Name Badge & Mic Indicator */}
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{isAdmin ? (activeCandidate?.name || 'Candidate') : 'Interviewer (Host)'}</span>
                </div>
              </div>

              {/* Local Video Tile (You) */}
              <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isScreenSharing ? '' : 'transform -scale-x-100'}`}
                />
                {!localVideo && (
                  <div className="flex flex-col items-center text-slate-500 text-xs space-y-2">
                    <VideoOff size={28} className="stroke-1" />
                    <span>Camera is off</span>
                  </div>
                )}

                {/* Name Badge */}
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 border border-white/10">
                  {localAudio ? <Mic size={13} className="text-emerald-400" /> : <MicOff size={13} className="text-red-400" />}
                  <span>You ({isAdmin ? 'Interviewer' : candidateName})</span>
                </div>
              </div>

            </div>

            {/* Problem Statement Card (Only shown in video column when coding is active) */}
            {permissions.codingEnabled && currentProblem && (
              <div className="mt-4 bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-2 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Problem Statement</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    {currentProblem.language}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{currentProblem.title}</h4>
                <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {currentProblem.description}
                </div>
              </div>
            )}
          </div>

          {/* Collaborative Monaco Code Editor Stage (ONLY VISIBLE IF CODING IS ENABLED BY HOST) */}
          {permissions.codingEnabled && (
            <div className="flex-1 flex flex-col bg-slate-950 border-l border-white/10 overflow-hidden animate-fade-in">
              
              {/* Editor Header Toolbar */}
              <div className="h-11 border-b border-white/10 bg-[#0d1322] px-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Code2 size={16} className="text-primary" />
                    <span>Live Code Editor</span>
                  </span>

                  <select
                    value={language}
                    disabled={!isAdmin && isEditorLocked}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="javascript">JavaScript (Node.js)</option>
                    <option value="python">Python 3</option>
                    <option value="cpp">C++ (GCC 13)</option>
                    <option value="java">Java 21</option>
                  </select>

                  {isAdmin && (
                    <button
                      onClick={toggleEditorLock}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        isEditorLocked
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border-white/5 hover:text-white'
                      }`}
                      title={isEditorLocked ? 'Candidate cannot type' : 'Candidate can edit code'}
                    >
                      {isEditorLocked ? <Lock size={13} /> : <Unlock size={13} />}
                      <span>{isEditorLocked ? 'Candidate Locked' : 'Unlocked'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRunCode}
                    disabled={isRunning}
                    className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-4 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                    <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
                  </button>
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="flex-1 relative overflow-hidden">
                <Editor
                  height="100%"
                  language={language === 'c++' ? 'cpp' : language}
                  theme="vs-dark"
                  value={code}
                  onChange={handleEditorChange}
                  options={{
                    readOnly: !isAdmin && isEditorLocked,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                  }}
                />

                {!isAdmin && isEditorLocked && (
                  <div className="absolute top-3 right-3 bg-amber-500/90 text-black px-3 py-1 rounded-md text-xs font-bold flex items-center space-x-1.5 shadow-lg">
                    <Lock size={13} />
                    <span>Host locked code editing</span>
                  </div>
                )}
              </div>

              {/* Bottom Output Console */}
              <div className="h-44 border-t border-white/10 bg-slate-950 flex flex-col flex-shrink-0">
                <div className="h-8 px-4 border-b border-white/5 bg-[#0d1322] flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                    <Terminal size={14} className="text-emerald-400" />
                    <span>Output Terminal</span>
                  </span>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    {executionTime !== null && (
                      <span>Runtime: <span className="text-emerald-400 font-mono font-bold">{executionTime}ms</span></span>
                    )}
                    <button onClick={() => setOutput('')} className="hover:text-white">Clear</button>
                  </div>
                </div>
                <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {output || <span className="text-slate-600">Click "Run Code" to compile and view execution output...</span>}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Floating Reactions Toast */}
        <div className="absolute bottom-20 left-6 space-y-2 pointer-events-none z-30">
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              className="bg-slate-900/90 border border-white/15 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-xl backdrop-blur flex items-center space-x-2 animate-fade-in"
            >
              <span>{r.text}</span>
              <span className="text-[10px] text-slate-400">by {r.sender}</span>
            </div>
          ))}
        </div>

        {/* 3. Slide-over Side Panels: Chat / Queue / Security */}
        {activeSidePanel === 'chat' && (
          <div className="w-80 lg:w-96 border-l border-white/10 bg-[#0d1322] flex flex-col z-30 animate-fade-in shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare size={17} className="text-primary" />
                <h3 className="text-sm font-bold text-white">In-Meeting Chat</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No messages yet. Send a message to participants in this call.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-200">{msg.senderName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      msg.senderRole === 'ADMIN'
                        ? 'bg-primary/20 border border-primary/30 text-white'
                        : 'bg-slate-800 text-slate-200 border border-white/5'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-[#090d16]">
              {!isAdmin && !permissions.chatAllowed ? (
                <p className="text-xs text-center text-red-400 py-1 font-medium">
                  Host has disabled participant chat.
                </p>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Type a message to everyone..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="p-2 bg-primary hover:bg-primary-dark text-white rounded-xl disabled:opacity-40 transition-colors"
                  >
                    <Send size={15} />
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Slide-over: Waiting Queue (Admin Only) */}
        {isAdmin && activeSidePanel === 'queue' && (
          <div className="w-96 border-l border-white/10 bg-[#0d1322] flex flex-col z-30 animate-fade-in shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Users size={16} className="text-primary" />
                <span>Candidate Queue Management</span>
              </h3>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <LiveQueueBoard
              sessionId={sessionId!}
              queue={queue}
              activeCandidate={activeCandidate}
              onAdmitCandidate={handleAdmitCandidate}
              onReturnToQueue={handleReturnToQueue}
              onFinishInterview={() => setShowScorecard(true)}
              evaluations={evaluations}
            />
          </div>
        )}

        {/* Slide-over: Host Security & Admin Controls Panel (Zoom/Teams style) */}
        {isAdmin && activeSidePanel === 'security' && (
          <div className="w-80 lg:w-96 border-l border-white/10 bg-[#0d1322] flex flex-col z-30 animate-fade-in shadow-2xl p-5 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-white">Host Security & Controls</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            {/* Permission Toggles */}
            <div className="space-y-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Allow Participants To:
              </span>

              {/* Allow Screen Share */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-white/5">
                <div>
                  <h4 className="text-xs font-bold text-white">Share Their Screen</h4>
                  <p className="text-[11px] text-slate-400">Permit candidate to present screen</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ screenShareAllowed: !permissions.screenShareAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.screenShareAllowed ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.screenShareAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow In-Meeting Chat */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-white/5">
                <div>
                  <h4 className="text-xs font-bold text-white">In-Meeting Chat</h4>
                  <p className="text-[11px] text-slate-400">Allow candidate to send messages</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ chatAllowed: !permissions.chatAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.chatAllowed ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.chatAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow Unmute */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-white/5">
                <div>
                  <h4 className="text-xs font-bold text-white">Unmute Microphone</h4>
                  <p className="text-[11px] text-slate-400">Candidate can speak</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ candidateAudioAllowed: !permissions.candidateAudioAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.candidateAudioAllowed ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.candidateAudioAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow Camera */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-white/5">
                <div>
                  <h4 className="text-xs font-bold text-white">Turn On Camera</h4>
                  <p className="text-[11px] text-slate-400">Candidate video feed</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ candidateVideoAllowed: !permissions.candidateVideoAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.candidateVideoAllowed ? 'bg-primary' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.candidateVideoAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Direct Host Actions:
              </span>

              {activeCandidate && (
                <button
                  onClick={handleForceMuteCandidate}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold transition-colors border border-white/5"
                >
                  <MicOff size={15} className="text-red-400" />
                  <span>Force Mute Candidate</span>
                </button>
              )}

              <button
                onClick={handleToggleCodingRound}
                className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  permissions.codingEnabled
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-primary/20 text-primary-light border-primary/30 hover:bg-primary/30'
                }`}
              >
                <Code2 size={15} />
                <span>{permissions.codingEnabled ? 'Disable Coding (Back to Video Call)' : 'Enable Live Coding Round'}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 4. Bottom Conference Meeting Dock (Like Zoom / Microsoft Teams) */}
      <footer className="h-16 border-t border-white/10 bg-[#0d1322] px-6 flex items-center justify-between flex-shrink-0 z-20">
        
        {/* Left: Audio & Video toggles */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleMic}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl text-xs font-semibold transition-all ${
              localAudio
                ? 'bg-slate-800/80 hover:bg-slate-700 text-white'
                : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
            }`}
          >
            {localAudio ? <Mic size={18} /> : <MicOff size={18} />}
            <span className="text-[9px] mt-0.5">{localAudio ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl text-xs font-semibold transition-all ${
              localVideo
                ? 'bg-slate-800/80 hover:bg-slate-700 text-white'
                : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
            }`}
          >
            {localVideo ? <Video size={18} /> : <VideoOff size={18} />}
            <span className="text-[9px] mt-0.5">{localVideo ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>

        {/* Center: Collaboration & Host Meeting Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Share Screen */}
          <button
            onClick={toggleScreenShare}
            disabled={!isAdmin && !permissions.screenShareAllowed}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl text-xs font-semibold transition-all ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : !isAdmin && !permissions.screenShareAllowed
                ? 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                : 'bg-slate-800/80 hover:bg-slate-700 text-white'
            }`}
            title={!isAdmin && !permissions.screenShareAllowed ? 'Host disabled screen sharing' : 'Share Screen'}
          >
            <ScreenShare size={18} />
            <span className="text-[9px] mt-0.5">{isScreenSharing ? 'Sharing' : 'Share'}</span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              setActiveSidePanel(activeSidePanel === 'chat' ? null : 'chat');
              setUnreadChatCount(0);
            }}
            className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-xl text-xs font-semibold transition-all ${
              activeSidePanel === 'chat'
                ? 'bg-primary text-white'
                : 'bg-slate-800/80 hover:bg-slate-700 text-white'
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[9px] mt-0.5">Chat</span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Raise Hand / Reactions (for Candidate) */}
          {!isAdmin ? (
            <button
              onClick={handleToggleHandRaise}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl text-xs font-semibold transition-all ${
                handRaised
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-white'
              }`}
            >
              <Hand size={18} />
              <span className="text-[9px] mt-0.5">{handRaised ? 'Hand Up' : 'Raise Hand'}</span>
            </button>
          ) : null}

          {/* Host Only: Security / Controls Panel */}
          {isAdmin && (
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'security' ? null : 'security')}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl text-xs font-semibold transition-all ${
                activeSidePanel === 'security'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-white'
              }`}
            >
              <ShieldCheck size={18} />
              <span className="text-[9px] mt-0.5">Security</span>
            </button>
          )}

          {/* Host Only: Queue Drawer */}
          {isAdmin && (
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'queue' ? null : 'queue')}
              className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl text-xs font-semibold transition-all ${
                activeSidePanel === 'queue'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-white'
              }`}
            >
              <Users size={18} />
              <span className="text-[9px] mt-0.5">Queue</span>
              {queue.filter((c) => c.status === 'waiting').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-light text-black rounded-full text-[9px] font-black flex items-center justify-center">
                  {queue.filter((c) => c.status === 'waiting').length}
                </span>
              )}
            </button>
          )}

          {/* HOST ONLY: TOGGLE LIVE CODING ROUND (OPTIONAL) */}
          {isAdmin && (
            <button
              onClick={handleToggleCodingRound}
              className={`flex items-center space-x-2 px-4 h-12 rounded-xl text-xs font-bold transition-all border ${
                permissions.codingEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/40 shadow-lg shadow-blue-500/20'
              }`}
            >
              <Code2 size={18} />
              <span>{permissions.codingEnabled ? 'Close Coding View' : 'Start Live Coding Round'}</span>
            </button>
          )}

          {/* Push Problem button (Visible when coding is enabled) */}
          {isAdmin && permissions.codingEnabled && (
            <button
              onClick={() => setShowQuestionPusher(true)}
              className="flex items-center space-x-1.5 px-3 h-12 rounded-xl text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 transition-colors"
            >
              <BookOpen size={16} />
              <span>Push Problem</span>
            </button>
          )}
        </div>

        {/* Right: Host Scorecard */}
        <div className="flex items-center space-x-2">
          {isAdmin && activeCandidate && (
            <button
              onClick={() => setShowScorecard(true)}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-4 h-12 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all"
            >
              <Award size={16} />
              <span>Score & Complete</span>
            </button>
          )}
        </div>

      </footer>

      {/* Question Pusher Modal */}
      <QuestionPusherModal
        isOpen={showQuestionPusher}
        onClose={() => setShowQuestionPusher(false)}
        onPushProblem={(problem) => {
          const socket = getInterviewSocket();
          socket.emit('code:push-problem', { sessionId, problem });
        }}
      />

      {/* Interview Scorecard Modal */}
      {activeCandidate && (
        <InterviewScorecardModal
          isOpen={showScorecard}
          candidateName={activeCandidate.name}
          candidateId={activeCandidate.candidateId}
          onClose={() => setShowScorecard(false)}
          onSubmit={handleFinishCandidate}
        />
      )}

    </div>
  );
};

export default LiveInterviewRoom;
