'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@racsemi.com');
  const [password, setPassword] = useState('Admin@123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    setLoading(false);

    if (res.success && res.token) {
      setSuccess('Authenticated successfully! Redirecting...');
      localStorage.setItem('racsemi_token', res.token);
      localStorage.setItem('racsemi_user', JSON.stringify(res.user));
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } else {
      setError(res.message || 'Invalid email or password');
    }
  };

  const handleQuickDemoFill = () => {
    setEmail('admin@racsemi.com');
    setPassword('Admin@123456');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-100 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-blue-50 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 shadow-sm mb-4 text-3xl font-extrabold text-white">
            R
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            RACSEMI <span className="text-blue-600">Assess</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Enterprise Technical Assessment & Recruitment Platform
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recruiter / Admin Portal</h2>
              <p className="text-xs text-gray-500">Sign in to manage assessments and review results</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@racsemi.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Button */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1.5 font-medium py-1 px-2.5 rounded-lg bg-blue-50 border border-blue-200"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto-fill Demo Admin Credentials
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          © {new Date().getFullYear()} RACSEMI Inc. All rights reserved. Confidential & Proprietary.
        </p>
      </div>
    </div>
  );
}
