import React from 'react';
import { CheckCircle2, Circle, Clock, User } from 'lucide-react';
import { ButtonSpinner } from '../common/LoadingOverlay';

export default function ActionItemTable({
  items = [],
  togglingId = null,
  onToggleStatus,
  readOnly = false,
}) {
  if (!items || items.length === 0) {
    return (
      <p className="text-xs sm:text-sm text-slate-500 italic">
        Tidak ada poin tindak lanjut yang tercatat.
      </p>
    );
  }

  return (
    <div>
      {/* Desktop & Print Table */}
      <div className="hidden sm:block print:block overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[0.8125rem]">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-2.5 py-2 text-center w-10">No</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Uraian Tindak Lanjut</th>
              <th className="border border-slate-300 px-3 py-2 text-left w-40">Penanggung Jawab</th>
              <th className="border border-slate-300 px-3 py-2 text-left w-32">Batas Waktu</th>
              <th className="no-print border border-slate-300 px-2.5 py-2 text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isDone = item.status === 'DONE';
              const isLoading = togglingId === item.action_id;
              return (
                <tr key={item.action_id || idx} className="hover:bg-slate-50/70">
                  <td className="border border-slate-300 px-2.5 py-2 text-center align-top">
                    {item.order_no || idx + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 align-top">
                    <span className={isDone ? 'line-through text-slate-400' : 'text-slate-900'}>
                      {item.description}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-2 align-top text-slate-700">
                    {item.pic_name}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 align-top text-slate-700">
                    {item.deadline}
                  </td>
                  <td className="no-print border border-slate-300 px-2 py-1.5 text-center align-top">
                    <button
                      type="button"
                      disabled={readOnly || isLoading}
                      onClick={() => onToggleStatus && onToggleStatus(item)}
                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition cursor-pointer disabled:opacity-60 ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {isLoading ? (
                        <ButtonSpinner className="w-3 h-3" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Circle className="w-3 h-3" />
                      )}
                      <span>{isDone ? 'Selesai' : 'Pending'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (Hidden on print & >= sm) */}
      <div className="sm:hidden print:hidden space-y-2.5 font-sans">
        {items.map((item, idx) => {
          const isDone = item.status === 'DONE';
          const isLoading = togglingId === item.action_id;
          return (
            <div
              key={item.action_id || idx}
              className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[0.7rem] font-bold text-slate-500">
                  #{item.order_no || idx + 1}
                </span>
                <button
                  type="button"
                  disabled={readOnly || isLoading}
                  onClick={() => onToggleStatus && onToggleStatus(item)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition cursor-pointer disabled:opacity-60 ${
                    isDone
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isLoading ? (
                    <ButtonSpinner className="w-3 h-3" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  <span>{isDone ? 'Selesai' : 'Pending'}</span>
                </button>
              </div>
              <p className={`text-xs font-medium leading-relaxed ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {item.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[0.7rem] text-slate-600 pt-1 border-t border-slate-200/70">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  {item.pic_name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.deadline}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
