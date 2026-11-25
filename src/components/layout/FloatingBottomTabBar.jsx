import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, FileText, Mic, User } from 'lucide-react';

const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };

const NAV_ITEMS = [
  {
    id: 'rapat',
    label: 'Rapat',
    hash: '#/rapat',
    icon: FileText,
    targetPage: 'dashboard',
  },
  {
    id: 'kop',
    label: 'Kop',
    hash: '#/kop',
    icon: Building2,
    targetPage: 'settings',
    subTab: 'kop',
  },
  {
    id: 'akun',
    label: 'Akun',
    hash: '#/akun',
    icon: User,
    targetPage: 'settings',
    subTab: 'profile',
  },
];

export default function FloatingBottomTabBar({
  activePage,
  activeSettingsSubTab = 'kop',
  currentHash = '',
  onNavigate,
  onStartNewMeeting,
}) {
  const getActiveId = () => {
    if (currentHash === '#/kop') return 'kop';
    if (currentHash === '#/akun' || currentHash === '#/admin') return 'akun';
    if (currentHash === '#/rapat' || currentHash.startsWith('#/detail/')) return 'rapat';

    if (activePage === 'dashboard' || activePage === 'detail') return 'rapat';
    if (activePage === 'settings') {
      return activeSettingsSubTab === 'kop' ? 'kop' : 'akun';
    }
    return 'rapat';
  };

  const activeId = getActiveId();

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = activeId === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.targetPage, item.subTab)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        title={item.label}
        className={`relative flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem] rounded-full transition-all duration-300 active:scale-95 cursor-pointer ${
          isActive
            ? 'px-3.5 gap-1.5 text-blue-600 dark:text-blue-400'
            : 'px-2.5 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="floatingDockActivePill"
            transition={PILL_SPRING}
            className="absolute inset-0 rounded-full bg-blue-500/15 dark:bg-blue-400/20 border border-blue-500/20"
          />
        )}

        <Icon
          className={`w-[1.125rem] h-[1.125rem] shrink-0 relative z-10 transition-all duration-300 ${
            isActive ? 'fill-blue-500/20 dark:fill-blue-400/20' : ''
          }`}
          strokeWidth={isActive ? 2.4 : 1.9}
        />

        <AnimatePresence initial={false} mode="popLayout">
          {isActive && (
            <motion.span
              key={`label-${item.id}`}
              initial={{ opacity: 0, width: 0, x: -4 }}
              animate={{ opacity: 1, width: 'auto', x: 0 }}
              exit={{ opacity: 0, width: 0, x: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 text-xs font-bold whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );
  };

  return (
    <motion.nav
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Navigasi Mengambang"
      className="no-print lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 mb-[env(safe-area-inset-bottom)] max-w-[calc(100vw-1.5rem)]"
    >
      <div className="rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-lg shadow-black/10 p-1.5 flex items-center gap-1">
        {/* Rapat */}
        {renderNavItem(NAV_ITEMS[0])}

        {/* Primary CTA: Rekam Rapat Baru */}
        <button
          type="button"
          onClick={onStartNewMeeting}
          aria-label="Rekam Rapat Baru"
          title="Rekam Rapat Baru"
          className="flex items-center justify-center gap-1.5 min-w-[2.75rem] min-h-[2.75rem] px-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/30 transition-all duration-300 active:scale-95 cursor-pointer"
        >
          <Mic className="w-[1.125rem] h-[1.125rem] shrink-0" strokeWidth={2.2} />
          <span className="text-xs font-bold whitespace-nowrap">Rekam</span>
        </button>

        {/* Kop & Akun */}
        {renderNavItem(NAV_ITEMS[1])}
        {renderNavItem(NAV_ITEMS[2])}
      </div>
    </motion.nav>
  );
}
