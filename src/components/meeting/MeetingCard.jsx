import React from 'react';
import { motion } from 'motion/react';
import { Calendar, CheckCircle2, Clock, MapPin, Sparkles, Users } from 'lucide-react';
import { formatDateShort, formatDurationShort } from '../../utils/formatters';

export default function MeetingCard({ meeting, index = 0, onClick }) {
  const pendingCount = Number(meeting.pending_action_count) || 0;

  return (
    <motion.button
      type="button"
      onClick={() => onClick(meeting.meeting_id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.06, 0.35),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -3,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      whileTap={{ scale: 0.985 }}
      className="flex-1 basis-full sm:basis-[20rem] text-left bg-white hover:bg-slate-50/70 border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-colors cursor-pointer flex flex-col justify-between gap-3 will-change-transform"
    >
      <div>
        {/* Top Row: Badge AI + Tanggal */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {meeting.is_ai_generated ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[0.6875rem] font-semibold">
              <Sparkles className="w-3 h-3" />
              Disusun AI
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[0.6875rem] font-semibold">
              Draft
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-slate-500">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatDateShort(meeting.meeting_date)}
          </span>
        </div>

        {/* Category & Number */}
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400 truncate mb-0.5">
          {meeting.doc_type_title || 'NOTULEN RAPAT'}
          {meeting.doc_number ? ` · ${meeting.doc_number}` : ''}
        </p>

        {/* Title */}
        <h3 className="text-sm sm:text-[0.9375rem] font-bold text-slate-900 leading-snug line-clamp-2 mb-2">
          {meeting.title}
        </h3>

        {/* Location */}
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 line-clamp-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{meeting.location}</span>
        </p>
      </div>

      {/* Footer Meta */}
      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {formatDurationShort(meeting.duration_sec)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {meeting.participant_count || 0}
          </span>
        </div>

        {pendingCount > 0 ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
            {pendingCount} tindak lanjut
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Selesai
          </span>
        )}
      </div>
    </motion.button>
  );
}
