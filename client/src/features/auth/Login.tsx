import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Zap, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../lib/axios';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password });
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      
      {/* Left — Hero Panel */}
      <div className="hidden lg:flex flex-col flex-1 items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)' }}>
        
        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />

        <div className="relative z-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">RACSEMI</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Professional Online Assessment Platform for modern hiring and education.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Assessments', value: '∞' },
              { label: 'Secure', value: '🔒' },
              { label: 'AI Ready', value: '⚡' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center border border-white/10"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-2xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm animate-fade-in-up">
          
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Zap size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-dark">RACSEMI</h1>
          </div>

          <h2 className="text-2xl font-bold text-dark mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your admin account</p>

          {error && (
            <div className="mb-5 flex items-start space-x-3 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="form-label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="form-input pl-10"
                  placeholder="name@company.com" />
              </div>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="form-input pl-10"
                  placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center space-x-2 py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /><span>Signing in…</span></>
                : <><span>Sign In</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} RACSEMI Assessment Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
