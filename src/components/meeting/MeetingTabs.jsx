import React from 'react';
import { motion } from 'motion/react';
import { FileAudio, FileText, Info, ScrollText } from 'lucide-react';

const TABS = [
  { id: 'notulen', label: 'Notulen', icon: FileText },
  { id: 'transkrip', label: 'Transkrip', icon: ScrollText },
  { id: 'rekaman', label: 'Rekaman', icon: FileAudio },
  { id: 'detail', label: 'Detail', icon: Info },
];

const PILL_SPRING = { type: 'spring', stiffness: 440, damping: 32, mass: 0.8 };

export default function MeetingTabs({ activeTab, onChange }) {
  return (
    <div className="no-print bg-white border border-slate-200 rounded-2xl p-1 flex items-center gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 min-w-[4.75rem] min-h-[2.75rem] px-2.5 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="meetingDetailTabPill"
                transition={PILL_SPRING}
                className="absolute inset-0 bg-blue-600 rounded-xl shadow-xs"
              />
            )}
            <Icon className="w-3.5 h-3.5 shrink-0 relative z-10" />
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
