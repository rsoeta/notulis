import React from 'react';
import { FileText, Mic } from 'lucide-react';

export default function EmptyState({
  title = 'Belum Ada Notulen Rapat',
  description = 'Mulai rekam rapat Anda secara langsung. AI akan menyusun notulen resmi secara otomatis dalam hitungan menit.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl px-5 py-10 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
        <FileText className="w-6 h-6" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center gap-2 min-h-[2.875rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition cursor-pointer"
        >
          <Mic className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
