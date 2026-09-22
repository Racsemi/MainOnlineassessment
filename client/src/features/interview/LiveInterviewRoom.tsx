import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Video, VideoOff, Mic, MicOff, ScreenShare, PhoneOff, 
  Play, Lock, Unlock, BookOpen, Award, Users, 
  Terminal, CheckCircle2, AlertCircle, Loader2, Sparkles,
  ChevronDown, Maximize2, RefreshCw
} from 'lucide-react';
import { getInterviewSocket, closeInterviewSocket } from '../../lib/socket';
import { WebRTCManager } from '../../lib/webrtc';
import QuestionPusherModal from './QuestionPusherModal';
import InterviewScorecardModal from './InterviewScorecardModal';
import LiveQueueBoard, { type CandidateItem } from './LiveQueueBoard';


export const LiveInterviewRoom: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Role: admin or candidate
  const roleParam = searchParams.get('role');
  const isAdmin = roleParam !== 'candidate';
  const candidateName = searchParams.get('name') || 'Candidate';
  const candidateEmail = searchParams.get('email') || '';

  // Video / Audio states
  const [localAudio, setLocalAudio] = useState(true);
  const [localVideo, setLocalVideo] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);

  // Editor states
  const [code, setCode] = useState<string>(
    `// Welcome to the Live Technical Interview\n// You can write and execute code collaboratively\n\nfunction solution() {\n  console.log("Ready to code!");\n}\n\nsolution();\n`
  );
  const [language, setLanguage] = useState('javascript');
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  // Problem statement states
  const [currentProblem, setCurrentProblem] = useState<any>(null);

  // Output terminal states
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Modals & Panels
  const [showQuestionPusher, setShowQuestionPusher] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);

  // Queue & Room State (for Admin)
  const [queue, setQueue] = useState<CandidateItem[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateItem | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const isUpdatingFromSocketRef = useRef(false);

  // Initialize Socket and WebRTC
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

    // 2. Setup WebRTC manager
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

    // Get camera & mic
    rtc.getLocalMedia(true, true).then((stream) => {
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });

    // 3. Socket listeners
    socket.on('session:state', (data: any) => {
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

    // Candidate admitted event
    socket.on('interview:admitted', (data: any) => {
      if (data.editorState) {
        setCode(data.editorState.code);
        setLanguage(data.editorState.language || 'javascript');
      }
      if (data.currentProblem) setCurrentProblem(data.currentProblem);
      // Initiate WebRTC peer connection
      rtc.initPeerConnection(true);
    });

    // WebRTC signaling
    socket.on('webrtc:signal', async (data: any) => {
      await rtc.handleSignal(data.signalData);
    });

    // Real-time collaborative code sync
    socket.on('code:sync', (data: any) => {
      isUpdatingFromSocketRef.current = true;
      setCode(data.code);
      if (data.language) setLanguage(data.language);
      setTimeout(() => {
        isUpdatingFromSocketRef.current = false;
      }, 50);
    });

    // Lock sync
    socket.on('code:lock-sync', (data: any) => {
      setIsEditorLocked(data.isLocked);
    });

    // Problem pushed
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

    // Code execution events
    socket.on('code:run-start', () => {
      setIsRunning(true);
      setOutput('Running code...');
    });

    socket.on('code:run-result', (result: any) => {
      setIsRunning(false);
      setOutput(result.output || result.error || 'Execution completed without output.');
      setExecutionTime(result.executionTimeMs || null);
    });

    // Candidate returned to lobby
    socket.on('interview:returned-to-lobby', () => {
      navigate(`/interview/lobby/${sessionId}?name=${encodeURIComponent(candidateName)}&email=${encodeURIComponent(candidateEmail)}`);
    });

    // Interview ended
    socket.on('interview:completed', () => {
      alert('Your interview has concluded. Thank you for your time!');
      navigate(`/`);
    });

    return () => {
      rtc.destroy();
      socket.off('session:state');
      socket.off('lobby:queue-update');
      socket.off('interview:admitted');
      socket.off('webrtc:signal');
      socket.off('code:sync');
      socket.off('code:lock-sync');
      socket.off('code:problem-pushed');
      socket.off('code:run-start');
      socket.off('code:run-result');
      socket.off('interview:returned-to-lobby');
      socket.off('interview:completed');
    };
  }, [sessionId, isAdmin, candidateName, candidateEmail, navigate]);

  // Code editor change handler
  const handleEditorChange = (newCode: string | undefined) => {
    if (newCode === undefined || isUpdatingFromSocketRef.current) return;
    setCode(newCode);

    const socket = getInterviewSocket();
    socket.emit('code:change', {
      sessionId,
      code: newCode,
      language,
    });
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const socket = getInterviewSocket();
    socket.emit('code:change', {
      sessionId,
      code,
      language: newLang,
    });
  };

  const toggleEditorLock = () => {
    const socket = getInterviewSocket();
    const nextLocked = !isEditorLocked;
    setIsEditorLocked(nextLocked);
    socket.emit('code:lock', {
      sessionId,
      isLocked: nextLocked,
    });
  };

  // Run code
  const handleRunCode = () => {
    const socket = getInterviewSocket();
    socket.emit('code:run', {
      sessionId,
      code,
      language,
      customInput,
    });
  };

  // Media toggles
  const toggleMic = () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.toggleAudio(!localAudio);
      setLocalAudio(!localAudio);
    }
  };

  const toggleVideo = () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.toggleVideo(!localVideo);
      setLocalVideo(!localVideo);
    }
  };

  const toggleScreenShare = async () => {
    if (!rtcManagerRef.current) return;
    if (!isScreenSharing) {
      const stream = await rtcManagerRef.current.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
    } else {
      rtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
      const camStream = await rtcManagerRef.current.getLocalMedia(localVideo, localAudio);
      if (camStream && localVideoRef.current) {
        localVideoRef.current.srcObject = camStream;
      }
    }
  };

  // Admin actions
  const handleAdmitCandidate = (candidateSocketId: string) => {
    const socket = getInterviewSocket();
    socket.emit('interview:admit', {
      sessionId,
      candidateSocketId,
    });
  };

  const handleReturnToQueue = (candidateSocketId: string) => {
    const socket = getInterviewSocket();
    socket.emit('interview:return-to-queue', {
      sessionId,
      candidateSocketId,
    });
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
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      
      {/* Top Header Bar */}
      <header className="h-14 border-b border-white/10 bg-slate-900/90 px-4 flex items-center justify-between flex-shrink-0 backdrop-blur z-20">
        <div className="flex items-center space-x-3">
          <img src="/logo2.png" alt="Racsemi" className="h-7 w-7 object-contain" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white tracking-tight">Racsemi Live Interview</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary-light border border-primary/30">
                {isAdmin ? 'ADMIN CONSOLE' : 'HOT SEAT'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Active Participant Badge */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-950/70 border border-white/10 px-3 py-1 rounded-full text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-400">Candidate:</span>
          <span className="font-bold text-white">
            {activeCandidate?.name || (isAdmin ? 'No Candidate Admitted' : candidateName)}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <>
              {/* Waiting Queue Drawer Toggle */}
              <button
                onClick={() => setShowQueueDrawer(!showQueueDrawer)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  showQueueDrawer 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-slate-800 text-slate-200 border-white/10 hover:bg-slate-700'
                }`}
              >
                <Users size={14} />
                <span>Queue ({queue.filter((c) => c.status === 'waiting').length})</span>
              </button>

              {/* Push Problem Button */}
              <button
                onClick={() => setShowQuestionPusher(true)}
                className="flex items-center space-x-1.5 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              >
                <BookOpen size={14} />
                <span>Push Problem</span>
              </button>

              {/* Conclude Interview Button */}
              {activeCandidate && (
                <button
                  onClick={() => setShowScorecard(true)}
                  className="flex items-center space-x-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                >
                  <Award size={14} />
                  <span>Score Candidate</span>
                </button>
              )}
            </>
          )}

          {/* Exit / Leave */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to leave the interview room?')) {
                closeInterviewSocket();
                navigate(isAdmin ? '/admin/interviews' : '/');
              }
            }}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            title="Leave Room"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace: 3-Panel Split Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: Video Feeds & Problem Statement (Width: 360px to 400px) */}
        <div className="w-80 lg:w-96 border-r border-white/10 bg-slate-900/60 flex flex-col flex-shrink-0 overflow-hidden">
          
          {/* Video Grid */}
          <div className="p-3 border-b border-white/10 space-y-2 bg-slate-950/40">
            {/* Remote Peer Video Feed */}
            <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-white/10 shadow-md flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!isPeerConnected && (
                <div className="flex flex-col items-center text-slate-500 text-xs space-y-1">
                  <Loader2 size={24} className="animate-spin text-primary opacity-60" />
                  <span>Waiting for peer video stream...</span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                {isAdmin ? (activeCandidate?.name || 'Candidate') : 'Interviewer'}
              </div>
            </div>

            {/* Local Video Feed + Media Controls */}
            <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-white/10 shadow-md flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isScreenSharing ? '' : 'transform -scale-x-100'}`}
              />
              {!localVideo && (
                <div className="flex flex-col items-center text-slate-500 text-xs space-y-1">
                  <VideoOff size={22} />
                  <span>Camera turned off</span>
                </div>
              )}

              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
                You ({isAdmin ? 'Interviewer' : candidateName})
              </div>

              {/* Floating in-video media controls */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center space-x-2 bg-black/60 backdrop-blur-md py-1.5 px-3 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    localAudio ? 'text-white hover:bg-white/10' : 'bg-red-500 text-white'
                  }`}
                  title={localAudio ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {localAudio ? <Mic size={14} /> : <MicOff size={14} />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    localVideo ? 'text-white hover:bg-white/10' : 'bg-red-500 text-white'
                  }`}
                  title={localVideo ? 'Turn Off Cam' : 'Turn On Cam'}
                >
                  {localVideo ? <Video size={14} /> : <VideoOff size={14} />}
                </button>

                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    isScreenSharing ? 'bg-primary text-white' : 'text-white hover:bg-white/10'
                  }`}
                  title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                  <ScreenShare size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Problem Statement Details */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-slate-900">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles size={14} className="text-primary" />
                <span>Current Challenge</span>
              </span>
              {currentProblem && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary-light font-mono font-bold">
                  {currentProblem.language || 'Code'}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentProblem ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {currentProblem.title}
                  </h3>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/5 font-sans">
                    {currentProblem.description}
                  </div>
                  {currentProblem.constraints && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 mb-1">Constraints:</h4>
                      <p className="text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-white/5">
                        {currentProblem.constraints}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-2">
                  <BookOpen size={28} className="stroke-1 opacity-50" />
                  <p>No problem pushed yet.</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowQuestionPusher(true)}
                      className="text-primary hover:underline text-xs font-medium"
                    >
                      + Push problem from bank
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Panel: Collaborative Monaco Code Editor & Terminal (Flex-1) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          
          {/* Editor Header Toolbar */}
          <div className="h-11 border-b border-white/10 bg-slate-900 px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3">
              {/* Language Picker */}
              <select
                value={language}
                disabled={!isAdmin && isEditorLocked}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="python">Python 3</option>
                <option value="cpp">C++ (GCC 13)</option>
                <option value="java">Java 21</option>
              </select>

              {/* Theme toggle */}
              <button
                onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-white/5"
              >
                {editorTheme === 'vs-dark' ? 'Dark Theme' : 'Light Theme'}
              </button>

              {/* Admin Lock / Unlock candidate editor toggle */}
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

            {/* Run Code Button */}
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

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden">
            <Editor
              height="100%"
              language={language === 'c++' ? 'cpp' : language}
              theme={editorTheme}
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
                <span>Interviewer locked code editing</span>
              </div>
            )}
          </div>

          {/* Bottom Terminal & Output Panel */}
          <div className="h-44 border-t border-white/10 bg-slate-950 flex flex-col flex-shrink-0">
            <div className="h-8 px-4 border-b border-white/5 bg-slate-900/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                <Terminal size={14} className="text-emerald-400" />
                <span>Execution Console</span>
              </span>
              <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                {executionTime !== null && (
                  <span>Runtime: <span className="text-emerald-400 font-mono font-bold">{executionTime}ms</span></span>
                )}
                <button
                  onClick={() => setOutput('')}
                  className="hover:text-white transition-colors"
                >
                  Clear Output
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-slate-200 whitespace-pre-wrap selection:bg-primary">
              {output || (
                <span className="text-slate-600 select-none">
                  Click "Run Code" to compile and execute program output...
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Right Slide-over: Live Queue Drawer for Admin */}
        {isAdmin && showQueueDrawer && (
          <div className="absolute inset-y-0 right-0 w-96 bg-slate-900 border-l border-white/10 shadow-2xl z-30 p-4 overflow-y-auto animate-fade-in flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Users size={16} className="text-primary" />
                <span>Waiting Room Management</span>
              </h3>
              <button
                onClick={() => setShowQueueDrawer(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
              >
                Close
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

      </div>

      {/* Question Pusher Modal */}
      <QuestionPusherModal
        isOpen={showQuestionPusher}
        onClose={() => setShowQuestionPusher(false)}
        onPushProblem={(problem) => {
          const socket = getInterviewSocket();
          socket.emit('code:push-problem', {
            sessionId,
            problem,
          });
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
