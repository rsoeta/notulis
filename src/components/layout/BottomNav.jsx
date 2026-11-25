import React from 'react';
import { motion } from 'motion/react';
import { Building2, FileText, Mic, User } from 'lucide-react';

const PILL_SPRING = { type: 'spring', stiffness: 440, damping: 32, mass: 0.8 };

export default function BottomNav({
  activePage,
  activeSettingsSubTab = 'kop',
  onNavigate,
  onStartNewMeeting,
}) {
  const isDashboard = activePage === 'dashboard';
  const isKop = activePage === 'settings' && activeSettingsSubTab === 'kop';
  const isAccount = activePage === 'settings' && activeSettingsSubTab !== 'kop';

  return (
    <nav
      className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-2 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigasi Utama"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`relative flex flex-col items-center justify-center min-w-[4rem] min-h-[3rem] px-2.5 rounded-xl gap-0.5 text-[0.6875rem] font-semibold transition-colors cursor-pointer ${
            isDashboard ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isDashboard && (
            <motion.span
              layoutId="bottomNavPill"
              transition={PILL_SPRING}
              className="absolute inset-0 bg-blue-50 border border-blue-100 rounded-xl"
            />
          )}
          <FileText className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Rapat</span>
        </button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={onStartNewMeeting}
          className="flex items-center justify-center min-w-[3.25rem] min-h-[3.25rem] -mt-4 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-colors cursor-pointer gap-1.5"
          aria-label="Rekam Rapat Baru"
        >
          <Mic className="w-5 h-5" />
          <span className="text-xs font-bold">Rekam</span>
        </motion.button>

        <button
          type="button"
          onClick={() => onNavigate('settings', 'kop')}
          className={`relative flex flex-col items-center justify-center min-w-[4rem] min-h-[3rem] px-2.5 rounded-xl gap-0.5 text-[0.6875rem] font-semibold transition-colors cursor-pointer ${
            isKop ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isKop && (
            <motion.span
              layoutId="bottomNavPill"
              transition={PILL_SPRING}
              className="absolute inset-0 bg-blue-50 border border-blue-100 rounded-xl"
            />
          )}
          <Building2 className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Kop Surat</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings', 'profile')}
          className={`relative flex flex-col items-center justify-center min-w-[4rem] min-h-[3rem] px-2.5 rounded-xl gap-0.5 text-[0.6875rem] font-semibold transition-colors cursor-pointer ${
            isAccount ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isAccount && (
            <motion.span
              layoutId="bottomNavPill"
              transition={PILL_SPRING}
              className="absolute inset-0 bg-blue-50 border border-blue-100 rounded-xl"
            />
          )}
          <User className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Akun</span>
        </button>
      </div>
    </nav>
  );
}
