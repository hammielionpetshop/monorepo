import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Store, User, LogOut, Clock, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const POSHeader: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 z-10">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-brand-400">
          <Store className="w-5 h-5" />
          <span className="font-bold text-lg tracking-tight">Hammielion</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10 mx-2" />
        <div className="flex flex-col">
          <span className="text-xs text-neutral-500 font-medium leading-none mb-1">CABANG</span>
          <span className="text-sm font-semibold leading-none">{user?.branch || 'Utama'}</span>
        </div>
      </div>

      <div className="flex items-center space-x-8">
        {/* Clock & Status */}
        <div className="flex items-center space-x-6 text-neutral-400">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={cn("text-xs font-bold uppercase tracking-wider", isOnline ? "text-emerald-500/80" : "text-red-500/80")}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-4 group">
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold leading-none mb-1">{user?.name}</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">{user?.role}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center group-hover:bg-neutral-700 transition-colors">
            <User className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          </div>
          <button 
            onClick={logout}
            className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
