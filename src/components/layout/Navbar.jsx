import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, LogOut, Mic, Settings, ShieldCheck } from 'lucide-react';
import { isDemoMode } from '../../services/api';

const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };

export default function Navbar({
  user,
  activePage,
  showBack = false,
  title,
  onBack,
  onNavigate,
  onLogout,
  onStartNewMeeting,
}) {
  const demo = isDemoMode();

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* Left: Back or Brand */}
        <div className="flex items-center gap-2 min-w-0">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-w-[2.75rem] min-h-[2.75rem] -ml-1.5 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Mic className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-sm font-extrabold tracking-tight text-slate-900 block">
                  Notulis
                </span>
                <span className="text-[0.65rem] font-medium text-slate-500 hidden sm:block">
                  AI Meeting Minutes
                </span>
              </div>
            </button>
          )}

          {showBack && title && (
            <h1 className="text-sm font-bold text-slate-900 truncate">{title}</h1>
          )}
        </div>

        {/* Center Desktop Navigation with Sliding Active Pill */}
        {!showBack && (
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/70">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${activePage === 'dashboard'
                  ? 'text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {activePage === 'dashboard' && (
                <motion.span
                  layoutId="desktopNavPill"
                  transition={PILL_SPRING}
                  className="absolute inset-0 bg-white border border-blue-100 rounded-xl shadow-xs"
                />
              )}
              <FileText className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Daftar Rapat</span>
            </button>

            <button
              type="button"
              onClick={onStartNewMeeting}
              className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Rapat Baru</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${activePage === 'settings'
                  ? 'text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {activePage === 'settings' && (
                <motion.span
                  layoutId="desktopNavPill"
                  transition={PILL_SPRING}
                  className="absolute inset-0 bg-white border border-blue-100 rounded-xl shadow-xs"
                />
              )}
              <Settings className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Kop & Akun</span>
            </button>
          </nav>
        )}

        {/* Right: Mode badge + User + Logout */}
        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${demo
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            title={
              demo
                ? 'Berjalan di Mode Demo Lokal (VITE_GAS_WEBAPP_URL belum diatur)'
                : 'Terhubung ke Google Apps Script'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${demo ? 'bg-amber-500' : 'bg-emerald-500'}`}
            />
            {demo ? 'Mode Demo' : 'GAS Live'}
          </span>

          {user && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 transition cursor-pointer"
            >
              {user.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
              <span className="text-xs font-semibold text-slate-700 max-w-[9rem] truncate">
                {user.fullName}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="min-w-[2.625rem] min-h-[2.625rem] px-2.5 flex items-center justify-center gap-1.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline text-xs font-semibold">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
