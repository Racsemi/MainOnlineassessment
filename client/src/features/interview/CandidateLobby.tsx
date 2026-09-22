import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Volume2, ShieldCheck, 
  Users, Clock, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Loader2 
} from 'lucide-react';
import { getInterviewSocket } from '../../lib/socket';
import api from '../../lib/axios';

export const CandidateLobby: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Candidate identity
  const [name, setName] = useState(searchParams.get('name') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [college, setCollege] = useState('');

  // Media states
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [hasMediaPermissions, setHasMediaPermissions] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Queue states
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [totalWaiting, setTotalWaiting] = useState<number>(1);
  const [sessionTitle, setSessionTitle] = useState('Technical Coding Interview');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fetch session metadata if available
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/interviews/${sessionId}`)
      .then((res) => {
        if (res.data?.title) setSessionTitle(res.data.title);
      })
      .catch(() => {});
  }, [sessionId]);

  // Initialize camera and mic preview
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        currentStream = stream;
        streamRef.current = stream;
        setHasMediaPermissions(true);
        setMediaError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup microphone volume meter
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        } catch (e) {
          console.warn('Audio analyser not supported:', e);
        }
      } catch (err: any) {
        console.warn('Camera/Mic permission denied or unavailable:', err);
        setMediaError('Could not access camera or microphone. Please enable browser permissions to continue.');
        setHasMediaPermissions(false);
      }
    }

    initMedia();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !cameraActive;
        setCameraActive(!cameraActive);
      }
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micActive;
        setMicActive(!micActive);
      }
    }
  };

  const testSpeaker = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  // Join the waiting queue
  const handleJoinQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const socket = getInterviewSocket();

    // Register into lobby
    socket.emit('lobby:join', {
      sessionId,
      role: 'CANDIDATE',
      candidateData: {
        name: name.trim(),
        email: email.trim(),
        college: college.trim(),
        deviceStatus: {
          audio: micActive,
          video: cameraActive,
        },
      },
    });

    setIsInQueue(true);

    // Listen for queue updates
    socket.on('lobby:joined', (data: any) => {
      if (data.position !== undefined) setQueuePosition(data.position);
      if (data.totalWaiting !== undefined) setTotalWaiting(data.totalWaiting);
    });

    socket.on('lobby:queue-update', (data: any) => {
      const waitingList = (data.queue || []).filter((c: any) => c.status === 'waiting');
      setTotalWaiting(waitingList.length);
      const myIndex = waitingList.findIndex((c: any) => c.socketId === socket.id);
      if (myIndex >= 0) {
        setQueuePosition(myIndex + 1);
      }
    });

    // When admin admits candidate
    socket.on('interview:admitted', (admittedData: any) => {
      testSpeaker();
      // Keep stream alive or pass state
      navigate(`/interview/room/${sessionId}?role=candidate&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`);
    });

    // Clean up on unmount
    return () => {
      socket.off('lobby:joined');
      socket.off('lobby:queue-update');
      socket.off('interview:admitted');
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-primary selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur bg-slate-900/50">
        <div className="flex items-center space-x-3">
          <img src="/logo2.png" alt="Racsemi" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">Racsemi Live Interview</h1>
            <p className="text-xs text-slate-400">{sessionTitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Interview Server Online</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          {/* Left: Device & Camera Preview */}
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${!cameraActive ? 'hidden' : ''}`}
              />
              {!cameraActive && (
                <div className="flex flex-col items-center text-slate-500 space-y-2">
                  <VideoOff size={44} className="stroke-1" />
                  <span className="text-xs font-medium tracking-wide">Camera is turned off</span>
                </div>
              )}

              {/* Live overlay badges */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-200 border border-white/10">
                Preview Check
              </div>

              {/* Mic level bar */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
                {micActive ? <Mic size={15} className="text-emerald-400 flex-shrink-0" /> : <MicOff size={15} className="text-red-400 flex-shrink-0" />}
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                    style={{ width: `${micActive ? micLevel : 0}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono w-7 text-right">
                  {micActive ? `${micLevel}%` : 'OFF'}
                </span>
              </div>
            </div>

            {/* Media toggle buttons */}
            <div className="flex items-center space-x-3 mt-4">
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  cameraActive 
                    ? 'bg-slate-800 border-white/10 text-white hover:bg-slate-700' 
                    : 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {cameraActive ? <Video size={16} /> : <VideoOff size={16} />}
                <span>{cameraActive ? 'Turn Off Cam' : 'Turn On Cam'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  micActive 
                    ? 'bg-slate-800 border-white/10 text-white hover:bg-slate-700' 
                    : 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {micActive ? <Mic size={16} /> : <MicOff size={16} />}
                <span>{micActive ? 'Mute Mic' : 'Unmute Mic'}</span>
              </button>

              <button
                type="button"
                onClick={testSpeaker}
                className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                title="Test Audio Chime"
              >
                <Volume2 size={16} />
                <span>Test Sound</span>
              </button>
            </div>

            {mediaError && (
              <div className="mt-3 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-center space-x-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{mediaError}</span>
              </div>
            )}
          </div>

          {/* Right: Registration or Waiting Queue Screen */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-7 shadow-2xl backdrop-blur-md">
            {!isInQueue ? (
              /* Step 1: Candidate Info Form */
              <form onSubmit={handleJoinQueue} className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-primary tracking-wider uppercase">Candidate Check-in</span>
                  <h2 className="text-xl font-bold text-white mt-1">Ready for your Interview?</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Please confirm your name and details before joining the waiting lobby.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rahul@example.com"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">College / Organization (Optional)</label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. IIT Bombay / NIT Surathkal"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={!name.trim() || !email.trim()}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Enter Waiting Room</span>
                    <ArrowRight size={17} />
                  </button>
                </div>

                <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 pt-1">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>Your interview room is encrypted and private.</span>
                </div>
              </form>
            ) : (
              /* Step 2: Live Waiting Queue Screen */
              <div className="text-center space-y-6 py-2">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border-2 border-primary/30 flex items-center justify-center animate-pulse">
                    <Users size={38} className="text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                    Live
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="inline-block bg-primary/10 border border-primary/20 text-primary-light text-xs font-semibold px-3 py-1 rounded-full">
                    Queue Position #{queuePosition} of {totalWaiting}
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    You're in the Waiting Room!
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    The interviewer has been notified. When they admit you, your screen will automatically connect to the interview room.
                  </p>
                </div>

                {/* Queue status banner */}
                <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <Clock size={14} className="text-slate-500" />
                      <span>Estimated Wait:</span>
                    </span>
                    <span className="font-semibold text-slate-200">
                      {queuePosition === 1 ? 'Next in line (~1-2 mins)' : `~${queuePosition * 10} mins`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <Sparkles size={14} className="text-slate-500" />
                      <span>Candidate:</span>
                    </span>
                    <span className="font-semibold text-white">{name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center space-x-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>Hardware:</span>
                    </span>
                    <span className="text-emerald-400 font-medium">Camera & Mic Verified</span>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span>Listening for interviewer invitation...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-3 text-center text-xs text-slate-600">
        Racsemi Assessment Platform • Low-Latency Video & Collaborative Coding
      </footer>
    </div>
  );
};

export default CandidateLobby;
