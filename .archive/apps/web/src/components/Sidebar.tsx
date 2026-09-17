'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileCode2, 
  BookOpen, 
  Users, 
  BarChart3, 
  ShieldAlert, 
  Settings,
  LogOut,
  Sparkles
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Assessments', href: '/assessments', icon: FileCode2 },
  { name: 'Question Bank', href: '/questions', icon: BookOpen },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
  { name: 'Integrity Logs', href: '/integrity', icon: ShieldAlert },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('racsemi_token');
      localStorage.removeItem('racsemi_user');
      window.location.href = '/login';
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 flex items-center justify-center shadow-sm font-bold text-xl text-white">
          R
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-lg text-gray-900 tracking-tight">
            RACSEMI <span className="text-blue-700 font-semibold text-sm px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">Assess</span>
          </div>
          <p className="text-xs text-gray-500">Technical Assessment Suite</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info & Logout */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            RA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">RACSEMI Admin</p>
            <p className="text-[11px] text-gray-500 truncate">admin@racsemi.com</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
