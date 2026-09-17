import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileQuestion, LogOut, Settings, Zap, Loader2 } from 'lucide-react';
import api from '../../lib/axios';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data.user.role !== 'ADMIN') {
          navigate('/login');
        } else {
          setLoading(false);
        }
      } catch {
        // Axios interceptor will handle the redirect, but we set loading false here just in case
        navigate('/login');
      }
    };
    verifyAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    navigate('/login');
  };

  const navItems = [
    { name: 'Assessments', path: '/admin/assessments', icon: <LayoutDashboard size={18} /> },
    { name: 'Question Bank', path: '/admin/questions', icon: <FileQuestion size={18} /> },
    { name: 'Candidates', path: '/admin/candidates', icon: <Users size={18} /> },
    { name: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col flex-shrink-0" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0c1220 100%)' }}>
        
        {/* Brand */}
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">RACSEMI</h1>
              <p className="text-xs text-slate-500">Assessment Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Menu</p>
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className={isActive ? 'text-primary-light' : 'text-slate-500'}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="nav-item w-full hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={18} className="text-slate-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background animate-fade-in-up">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
