import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, ShieldCheck, AlertCircle, Zap, Camera, Check } from 'lucide-react';
import api from '../../lib/axios';

const PublicRegistration = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [step, setStep] = useState<'RULES' | 'FORM'>('RULES');

  // Camera State
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [filesData, setFilesData] = useState<Record<string, { fileName: string, fileData: string }>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const res = await api.get(`/assessments/public/${id}`);
        setAssessment(res.data);
      } catch {
        setError('Assessment not found or is no longer available.');
      } finally {
        setLoading(false);
      }
    };
    fetchAssessment();
  }, [id]);

  useEffect(() => {
    // Cleanup stream on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setError('');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera access requires a secure connection (HTTPS) or localhost. Please contact the administrator.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setCameraActive(true);
      // We must use a timeout to let React render the video element if it wasn't there
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setError('Camera access is required to take your photo. Please allow camera permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !agreedToTerms) return;
    if (!photo) {
      setError('Please capture your photo before proceeding.');
      return;
    }
    
    setRegistering(true);
    setError('');
    try {
      const payload = {
        assessmentId: id, name, email,
        phone: customData.phone, college: customData.college,
        branch: customData.branch,
        cgpa: customData.cgpa ? parseFloat(customData.cgpa) : null,
        photo,
        customFields: customData,
        files: filesData
      };
      const res = await api.post('/candidates/register', payload);
      navigate(`/test/${res.data.token}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-slate-400 text-sm">Loading assessment…</span>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto text-danger mb-4" />
          <h2 className="text-2xl font-bold text-dark mb-2">Unavailable</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'RULES') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
        </div>
        
        <div className="bg-white/95 backdrop-blur-md max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col z-10 animate-fade-in-up max-h-[90vh]">
          <div className="px-8 py-6 border-b border-gray-200 shrink-0" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.1), rgba(139,92,246,0.05))' }}>
            <h1 className="text-2xl font-bold text-dark">{assessment.title}</h1>
            <p className="text-gray-600 mt-1">Assessment Rules and Instructions</p>
          </div>
          
          <div className="p-8 flex-1 overflow-y-auto space-y-8">
            {assessment.settings?.instructions && (
              <section>
                <h2 className="text-xl font-bold text-dark mb-4 border-b pb-2">Instructions</h2>
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: assessment.settings.instructions.replace(/\n/g, '<br/>') }} />
              </section>
            )}
            {assessment.settings?.rules && (
              <section>
                <h2 className="text-xl font-bold text-dark mb-4 border-b pb-2">Rules & Guidelines</h2>
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: assessment.settings.rules.replace(/\n/g, '<br/>') }} />
              </section>
            )}
            
            <div className="bg-warning/10 border border-warning/30 p-5 rounded-xl mt-8">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={agreedToTerms} 
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-sm font-bold text-gray-800 leading-relaxed">
                  I have read and understood all the instructions and rules. I agree to abide by them and understand that any violation may result in disqualification.
                </span>
              </label>
            </div>
          </div>
          
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
            <button 
              disabled={!agreedToTerms}
              onClick={() => setStep('FORM')}
              className="bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <span>Proceed to Registration</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      </div>

      <div className="w-full max-w-5xl relative z-10 animate-fade-in-up">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
          
          {/* Hero Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.1), rgba(139,92,246,0.05))' }}>
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Zap size={16} className="text-white" />
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Online Assessment Registration</span>
            </div>
            <h1 className="text-2xl font-bold text-dark mb-1">{assessment.title}</h1>
            {assessment.description && (
              <p className="text-gray-600 text-sm max-w-3xl leading-relaxed">{assessment.description}</p>
            )}
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Left Column: Instructions & Camera */}
            <div className="md:w-5/12 bg-gray-50 border-r border-gray-200 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-dark mb-4">Step 1: Identity Verification</h3>
              <p className="text-sm text-gray-500 mb-6">
                Please capture a clear photo of your face. Make sure you are in a well-lit environment and looking directly at the camera.
              </p>
              
              <div className="flex-1 flex flex-col items-center justify-center">
                {!photo && !cameraActive ? (
                  <div className="w-full aspect-video bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-6 text-center">
                    <Camera size={40} className="text-gray-400 mb-3" />
                    <p className="font-bold text-gray-600 mb-4">Camera access required</p>
                    <button type="button" onClick={startCamera} className="bg-primary text-white font-medium rounded-lg text-sm px-6 py-2.5 shadow hover:bg-blue-700 transition-colors">
                      Start Camera
                    </button>
                  </div>
                ) : cameraActive ? (
                  <div className="w-full relative">
                    <video ref={videoRef} className="w-full rounded-xl bg-black shadow-md border-2 border-primary" autoPlay playsInline muted />
                    <div className="mt-4 flex justify-center">
                      <button type="button" onClick={capturePhoto} className="bg-primary hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-md transition-colors flex items-center space-x-2">
                        <Camera size={18} />
                        <span>Capture Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full relative">
                    <div className="relative rounded-xl overflow-hidden shadow-md border-2 border-success">
                      <img src={photo!} alt="Candidate" className="w-full object-cover" />
                      <div className="absolute top-3 right-3 bg-green-500 text-white p-1.5 rounded-full shadow-lg">
                        <Check size={16} strokeWidth={3} />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <button type="button" onClick={retakePhoto} className="text-sm font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 py-2 px-6 rounded-lg transition-colors">
                        Retake Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 bg-blue-50 border border-blue-100 p-3 rounded-xl text-xs text-blue-800">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Remove hats or sunglasses.</li>
                  <li>Ensure your face is clearly visible.</li>
                  <li>Photo is required to start the assessment.</li>
                </ul>
              </div>
            </div>

            {/* Right Column: Form */}
            <div className="md:w-7/12 p-6 pb-16 bg-white">
              <h3 className="text-base font-bold text-dark mb-1">Step 2: Candidate Details</h3>
              <p className="text-xs text-gray-500 mb-5">Please fill in your details accurately to proceed.</p>

              {error && (
                <div className="mb-4 flex items-center space-x-2 bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-sm">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)}
                      className="form-input" placeholder="e.g. Jane Smith" />
                  </div>
                  <div>
                    <label className="form-label">Email Address <span className="text-red-500">*</span></label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="form-input" placeholder="jane@example.com" />
                  </div>

                  {assessment.settings?.registrationForm && Array.isArray(assessment.settings.registrationForm) &&
                    assessment.settings.registrationForm.map((field: any) => (
                      <div key={field.id} className={field.type === 'paragraph' ? 'md:col-span-2' : ''}>
                        <label className="form-label">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                        {field.type === 'select' ? (
                          <select required={field.required} value={customData[field.name] || ''}
                            onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                            className="form-input">
                            <option value="">Select…</option>
                            {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : field.type === 'radio' ? (
                          <div className="flex flex-wrap gap-3 mt-1">
                            {field.options?.map((opt: string) => (
                              <label key={opt} className={`flex items-center space-x-2 px-4 py-2 border rounded-lg cursor-pointer text-sm transition-all ${customData[field.name] === opt ? 'border-primary bg-indigo-50 text-primary font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                <input type="radio" name={field.name} value={opt} required={field.required}
                                  checked={customData[field.name] === opt}
                                  onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                                  className="sr-only" />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : field.type === 'file' ? (
                          <input type="file" required={field.required}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) {
                                  setError(`${field.label} must be less than 2MB`);
                                  e.target.value = '';
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFilesData(prev => ({ ...prev, [field.name]: { fileName: file.name, fileData: reader.result as string } }));
                                  setCustomData({ ...customData, [field.name]: file.name });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="form-input p-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                        ) : (
                          <input type={field.type === 'number' ? 'number' : 'text'} required={field.required}
                            value={customData[field.name] || ''}
                            onChange={e => setCustomData({ ...customData, [field.name]: e.target.value })}
                            className="form-input" />
                        )}
                      </div>
                    ))
                  }
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mt-5">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${agreedToTerms ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
                      onClick={() => setAgreedToTerms(v => !v)}>
                      {agreedToTerms && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" required checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="sr-only" />
                    <span className="text-xs text-gray-700 leading-relaxed">
                      I agree to the <span className="text-primary font-semibold">Terms and Conditions</span> and acknowledge that my information and photo will be processed in accordance with the Privacy Policy. I confirm my identity is accurate.
                    </span>
                  </label>
                </div>

                <button type="submit" disabled={registering || !agreedToTerms || !photo}
                  className="bg-primary hover:bg-blue-700 text-white text-base font-bold w-full flex items-center justify-center space-x-2 py-3 rounded-xl shadow hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-4">
                  {registering
                    ? <><Loader2 size={18} className="animate-spin" /><span>Registering…</span></>
                    : <><span>Begin Assessment</span><ArrowRight size={18} /></>
                  }
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-400 font-medium">
                <ShieldCheck size={16} />
                <span>End-to-End Encrypted & Secured</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicRegistration;
