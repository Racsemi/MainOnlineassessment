import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldAlert, Clock, Loader2, Camera, AlertTriangle, Maximize, Check, Play, Terminal } from 'lucide-react';
import Editor from '@monaco-editor/react';
import api from '../../lib/axios';

const CandidatePortal = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'LOADING' | 'INSTRUCTIONS' | 'CONSENT' | 'TEST' | 'THANK_YOU'>('LOADING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [candidateInfo, setCandidateInfo] = useState<{ name: string; email: string } | null>(null);
  
  // Proctoring States
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use a ref for the stream so the callback always has the latest value
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  
  const headerVideoRef = useRef<HTMLVideoElement | null>(null);
  const headerVideoCallback = React.useCallback((node: HTMLVideoElement | null) => {
    headerVideoRef.current = node;
    if (node && mediaStreamRef.current && node.srcObject !== mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
    }
  }, []);

  const consentVideoCallback = React.useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node as any;
    if (node && mediaStreamRef.current && node.srcObject !== mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  const [executing, setExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  
  const sessionRef = useRef<any>(null);

  // 1. Initial Load
  useEffect(() => {
    const checkToken = async () => {
      try {
        const res = await api.post('/session/check', { token });
        setSessionInfo(res.data);
        // Store candidate info for watermark
        if (res.data.candidate) {
          setCandidateInfo(res.data.candidate);
        }
        if (res.data.status === 'EXPIRED' || res.data.status === 'COMPLETED') {
          setError('This assessment link is no longer valid or has already been completed.');
          setStep('INSTRUCTIONS'); 
        } else {
          // Skip instructions since they agreed prior to registration
          setStep('CONSENT');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to verify assessment token.');
        // Skip instructions since they agreed prior to registration
        setStep('CONSENT');
      }
    };
    checkToken();
  }, [token]);

  // 2. Hardware Checks
  const requestPermissions = async () => {
    setCheckingPermissions(true);
    setPermissionError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionsGranted(true);
    } catch (err) {
      setPermissionError('Camera and Microphone access is strictly required to proceed. Please allow access in your browser settings and try again.');
    } finally {
      setCheckingPermissions(false);
    }
  };

  // Sync media stream to header video when entering TEST mode
  // We use a timeout to ensure the DOM has painted and the ref is attached
  useEffect(() => {
    if (step !== 'TEST') return;
    const attach = () => {
      if (headerVideoRef.current && mediaStreamRef.current) {
        headerVideoRef.current.srcObject = mediaStreamRef.current;
        headerVideoRef.current.play().catch(() => {});
      }
    };
    // Try immediately, then retry after 300ms to handle async render
    attach();
    const t = setTimeout(attach, 300);
    return () => clearTimeout(t);
  }, [step, questions]); // re-run when questions load (that's when header video mounts)

  // 3. Start Test
  const handleStart = async () => {
    if (sessionInfo?.isProctored && !permissionsGranted) {
      setPermissionError("You must grant camera and microphone permissions before starting.");
      return;
    }
    
    setLoading(true);
    try {
      if (sessionInfo?.isProctored) {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullScreen(true);
        } catch (e) {
          console.warn("Fullscreen request failed", e);
        }
      }

      const res = await api.post('/session/start', { token });
      setSession(res.data.session);
      sessionRef.current = res.data.session;
      setAssessment(res.data.assessment);
      // Grab candidate info for watermark (passed via session or top-level)
      if (res.data.candidate) {
        setCandidateInfo({ name: res.data.candidate.name, email: res.data.candidate.email });
      } else if (sessionInfo?.candidate) {
        setCandidateInfo({ name: sessionInfo.candidate.name, email: sessionInfo.candidate.email });
      }
      
      const allQuestions: any[] = [];
      res.data.assessment?.sections?.forEach((sec: any) => {
        // sec.name is the correct field (not sec.title)
        sec.questions?.forEach((q: any) => allQuestions.push({ ...q, isCoding: false, sectionTitle: sec.name || sec.title || 'General' }));
        sec.codingQuestions?.forEach((cq: any) => allQuestions.push({ ...cq, isCoding: true, sectionTitle: sec.name || sec.title || 'General' }));
      });
      setQuestions(allQuestions);
      
      setStep('TEST');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  // 4. Timer Logic
  useEffect(() => {
    if (!session?.expiresAt || step !== 'TEST') return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(session.expiresAt).getTime();
      const diff = expires - now;
      
      if (diff <= 0) {
        clearInterval(interval);
        handleSubmit();
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [session, step]);

  // Prevent Back Navigation
  useEffect(() => {
    if (step !== 'TEST') return;
    
    // Push a dummy state to history so the back button can be intercepted
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      setShowNavigationWarning(true);
      window.history.pushState(null, '', window.location.href); // Push again to trap them
    };
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have an active assessment. Are you sure you want to leave? Your progress will be lost if not submitted.";
      return e.returnValue;
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [step]);

  // 5. Proctoring Integrity Events & Screenshots
  useEffect(() => {
    if (step !== 'TEST' || !sessionInfo?.isProctored) return;

    const captureScreenshot = (): string | undefined => {
      if (!headerVideoRef.current) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = headerVideoRef.current.videoWidth;
      canvas.height = headerVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(headerVideoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.5); // High compression to save space
      }
      return undefined;
    };

    const logEvent = (eventType: string) => {
      if (sessionRef.current?.id) {
        const screenshot = captureScreenshot();
        api.post('/session/integrity', {
          sessionId: sessionRef.current.id,
          eventType,
          screenshot
        }).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        logEvent('TAB_SWITCH');
        setShowTabWarning(true);
      }
    };
    const handleBlur = () => {
      logEvent('WINDOW_BLUR');
      setShowTabWarning(true);
    };
    
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
        logEvent('FULLSCREEN_EXIT');
      } else {
        setIsFullScreen(true);
      }
    };
    
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logEvent('COPY');
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logEvent('PASTE');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [step, sessionInfo?.isProctored]);

  const requestFullscreenResume = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } catch (e) {
      alert("Please allow full-screen mode to resume the assessment.");
    }
  };

  const handlePreventDefault = (e: React.SyntheticEvent) => e.preventDefault();
  const handleCopyPasteEvent = (e: React.ClipboardEvent, type: string) => {
    e.preventDefault();
    if (sessionInfo?.isProctored && sessionRef.current?.id) {
      const canvas = document.createElement('canvas');
      let screenshot = undefined;
      if (headerVideoRef.current) {
        canvas.width = headerVideoRef.current.videoWidth;
        canvas.height = headerVideoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(headerVideoRef.current, 0, 0, canvas.width, canvas.height);
          screenshot = canvas.toDataURL('image/jpeg', 0.5);
        }
      }
      api.post('/session/integrity', { sessionId: sessionRef.current.id, eventType: type, screenshot }).catch(() => {});
    }
  };

  const handleAnswerChange = async (questionId: string, payload: { selectedOptionIds?: string[], textAnswer?: string, language?: string }) => {
    setAnswers(prev => ({ ...prev, [questionId]: payload }));
    try {
      await api.post('/session/answer', {
        sessionId: session.id,
        questionId,
        ...payload,
        isMarkedForReview: false
      });
    } catch (err) {
      console.error('Failed to save answer auto-save');
    }
  };

  const handleCodingChange = (questionId: string, language: string, code: string) => {
    handleAnswerChange(questionId, { language, textAnswer: code });
    if (sessionRef.current?.id) {
      api.post('/session/coding-draft', {
        sessionId: sessionRef.current.id,
        codingQuestionId: questionId,
        language,
        code
      }).catch(() => {});
    }
  };

  const handleRunCode = async () => {
    const currentQ = questions[currentIndex];
    const currentAnswer = answers[currentQ.id] || {};
    
    if (!currentQ?.isCoding) return;
    setExecuting(true);
    setExecutionResults([]);
    try {
      const res = await api.post('/session/execute', {
        language: currentAnswer.language || currentQ.allowedLanguages?.[0] || 'PYTHON',
        code: currentAnswer.textAnswer || '',
        testCases: currentQ.testCases || []
      });
      setExecutionResults(res.data.results);
    } catch (err: any) {
      console.error(err);
      setExecutionResults([{ passed: false, actualOutput: err.response?.data?.error || 'Execution Error', expectedOutput: '' }]);
    } finally {
      setExecuting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      await api.post('/session/submit', { sessionId: session?.id });
      setStep('THANK_YOU');
    } catch (err) {
      console.error(err);
      alert("Failed to submit assessment.");
    }
  };

  if (step === 'THANK_YOU') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-lg w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-bold text-dark mb-3">Assessment Complete!</h1>
          <p className="text-gray-600 mb-6 text-base">
            Thank you for completing the assessment. Your responses have been successfully recorded and submitted.
          </p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <p className="text-blue-800 font-medium">
              You may now safely close this window or tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'LOADING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }


  if (step === 'CONSENT') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-3">
        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-full">
          <>
            <h1 className="text-xl font-bold text-dark mb-1">System Readiness Check</h1>
            <p className="text-gray-500 mb-4 text-sm">We need to verify your system is ready for the assessment.</p>
            
            {error && (
              <div className="mb-4 bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg flex items-center space-x-2 text-sm">
                <AlertTriangle size={20} />
                <p className="font-bold">{error}</p>
              </div>
            )}
            
            {sessionInfo?.isProctored && (
              <>
                <div className="flex items-center space-x-3 text-warning mb-6 bg-warning/10 p-4 rounded-lg border border-warning/20">
                  <ShieldAlert size={28} />
                  <h2 className="text-lg font-bold">Strict Proctoring Enabled</h2>
                </div>
                
                <div className="prose text-gray-600 mb-8 text-sm">
                  <p>To proceed, please grant the necessary permissions below. Your camera will remain active during the test.</p>
                </div>

                {!permissionsGranted ? (
                  <div className="mb-8 p-6 border-2 border-dashed border-gray-200 rounded-xl text-center bg-gray-50">
                    <Camera size={32} className="mx-auto text-gray-400 mb-3" />
                    <h3 className="font-bold text-dark mb-2">System Hardware Check</h3>
                    <p className="text-sm text-gray-500 mb-4">We need to verify your camera and microphone are working.</p>
                    
                    {permissionError && (
                      <p className="text-xs text-danger mb-3 bg-danger/10 p-2 rounded">{permissionError}</p>
                    )}
                    
                    <button 
                      onClick={requestPermissions}
                      disabled={checkingPermissions}
                      className="bg-dark hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center space-x-2 mx-auto"
                    >
                      {checkingPermissions && <Loader2 size={16} className="animate-spin" />}
                      <span>Grant Camera & Mic Access</span>
                    </button>
                  </div>
                ) : (
                  <div className="mb-8 flex flex-col items-center p-6 border border-success/20 rounded-xl bg-success/5">
                    <div className="w-48 h-36 bg-black rounded-lg overflow-hidden mb-3 border border-success shadow-sm">
                      <video 
                        ref={consentVideoCallback} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-success text-center font-bold flex items-center justify-center space-x-2 text-sm">
                      <ShieldAlert size={16} />
                      <span>System checks passed. Hardware is working.</span>
                    </div>
                  </div>
                )}
              </>
            )}
            
            <button 
              onClick={handleStart}
              disabled={loading || (sessionInfo?.isProctored && !permissionsGranted)}
              className="w-full bg-primary hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow"
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              <span>{loading ? 'Starting...' : 'I Understand & Start Assessment'}</span>
            </button>
          </>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ?.id] || {};
  
  // Group questions by section for the sidebar
  const sectionsObj = questions.reduce((acc, q, i) => {
    const sec = q.sectionTitle || 'General';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push({ ...q, originalIndex: i });
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div 
      className="min-h-screen bg-gray-50 flex flex-col select-none relative"
      onCopy={e => handleCopyPasteEvent(e, 'COPY')}
      onPaste={e => handleCopyPasteEvent(e, 'PASTE')}
      onCut={e => handleCopyPasteEvent(e, 'CUT')}
      onContextMenu={handlePreventDefault}
    >
      {/* Diagonal watermark overlay - fixed: flat array so React renders correctly */}
      {candidateInfo && (
        <div
          className="absolute inset-0 z-[5] pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          {Array.from({ length: 30 }).map((_, idx) => {
            const row = Math.floor(idx / 5);
            const col = idx % 5;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  top: `${row * 20 - 5}%`,
                  left: `${col * 25 - 5}%`,
                  transform: 'rotate(-30deg)',
                  opacity: 0.08,
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#000',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  lineHeight: '2'
                }}
              >
                {candidateInfo.name}<br/>{candidateInfo.email}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Screen Enforcement Overlay */}
      {sessionInfo?.isProctored && !isFullScreen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full flex flex-col items-center">
            <AlertTriangle size={48} className="text-danger mb-3" />
            <h2 className="text-xl font-bold text-dark mb-2">Full Screen Exited</h2>
            <p className="text-gray-600 mb-5 text-sm">
              You have left full-screen mode. This is a violation of the proctoring rules and your screen has been flagged. 
              You must return to full-screen mode to resume the assessment.
            </p>
            <button 
              onClick={requestFullscreenResume}
              className="bg-primary hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center space-x-3 transition-colors w-full justify-center"
            >
              <Maximize size={24} />
              <span>Return to Full Screen</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Warning Overlay */}
      {showTabWarning && sessionInfo?.isProctored && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center border-4 border-danger">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={36} />
            </div>
            <h2 className="text-xl font-bold text-dark mb-3">Warning: Activity Logged</h2>
            <p className="text-gray-600 mb-5 text-sm font-medium">
              You have switched tabs or lost focus on this window. This is a strict violation of the assessment rules.
              Your action has been recorded and flagged for review. Repeated violations may result in immediate disqualification.
            </p>
            <button 
              onClick={() => setShowTabWarning(false)}
              className="bg-danger hover:bg-red-700 text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors w-full shadow-md hover:shadow-lg"
            >
              I Understand. Return to Test.
            </button>
          </div>
        </div>
      )}

      {/* Navigation Warning Overlay */}
      {showNavigationWarning && (
        <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center border-2 border-warning">
            <div className="w-16 h-16 bg-warning/10 text-warning-dark rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-dark mb-2">Navigation Blocked</h2>
            <p className="text-gray-600 mb-6 font-medium">
              You cannot go back during an active assessment. If you have finished the assessment, please click "Submit".
            </p>
            <div className="flex flex-col space-y-3 w-full">
              <button 
                onClick={() => setShowNavigationWarning(false)}
                className="bg-gray-100 hover:bg-gray-200 text-dark px-6 py-3 rounded-xl font-bold transition-colors w-full"
              >
                Continue Assessment
              </button>
              <button 
                onClick={() => {
                  setShowNavigationWarning(false);
                  handleSubmit();
                }}
                className="bg-success hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-colors w-full"
              >
                Submit Assessment Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Overlay */}
      {showSubmitConfirm && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 animate-fade-in-up">
            <h2 className="text-xl font-bold text-dark mb-3">Submit Assessment?</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Are you sure you want to submit your assessment? You will not be able to change your answers after submission.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }}
                className="bg-success hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold shadow-md transition-colors text-sm"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center sticky top-0 z-10 shadow-sm h-14">
        <div className="flex-1">
          <h1 className="text-base font-bold text-dark truncate pr-4">{assessment?.title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-warning font-mono bg-warning/10 px-3 py-1.5 rounded-lg font-bold text-base">
            <Clock size={16} className="mr-2" />
            {timeLeft}
          </div>
          
          {sessionInfo?.isProctored && (
            <div className="w-20 h-10 bg-black rounded overflow-hidden border border-gray-300 shadow-sm flex-shrink-0">
              <video 
                ref={headerVideoCallback} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <button onClick={() => setShowSubmitConfirm(true)} className="bg-success hover:bg-green-700 text-white px-5 py-1.5 text-sm rounded-lg font-bold transition-colors shadow-sm flex-shrink-0">
            Submit
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className={`flex-1 flex max-w-screen-2xl mx-auto w-full p-4 gap-4 ${(!isFullScreen && sessionInfo?.isProctored) ? 'pointer-events-none opacity-50' : ''}`}>
        
        {/* Left Navigation */}
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 p-3 h-fit sticky top-20 overflow-y-auto max-h-[calc(100vh-5rem)]">
          {Object.entries(sectionsObj).map(([secTitle, qList], secIdx) => (
            <div key={secIdx} className="mb-6 last:mb-0">
              <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">
                {secTitle}
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {(qList as any[]).map((q: any) => {
                  const ans = answers[q.id];
                  const isAnswered = ans && (ans.selectedOptionIds?.length > 0 || !!ans.textAnswer);
                  const isCurrent = q.originalIndex === currentIndex;
                  let btnClass = 'bg-gray-50 text-gray-500 hover:bg-gray-200 border border-gray-200';
                  if (isCurrent) btnClass = 'bg-primary text-white shadow-md border-primary';
                  else if (isAnswered) btnClass = 'bg-success/10 text-success border border-success/40 font-bold';
                  
                  return (
                    <button 
                      key={q.id}
                      onClick={() => setCurrentIndex(q.originalIndex)}
                      className={`aspect-square flex items-center justify-center rounded-lg font-medium text-sm transition-all ${btnClass}`}
                    >
                      {q.originalIndex + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Question Area */}
        {currentQ ? (
          currentQ.isCoding ? (
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex overflow-hidden max-h-[calc(100vh-5rem)]">
              {/* Split Left: Description */}
              <div className="w-1/3 p-4 border-r border-gray-200 overflow-y-auto bg-gray-50 flex flex-col relative">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-dark">Question {currentIndex + 1}</h2>
                  <span className="text-[10px] font-bold text-white bg-primary px-2 py-0.5 rounded">CODING</span>
                </div>
                
                <h3 className="text-base font-bold mb-3">{currentQ.title}</h3>
                <div className="prose max-w-none text-gray-700 text-xs mb-4 whitespace-pre-wrap">
                  {currentQ.description}
                </div>
                
                {currentQ.constraints && (
                  <div className="bg-white p-4 rounded-lg mb-6 border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-sm text-gray-800 mb-2">Constraints</h4>
                    <p className="font-mono text-sm text-gray-600">{currentQ.constraints}</p>
                  </div>
                )}
                
                {/* Navigation at bottom of left pane */}
                <div className="mt-auto pt-6 border-t border-gray-200 flex justify-between">
                  <button 
                    onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setExecutionResults([]); }}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => { setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1)); setExecutionResults([]); }}
                    disabled={currentIndex === questions.length - 1}
                    className="bg-dark hover:bg-black text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
              
              {/* Split Right: IDE */}
              <div className="w-2/3 flex flex-col bg-[#1e1e1e]">
                {/* IDE Toolbar */}
                <div className="h-14 bg-[#2d2d2d] border-b border-gray-800 flex items-center justify-between px-4">
                  <div className="flex items-center space-x-4">
                    <select 
                      value={currentAnswer.language || (currentQ.allowedLanguages && currentQ.allowedLanguages[0]) || 'PYTHON'}
                      onChange={(e) => handleCodingChange(currentQ.id, e.target.value, currentAnswer.textAnswer || '')}
                      className="bg-[#3c3c3c] text-white px-3 py-1.5 border border-gray-600 rounded text-sm focus:outline-none focus:border-primary"
                    >
                      {(currentQ.allowedLanguages || ['PYTHON', 'JAVA', 'CPP', 'JS']).map((lang: string) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-400 font-mono flex space-x-3">
                      <span>⏱️ {currentQ.timeLimit}ms</span>
                      <span>💾 {currentQ.memoryLimit}MB</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleRunCode}
                    disabled={executing}
                    className="bg-success hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center space-x-2 transition-colors disabled:opacity-50"
                  >
                    {executing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    <span>Run Code</span>
                  </button>
                </div>
                
                {/* Monaco Editor */}
                <div className="flex-1 min-h-[300px]">
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={(currentAnswer.language || currentQ.allowedLanguages?.[0] || 'PYTHON').toLowerCase().replace('cpp', 'cpp').replace('js', 'javascript')}
                    value={currentAnswer.textAnswer || ''}
                    onChange={(val) => handleCodingChange(currentQ.id, currentAnswer.language || currentQ.allowedLanguages?.[0] || 'PYTHON', val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true
                    }}
                  />
                </div>
                
                {/* Execution Results Terminal */}
                <div className="h-48 bg-[#1e1e1e] border-t border-gray-800 p-0 flex flex-col">
                  <div className="bg-[#2d2d2d] px-4 py-1 border-b border-gray-800 text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-2">
                    <Terminal size={14} />
                    <span>Test Results Console</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-sm text-gray-300">
                    {executing ? (
                      <div className="flex items-center space-x-2 text-primary">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Running tests remotely via Piston execution engine...</span>
                      </div>
                    ) : executionResults.length > 0 ? (
                      <div className="space-y-4">
                        {executionResults.map((res: any, idx: number) => (
                          <div key={idx} className={`p-3 rounded border ${res.passed ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>
                            <div className="font-bold mb-1 flex items-center space-x-2">
                              {res.passed ? <span className="text-success flex items-center"><Check size={14} className="mr-1"/> Test {idx + 1} Passed</span> : <span className="text-danger flex items-center"><AlertTriangle size={14} className="mr-1"/> Test {idx + 1} Failed</span>}
                              {res.isHidden && <span className="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-400">Hidden</span>}
                            </div>
                            {!res.passed && !res.isHidden && (
                              <div className="mt-2 text-xs space-y-2">
                                <div><span className="text-gray-500">Input:</span><br/><span className="text-white bg-black/50 px-2 py-1 rounded block mt-1">{res.input}</span></div>
                                <div><span className="text-gray-500">Expected:</span><br/><span className="text-success bg-black/50 px-2 py-1 rounded block mt-1">{res.expectedOutput}</span></div>
                                <div><span className="text-gray-500">Actual:</span><br/><span className="text-danger bg-black/50 px-2 py-1 rounded block mt-1">{res.actualOutput || '(no output)'}</span></div>
                              </div>
                            )}
                            {!res.passed && res.isHidden && (
                              <div className="mt-2 text-xs text-gray-500">
                                This is a hidden test case. Output details are suppressed.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-600 italic">No execution results yet. Click "Run Code" to test your solution.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-dark">Question {currentIndex + 1}</h2>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {currentQ.type.replace('_', ' ')}
                </span>
              </div>
              
              <div className="prose max-w-none text-dark mb-6 text-base">
                <p className="font-medium">{currentQ.text}</p>
              </div>
              
              <div className="space-y-3 flex-1 flex flex-col">

            {!currentQ.isCoding && currentQ.type === 'SINGLE_CHOICE' && currentQ.options?.map((opt: any) => (
              <label key={opt.id} className="flex items-center p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-primary/50 transition-all bg-gray-50 hover:bg-white group">
                <input 
                  type="radio" 
                  name={`q-${currentQ.id}`} 
                  checked={currentAnswer.selectedOptionIds?.[0] === opt.id}
                  onChange={() => handleAnswerChange(currentQ.id, { selectedOptionIds: [opt.id] })}
                  className="w-5 h-5 text-primary focus:ring-primary border-gray-300" 
                />
                <span className="ml-4 text-gray-700 font-medium group-hover:text-dark">{opt.text}</span>
              </label>
            ))}

            {currentQ.type === 'MULTIPLE_CHOICE' && currentQ.options?.map((opt: any) => (
              <label key={opt.id} className="flex items-center p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-primary/50 transition-all bg-gray-50 hover:bg-white group">
                <input 
                  type="checkbox" 
                  checked={currentAnswer.selectedOptionIds?.includes(opt.id) || false}
                  onChange={(e) => {
                    const currentSelected = currentAnswer.selectedOptionIds || [];
                    const newSelected = e.target.checked 
                      ? [...currentSelected, opt.id] 
                      : currentSelected.filter((id: string) => id !== opt.id);
                    handleAnswerChange(currentQ.id, { selectedOptionIds: newSelected });
                  }}
                  className="w-5 h-5 text-primary focus:ring-primary border-gray-300 rounded" 
                />
                <span className="ml-4 text-gray-700 font-medium group-hover:text-dark">{opt.text}</span>
              </label>
            ))}

            {(currentQ.type === 'SINGLE_LINE' || currentQ.type === 'NUMERIC') && (
              <input 
                type={currentQ.type === 'NUMERIC' ? "number" : "text"}
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => handleAnswerChange(currentQ.id, { textAnswer: e.target.value })}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-lg"
                placeholder={currentQ.type === 'NUMERIC' ? "Enter a number..." : "Enter your answer..."}
              />
            )}

            {currentQ.type === 'PARAGRAPH' && (
              <textarea 
                rows={8}
                value={currentAnswer.textAnswer || ''}
                onChange={(e) => handleAnswerChange(currentQ.id, { textAnswer: e.target.value })}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white transition-colors text-lg leading-relaxed resize-y"
                placeholder="Type your detailed answer here..."
              />
            )}

            {currentQ.type === 'TRUE_FALSE' && (
              <div className="flex space-x-6 mt-2">
                {['True', 'False'].map(opt => (
                  <label key={opt} className="flex items-center p-5 border border-gray-200 rounded-xl cursor-pointer hover:border-primary/50 transition-all min-w-[160px] bg-gray-50 hover:bg-white group">
                    <input 
                      type="radio" 
                      name={`q-${currentQ.id}`} 
                      checked={currentAnswer.textAnswer === opt}
                      onChange={() => handleAnswerChange(currentQ.id, { textAnswer: opt })}
                      className="w-5 h-5 text-primary focus:ring-primary border-gray-300" 
                    />
                    <span className="ml-4 text-gray-700 font-bold group-hover:text-dark">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => { setCurrentIndex(prev => Math.max(0, prev - 1)); setExecutionResults([]); }}
                  disabled={currentIndex === 0}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                >
                  Previous
                </button>
                {currentIndex === questions.length - 1 ? (
                  <button 
                    onClick={() => setShowSubmitConfirm(true)}
                    className="bg-success hover:bg-green-700 text-white px-8 py-2 rounded-xl font-bold transition-colors shadow-sm text-sm"
                  >
                    Submit Assessment
                  </button>
                ) : (
                  <button 
                    onClick={() => { setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1)); setExecutionResults([]); }}
                    className="bg-dark hover:bg-black text-white px-8 py-2 rounded-xl font-bold transition-colors shadow-sm text-sm"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex justify-center items-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            No questions available for this assessment.
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidatePortal;
