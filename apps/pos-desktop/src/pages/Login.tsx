import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { apiClient } from '../lib/api-client';
import { Lock, User, Keypad, Store, ChevronRight, Loader2 } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState<'staff_pin' | 'email_password'>('staff_pin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Form states
  const [staffNumber, setStaffNumber] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = mode === 'staff_pin' 
        ? { mode, staffNumber, pin } 
        : { mode, email, password };

      const data = await apiClient('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await login(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 selection:bg-brand-500/30">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-0 -right-4 w-72 h-72 bg-brand-700 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Card */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 p-0.5 mb-4 shadow-lg shadow-brand-500/20">
              <div className="w-full h-full bg-neutral-900 rounded-[14px] flex items-center justify-center">
                <Store className="w-8 h-8 text-brand-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Hammielion</h1>
            <p className="text-neutral-500 mt-2 font-medium">Petshop Management System</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex p-1 bg-black/40 rounded-xl mb-8 border border-white/5">
            <button 
              onClick={() => setMode('staff_pin')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'staff_pin' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Staff PIN
            </button>
            <button 
              onClick={() => setMode('email_password')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'email_password' ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Email Login
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'staff_pin' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Staff Number</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-brand-400 transition-colors" />
                    <input 
                      type="text"
                      value={staffNumber}
                      onChange={(e) => setStaffNumber(e.target.value)}
                      placeholder="ADM001"
                      className="w-full bg-neutral-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">PIN</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-brand-400 transition-colors" />
                    <input 
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••••"
                      className="w-full bg-neutral-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-700 tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-brand-400 transition-colors" />
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@hammielion.com"
                      className="w-full bg-neutral-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-brand-400 transition-colors" />
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-neutral-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold py-4 rounded-2xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-neutral-600">
            &copy; 2026 Hammielion. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
