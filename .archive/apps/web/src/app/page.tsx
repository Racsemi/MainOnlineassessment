'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('racsemi_token');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
      Redirecting to RACSEMI Assess...
    </div>
  );
}
