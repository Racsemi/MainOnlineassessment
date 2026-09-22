import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Volume2, ShieldCheck, 
  Users, Clock, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Loader2, User
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
  const [sessionTitle, setSessionTitle] = useState('Technical Interview Session');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Fetch session title
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/interviews/${sessionId}`)
      .then((res) => {
        if (res.data?.title) setSessionTitle(res.data.title);
      })
      .catch(() => {});
  }, [sessionId]);

  // Start media preview
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setHasMediaPermissions(true);
      setMediaError(null);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Mic level setup
      setupAudioMeter(stream);
    } catch (err: any) {
      console.warn('Camera/Mic permission failed:', err);
      // Attempt audio only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = audioOnly;
        setCameraActive(false);
        setHasMediaPermissions(true);
        setupAudioMeter(audioOnly);
      } catch {
        setMediaError('Could not access camera or microphone. Please enable browser permissions to continue.');
        setHasMediaPermissions(false);
      }
    }
  };

  const setupAudioMeter = (stream: MediaStream) => {
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
    } catch (e) {}
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  // Physically stop camera hardware to turn off LED
  const toggleCamera = async () => {
    if (cameraActive) {
      // STOP HARDWARE CAMERA TRACK
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          streamRef.current?.removeTrack(t);
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    } else {
      // RE-ACQUIRE HARDWARE CAMERA
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = videoStream.getVideoTracks()[0];
        if (newTrack && streamRef.current) {
          streamRef.current.addTrack(newTrack);
          if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
          setCameraActive(true);
        }
      } catch (e) {
        console.warn('Could not turn on camera:', e);
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  // Join waiting queue
  const handleJoinQueue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const socket = getInterviewSocket();

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

    socket.on('interview:admitted', () => {
      testSpeaker();
      navigate(`/interview/room/${sessionId}?role=candidate&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`);
    });

    return () => {
      socket.off('lobby:joined');
      socket.off('lobby:queue-update');
      socket.off('interview:admitted');
    };
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between font-sans selection:bg-primary selection:text-white">
      
      {/* Executive Light Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <img src="/logo2.png" alt="Racsemi" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Racsemi Live Interview</h1>
            <p className="text-xs text-slate-500">{sessionTitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Interview Lobby Active</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          {/* Left: Device & Camera Preview Card */}
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-video bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${!cameraActive ? 'hidden' : ''}`}
              />
              {!cameraActive && (
                <div className="flex flex-col items-center text-slate-400 space-y-2 p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <User size={30} />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Camera hardware is stopped</span>
                  <span className="text-[11px] text-slate-500">Your webcam LED is turned off</span>
                </div>
              )}

              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white border border-white/10">
                Preview Check
              </div>

              {/* Mic Level Visualizer */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-white">
                {micActive ? <Mic size={14} className="text-emerald-400 flex-shrink-0" /> : <MicOff size={14} className="text-red-400 flex-shrink-0" />}
                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-75"
                    style={{ width: `${micActive ? micLevel : 0}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-300 font-mono w-7 text-right">
                  {micActive ? `${micLevel}%` : 'OFF'}
                </span>
              </div>
            </div>

            {/* Media toggle buttons */}
            <div className="flex items-center space-x-2.5 mt-4">
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  cameraActive 
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm' 
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                {cameraActive ? <Video size={15} /> : <VideoOff size={15} />}
                <span>{cameraActive ? 'Turn Off Cam' : 'Turn On Cam'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  micActive 
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm' 
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                {micActive ? <Mic size={15} /> : <MicOff size={15} />}
                <span>{micActive ? 'Mute Mic' : 'Unmute Mic'}</span>
              </button>

              <button
                type="button"
                onClick={testSpeaker}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                title="Test Sound"
              >
                <Volume2 size={15} />
                <span>Test Audio</span>
              </button>
            </div>

            {mediaError && (
              <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center space-x-2">
                <AlertCircle size={15} className="flex-shrink-0 text-amber-600" />
                <span>{mediaError}</span>
              </div>
            )}
          </div>

          {/* Right: Registration or Waiting Queue Screen (Crisp White Card) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-xl">
            {!isInQueue ? (
              <form onSubmit={handleJoinQueue} className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-primary tracking-wider uppercase">Candidate Check-in</span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Ready for your Interview?</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Please confirm your details before joining the interviewer's queue.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rahul@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">College / Organization (Optional)</label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. IIT Bombay / NIT"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={!name.trim() || !email.trim()}
                    className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-primary/25 transition-all transform active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>Enter Waiting Room</span>
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400 pt-1">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>Secure 1-on-1 encrypted video session</span>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-6 py-2">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center animate-pulse">
                    <Users size={34} className="text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow">
                    In Queue
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="inline-block bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full">
                    Queue Position #{queuePosition} of {totalWaiting}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    You're in the Waiting Room
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    The interviewer has been notified. When admitted, you will see a 20-second ready countdown and your call will connect automatically.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center space-x-1.5">
                      <Clock size={14} className="text-slate-400" />
                      <span>Estimated Wait:</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {queuePosition === 1 ? 'Next in line (~1-2 mins)' : `~${queuePosition * 10} mins`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center space-x-1.5">
                      <Sparkles size={14} className="text-slate-400" />
                      <span>Candidate:</span>
                    </span>
                    <span className="font-semibold text-slate-900">{name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center space-x-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>Hardware:</span>
                    </span>
                    <span className="text-emerald-700 font-semibold">Ready</span>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
                  <Loader2 size={15} className="animate-spin text-primary" />
                  <span>Waiting for interviewer invitation...</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-xs text-slate-500">
        Racsemi Assessment Platform • Secure Video Conference & Code Evaluation
      </footer>
    </div>
  );
};

export default CandidateLobby;
