import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Video, VideoOff, Mic, MicOff, ScreenShare, PhoneOff, 
  Play, Lock, Unlock, BookOpen, Award, Users, 
  Terminal, CheckCircle2, AlertCircle, Loader2, Sparkles,
  MessageSquare, ShieldCheck, ShieldAlert, Code2, Hand,
  Maximize2, Minimize2, Send, X, MoreVertical, LayoutGrid, User,
  Sliders, Volume2, ThumbsUp, Heart, Check, Copy, ExternalLink,
  Info, Clock, PlayCircle, UserCheck
} from 'lucide-react';
import { getInterviewSocket, closeInterviewSocket } from '../../lib/socket';
import { WebRTCManager } from '../../lib/webrtc';
import QuestionPusherModal from './QuestionPusherModal';
import InterviewScorecardModal from './InterviewScorecardModal';
import { type CandidateItem } from './LiveQueueBoard';

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

  // Media states: Admin camera defaults to FALSE (OFF) as requested!
  const [localVideo, setLocalVideo] = useState<boolean>(() => {
    if (isAdmin) {
      // Check stored preference, but default strictly to FALSE (OFF)
      return localStorage.getItem('racsemi_admin_cam') === 'true';
    }
    return true; // Candidates start with camera on for proctoring/verification
  });
  const [localAudio, setLocalAudio] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layout View (Gallery vs Speaker Spotlight)
  const [layoutMode, setLayoutMode] = useState<'gallery' | 'speaker'>('gallery');

  // Drawers & Modals
  const [activeSidePanel, setActiveSidePanel] = useState<'chat' | 'queue' | 'security' | 'info' | null>(null);
  const [showQuestionPusher, setShowQuestionPusher] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 20-Second Countdown State
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Reactions & Hand raise
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; text: string; sender: string }>>([]);

  // Monaco Editor & Problem
  const [code, setCode] = useState<string>(
    `// Live Collaborative Coding Space\n// Language: JavaScript\n\nfunction solution() {\n  console.log("Ready to code!");\n}\n\nsolution();\n`
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

  const candidateInviteUrl = `${window.location.origin}/interview/lobby/${sessionId}`;

  // Helper to trigger maximize / fullscreen
  const triggerMaximizeScreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    } catch (e) {}
  };

  // Start 20-Second Countdown
  const startCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdown(20);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          // Trigger screen maximize automatically when countdown completes
          triggerMaximizeScreen();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    triggerMaximizeScreen();
  };

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

    // Get camera & mic (Respecting localVideo default: false for admin!)
    rtc.getLocalMedia(localVideo, localAudio).then((stream) => {
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
      if (data.activeCandidate) {
        setActiveCandidate(data.activeCandidate);
      }
      if (data.evaluations) setEvaluations(data.evaluations);
    });

    socket.on('lobby:queue-update', (data: any) => {
      if (data.queue) setQueue(data.queue);
      if (data.activeCandidate !== undefined) {
        // If a new active candidate just entered, trigger 20s countdown!
        if (data.activeCandidate && (!activeCandidate || activeCandidate.socketId !== data.activeCandidate.socketId)) {
          startCountdown();
        }
        setActiveCandidate(data.activeCandidate);
      }
      if (data.evaluations) setEvaluations(data.evaluations);
    });

    // When candidate is admitted into the room
    socket.on('interview:admitted', (data: any) => {
      if (data.features) setPermissions(data.features);
      if (data.chatMessages) setChatMessages(data.chatMessages);
      if (data.editorState) {
        setCode(data.editorState.code);
        setLanguage(data.editorState.language || 'javascript');
      }
      if (data.currentProblem) setCurrentProblem(data.currentProblem);
      rtc.initPeerConnection(true);

      // Trigger 20s countdown for candidate as well
      startCountdown();
    });

    socket.on('webrtc:signal', async (data: any) => {
      await rtc.handleSignal(data.signalData);
    });

    // Host permissions update
    socket.on('host:permissions-updated', (data: any) => {
      setPermissions(data.features);
      if (!isAdmin && data.features.candidateAudioAllowed === false) {
        rtc.toggleAudio(false);
        setLocalAudio(false);
      }
    });

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
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
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

  const handleForceMuteCandidate = (socketId: string) => {
    if (!isAdmin) return;
    const socket = getInterviewSocket();
    socket.emit('host:force-mute-candidate', {
      sessionId,
      targetSocketId: socketId,
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

  // Media Controls: Physical Camera Hardware Shutdown & localStorage persistence!
  const toggleVideo = async () => {
    if (!isAdmin && !permissions.candidateVideoAllowed) {
      alert('Your camera has been disabled by the host.');
      return;
    }
    const nextVideo = !localVideo;
    if (rtcManagerRef.current) {
      await rtcManagerRef.current.toggleVideo(nextVideo);
      setLocalVideo(nextVideo);
      if (nextVideo) {
        const stream = await rtcManagerRef.current.getLocalMedia(true, localAudio);
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } else {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }
    }
    if (isAdmin) {
      // Save preference so reloads respect the user's manual choice
      localStorage.setItem('racsemi_admin_cam', String(nextVideo));
    }
  };


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
    startCountdown();
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

  const copyInvite = () => {
    navigator.clipboard.writeText(candidateInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const waitingCandidates = queue.filter((c) => c.status === 'waiting');
  const completedCandidates = queue.filter((c) => c.status === 'completed');

  return (
    <div className="h-screen w-screen bg-slate-100 text-slate-800 flex flex-col overflow-hidden font-sans selection:bg-primary selection:text-white">
      
      {/* 1. Clean Executive Header (Light Theme) */}
      <header className="h-16 border-b border-slate-200 bg-white px-5 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <img src="/logo2.png" alt="Racsemi" className="h-8 w-8 object-contain" />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Racsemi Meeting</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {isAdmin ? 'HOST' : 'CANDIDATE'}
              </span>
              {permissions.codingEnabled && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <Code2 size={12} />
                  <span>Coding Round</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: In Call Badge */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-500 font-medium">In Call:</span>
          <span className="font-bold text-slate-800">
            {isAdmin ? (activeCandidate ? activeCandidate.name : 'Waiting for Candidate') : 'Interview in Progress'}
          </span>
        </div>

        {/* Right Actions: Meeting Info, Layout, Maximize, Leave */}
        <div className="flex items-center space-x-2">
          
          {/* Meeting Info Button */}
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === 'info' ? null : 'info')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeSidePanel === 'info'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Meeting Link & Info"
          >
            <Info size={14} />
            <span className="hidden sm:inline">Meeting Info</span>
          </button>

          {/* Layout switcher */}
          <button
            onClick={() => setLayoutMode(layoutMode === 'gallery' ? 'speaker' : 'gallery')}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
          >
            <LayoutGrid size={14} />
            <span>{layoutMode === 'gallery' ? 'Speaker View' : 'Gallery View'}</span>
          </button>

          {/* Fullscreen Maximize Button */}
          <button
            onClick={triggerMaximizeScreen}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Screen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Leave Call */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to leave the interview room?')) {
                closeInterviewSocket();
                navigate(isAdmin ? '/admin/interviews' : '/');
              }
            }}
            className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
          >
            <PhoneOff size={14} />
            <span>{isAdmin ? 'End' : 'Leave'}</span>
          </button>
        </div>
      </header>

      {/* 20-Second Countdown Overlay Banner */}
      {countdown !== null && (
        <div className="bg-gradient-to-r from-indigo-600 via-primary to-purple-600 text-white px-6 py-2.5 flex items-center justify-between shadow-md z-30 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
              {countdown}s
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">
                {isAdmin
                  ? `Candidate "${activeCandidate?.name}" has entered! Starting meeting in ${countdown} seconds...`
                  : `Connecting with Interviewer! Meeting starts in ${countdown} seconds...`}
              </p>
              <p className="text-[11px] text-white/80">
                Get ready. The screen will automatically maximize into interview mode.
              </p>
            </div>
          </div>

          <button
            onClick={skipCountdown}
            className="flex items-center space-x-1.5 bg-white text-primary font-bold px-3 py-1 rounded-xl text-xs shadow hover:bg-white/95 transition-all"
          >
            <PlayCircle size={14} />
            <span>Start Now</span>
          </button>
        </div>
      )}

      {/* 2. Main Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Video Conference Stage */}
        <div className="flex-1 flex overflow-hidden">
          
          <div className={`${permissions.codingEnabled ? 'w-80 lg:w-96 border-r border-slate-200' : 'flex-1'} flex flex-col p-4 bg-slate-100 transition-all duration-300 overflow-y-auto`}>
            
            {/* Conference Video Tiles */}
            <div className={`grid gap-5 h-full ${
              !permissions.codingEnabled && layoutMode === 'gallery'
                ? 'grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto w-full items-center' 
                : 'grid-cols-1 flex-1 content-start'
            }`}>
              
              {/* Remote Peer Video Card (Candidate or Interviewer) */}
              <div className="relative aspect-video bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isPeerConnected && (
                  <div className="flex flex-col items-center text-slate-400 text-xs space-y-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-inner">
                      <User size={30} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">
                        {isAdmin ? (activeCandidate ? activeCandidate.name : 'No Candidate Admitted') : 'Interviewer (Host)'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isAdmin ? 'Admit a candidate from the queue panel to begin' : 'Waiting for host video stream...'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 border border-white/10 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{isAdmin ? (activeCandidate?.name || 'Candidate') : 'Interviewer (Host)'}</span>
                </div>
              </div>

              {/* Local Video Card (You) */}
              <div className="relative aspect-video bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isScreenSharing ? '' : 'transform -scale-x-100'} ${!localVideo ? 'hidden' : ''}`}
                />
                
                {/* Camera Off Placeholder */}
                {!localVideo && (
                  <div className="flex flex-col items-center text-slate-400 text-xs space-y-3 p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 text-primary-light flex items-center justify-center font-bold text-xl uppercase shadow-inner">
                      {isAdmin ? 'A' : candidateName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">Your camera is off</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Click "Start Video" in the dock to turn on</p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-semibold text-white flex items-center space-x-2 border border-white/10 shadow-sm">
                  {localAudio ? <Mic size={13} className="text-emerald-400" /> : <MicOff size={13} className="text-red-400" />}
                  <span>You ({isAdmin ? 'Host' : candidateName})</span>
                </div>
              </div>

            </div>

            {/* Problem Statement Card (Only when coding round is active) */}
            {permissions.codingEnabled && currentProblem && (
              <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 space-y-2 max-h-60 overflow-y-auto shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Problem Statement</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    {currentProblem.language}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{currentProblem.title}</h4>
                <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans">
                  {currentProblem.description}
                </div>
              </div>
            )}
          </div>

          {/* Optional Collaborative Monaco Code Editor */}
          {permissions.codingEnabled && (
            <div className="flex-1 flex flex-col bg-slate-950 border-l border-slate-200 overflow-hidden animate-fade-in">
              <div className="h-11 border-b border-white/10 bg-slate-900 px-4 flex items-center justify-between flex-shrink-0 text-white">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Code2 size={16} className="text-primary-light" />
                    <span>Collaborative Code Editor</span>
                  </span>

                  <select
                    value={language}
                    disabled={!isAdmin && isEditorLocked}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary"
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
                    >
                      {isEditorLocked ? <Lock size={13} /> : <Unlock size={13} />}
                      <span>{isEditorLocked ? 'Candidate Locked' : 'Unlocked'}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-4 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                  <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
                </button>
              </div>

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
              </div>

              <div className="h-44 border-t border-white/10 bg-slate-950 flex flex-col flex-shrink-0 text-white">
                <div className="h-8 px-4 border-b border-white/5 bg-slate-900 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                    <Terminal size={14} className="text-emerald-400" />
                    <span>Execution Output</span>
                  </span>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    {executionTime !== null && (
                      <span>Runtime: <span className="text-emerald-400 font-mono font-bold">{executionTime}ms</span></span>
                    )}
                    <button onClick={() => setOutput('')} className="hover:text-white">Clear</button>
                  </div>
                </div>
                <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {output || <span className="text-slate-600">Click "Run Code" to compile and execute program output...</span>}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 3. Slide-over Side Panels */}
        
        {/* Panel A: Meeting Info & Open in New Tab */}
        {activeSidePanel === 'info' && (
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col z-30 animate-fade-in shadow-xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Info size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-slate-900">Meeting Details</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Session ID</label>
                <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{sessionId}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidate Invite Link</label>
                <div className="mt-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-mono break-all select-all">
                  {candidateInviteUrl}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={copyInvite}
                  className={`w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    copiedLink
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-primary hover:bg-primary-dark text-white border-primary shadow-sm'
                  }`}
                >
                  {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Candidate Invite Link'}</span>
                </button>

                <a
                  href={candidateInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold transition-colors"
                >
                  <ExternalLink size={15} />
                  <span>Open Candidate Lobby in New Tab</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Panel B: Dedicated Participants & Queue Panel (Clean Vertical List, NO CRUSHED COLUMNS!) */}
        {isAdmin && activeSidePanel === 'queue' && (
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col z-30 animate-fade-in shadow-xl p-5 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Users size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-slate-900">Participants & Queue</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Quick Invite Link Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Share Candidate Link:</span>
              <button
                onClick={copyInvite}
                className="flex items-center space-x-1 text-xs font-bold text-primary hover:text-primary-dark"
              >
                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* 1. Active In Meeting (Hot Seat) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <UserCheck size={13} className="text-emerald-500" />
                <span>In Meeting (1)</span>
              </span>

              {activeCandidate ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{activeCandidate.name}</h4>
                      <p className="text-xs text-slate-500">{activeCandidate.email}</p>
                    </div>
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-1 border-t border-emerald-100">
                    <button
                      onClick={() => handleForceMuteCandidate(activeCandidate.socketId)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors flex items-center justify-center space-x-1"
                    >
                      <MicOff size={13} className="text-red-500" />
                      <span>Mute</span>
                    </button>
                    <button
                      onClick={() => handleReturnToQueue(activeCandidate.socketId)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                    >
                      Move to Queue
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  No candidate currently in meeting.
                </div>
              )}
            </div>

            {/* 2. Waiting Room Queue (Vertical List) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock size={13} className="text-primary" />
                  <span>Waiting Room ({waitingCandidates.length})</span>
                </span>
              </div>

              {waitingCandidates.length === 0 ? (
                <div className="p-6 border border-slate-200 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-600">Waiting room is empty</p>
                  <p className="text-[11px] text-slate-400">Candidates who open the link will appear here</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {waitingCandidates.map((c, idx) => (
                    <div
                      key={c.socketId}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900">{c.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{c.email}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {c.deviceStatus?.video ? '📹 Video ready' : 'No camera'}
                        </span>
                        <button
                          onClick={() => handleAdmitCandidate(c.socketId)}
                          className="bg-primary hover:bg-primary-dark text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all flex items-center space-x-1"
                        >
                          <Play size={12} className="fill-current" />
                          <span>Admit to Room</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Completed Candidates */}
            {completedCandidates.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Evaluated ({completedCandidates.length})
                </span>
                <div className="space-y-1.5">
                  {completedCandidates.map((c) => {
                    const evalData = evaluations[c.candidateId];
                    return (
                      <div key={c.socketId} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        {evalData?.recommendation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {evalData.recommendation.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel C: Chat (Light Theme) */}
        {activeSidePanel === 'chat' && (
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col z-30 animate-fade-in shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare size={17} className="text-primary" />
                <h3 className="text-sm font-bold text-slate-900">In-Meeting Chat</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No messages yet. Send a note or link.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-700">{msg.senderName}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-3 rounded-xl text-xs leading-relaxed ${
                      msg.senderRole === 'ADMIN'
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
              {!isAdmin && !permissions.chatAllowed ? (
                <p className="text-xs text-center text-red-500 py-1 font-medium">
                  Host has disabled participant chat.
                </p>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Type message to everyone..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="p-2 bg-primary hover:bg-primary-dark text-white rounded-xl disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <Send size={15} />
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Panel D: Host Security Controls */}
        {isAdmin && activeSidePanel === 'security' && (
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col z-30 animate-fade-in shadow-xl p-5 space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-slate-900">Host Security & Controls</h3>
              </div>
              <button onClick={() => setActiveSidePanel(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Participant Permissions:
              </span>

              {/* Allow Screen Share */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Share Screen</h4>
                  <p className="text-[11px] text-slate-500">Allow candidate to present</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ screenShareAllowed: !permissions.screenShareAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.screenShareAllowed ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.screenShareAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow Chat */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">In-Meeting Chat</h4>
                  <p className="text-[11px] text-slate-500">Allow participant messages</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ chatAllowed: !permissions.chatAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.chatAllowed ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.chatAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow Mic */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Unmute Microphone</h4>
                  <p className="text-[11px] text-slate-500">Allow candidate to speak</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ candidateAudioAllowed: !permissions.candidateAudioAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.candidateAudioAllowed ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.candidateAudioAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Allow Camera */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Turn On Camera</h4>
                  <p className="text-[11px] text-slate-500">Candidate video feed</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateHostPermissions({ candidateVideoAllowed: !permissions.candidateVideoAllowed })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    permissions.candidateVideoAllowed ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    permissions.candidateVideoAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <button
                onClick={handleToggleCodingRound}
                className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  permissions.codingEnabled
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-primary text-white border-primary shadow-sm hover:bg-primary-dark'
                }`}
              >
                <Code2 size={15} />
                <span>{permissions.codingEnabled ? 'Close Live Coding View' : 'Start Live Coding Round'}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 4. Professional Conference Dock (Clean White / Light Theme) */}
      <footer className="h-20 border-t border-slate-200 bg-white px-6 flex items-center justify-between flex-shrink-0 z-20 shadow-md">
        
        {/* Left: Audio & Video Toggles */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={toggleMic}
            className={`flex flex-col items-center justify-center w-14 h-13 rounded-2xl text-xs font-semibold transition-all ${
              localAudio
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                : 'bg-red-600 text-white shadow-md'
            }`}
          >
            {localAudio ? <Mic size={18} /> : <MicOff size={18} />}
            <span className="text-[9px] mt-0.5">{localAudio ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            onClick={toggleVideo}
            className={`flex flex-col items-center justify-center w-14 h-13 rounded-2xl text-xs font-semibold transition-all ${
              localVideo
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                : 'bg-red-600 text-white shadow-md'
            }`}
          >
            {localVideo ? <Video size={18} /> : <VideoOff size={18} />}
            <span className="text-[9px] mt-0.5">{localVideo ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>

        {/* Center: Meeting Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          
          {/* Share Screen */}
          <button
            onClick={toggleScreenShare}
            disabled={!isAdmin && !permissions.screenShareAllowed}
            className={`flex flex-col items-center justify-center w-16 h-13 rounded-2xl text-xs font-semibold transition-all ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-md'
                : !isAdmin && !permissions.screenShareAllowed
                ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
            }`}
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
            className={`relative flex flex-col items-center justify-center w-14 h-13 rounded-2xl text-xs font-semibold transition-all ${
              activeSidePanel === 'chat'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[9px] mt-0.5">Chat</span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Raise Hand for Candidate */}
          {!isAdmin && (
            <button
              onClick={handleToggleHandRaise}
              className={`flex flex-col items-center justify-center w-16 h-13 rounded-2xl text-xs font-semibold transition-all ${
                handRaised
                  ? 'bg-amber-400 text-slate-900 shadow-md font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
              }`}
            >
              <Hand size={18} />
              <span className="text-[9px] mt-0.5">{handRaised ? 'Hand Up' : 'Raise Hand'}</span>
            </button>
          )}

          {/* Host: Security Controls */}
          {isAdmin && (
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'security' ? null : 'security')}
              className={`flex flex-col items-center justify-center w-16 h-13 rounded-2xl text-xs font-semibold transition-all ${
                activeSidePanel === 'security'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
              }`}
            >
              <ShieldCheck size={18} />
              <span className="text-[9px] mt-0.5">Security</span>
            </button>
          )}

          {/* Host: Queue & Participants Drawer */}
          {isAdmin && (
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === 'queue' ? null : 'queue')}
              className={`relative flex flex-col items-center justify-center w-16 h-13 rounded-2xl text-xs font-semibold transition-all ${
                activeSidePanel === 'queue'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
              }`}
            >
              <Users size={18} />
              <span className="text-[9px] mt-0.5">Queue</span>
              {waitingCandidates.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {waitingCandidates.length}
                </span>
              )}
            </button>
          )}

          {/* Host: Optional Live Coding Round Toggle */}
          {isAdmin && (
            <button
              onClick={handleToggleCodingRound}
              className={`flex items-center space-x-2 px-4 h-13 rounded-2xl text-xs font-bold transition-all border ${
                permissions.codingEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white shadow-md'
                  : 'bg-primary hover:bg-primary-dark text-white border-primary shadow-sm'
              }`}
            >
              <Code2 size={18} />
              <span>{permissions.codingEnabled ? 'Close Coding' : 'Start Live Coding Round'}</span>
            </button>
          )}

          {isAdmin && permissions.codingEnabled && (
            <button
              onClick={() => setShowQuestionPusher(true)}
              className="flex items-center space-x-1.5 px-3 h-13 rounded-2xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 transition-colors"
            >
              <BookOpen size={16} />
              <span>Push Problem</span>
            </button>
          )}
        </div>

        {/* Right: Score & Complete */}
        <div className="flex items-center space-x-2">
          {isAdmin && activeCandidate && (
            <button
              onClick={() => setShowScorecard(true)}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 h-12 rounded-xl text-xs shadow-md transition-all"
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
