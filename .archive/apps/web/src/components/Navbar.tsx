'use client';

import React from 'react';
import { Search, Bell, ShieldCheck, Sparkles } from 'lucide-react';

export default function Navbar({ title }: { title?: string }) {
  return (
    <header className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">
          {title || 'Dashboard Overview'}
        </h1>
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Isolated Sandbox Active
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidates, tests, questions..."
            className="w-72 bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 bg-blue-600 rounded-full absolute top-1.5 right-1.5 border border-white"></span>
        </button>

        {/* Role Pill */}
        <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-blue-500" /> Organization: RACSEMI
        </div>
      </div>
    </header>
  );
}
