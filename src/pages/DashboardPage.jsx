import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Filter,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import MeetingCard from '../components/meeting/MeetingCard';
import EmptyState from '../components/common/EmptyState';
import AnimatedTitle from '../components/common/AnimatedTitle';
import { MeetingCardSkeleton } from '../components/common/LoadingOverlay';
import { formatDurationShort } from '../utils/formatters';

export default function DashboardPage({
  user,
  meetings = [],
  isLoading,
  pendingRecoverySessions = [],
  onRefresh,
  onOpenNewMeeting,
  onSelectMeeting,
  onRecoverSession,
  onDiscardRecovery,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('');

  const categories = useMemo(() => {
    const set = new Set();
    meetings.forEach((m) => {
      if (m.doc_type_title) set.add(m.doc_type_title);
    });
    return Array.from(set);
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return meetings.filter((m) => {
      const matchesQuery =
        !q ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.doc_number || '').toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === 'ALL' || m.doc_type_title === categoryFilter;
      const matchesMonth =
        !monthFilter || String(m.meeting_date || '').startsWith(monthFilter);
      return matchesQuery && matchesCategory && matchesMonth;
    });
  }, [meetings, searchQuery, categoryFilter, monthFilter]);

  const stats = useMemo(() => {
    const totalDuration = meetings.reduce((acc, m) => acc + (Number(m.duration_sec) || 0), 0);
    const totalPending = meetings.reduce(
      (acc, m) => acc + (Number(m.pending_action_count) || 0),
      0
    );
    return {
      totalMeetings: meetings.length,
      totalDuration,
      totalPending,
    };
  }, [meetings]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4 pb-28 lg:pb-12 space-y-4">
      {/* Greeting & Primary CTA */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <AnimatedTitle
            as="h1"
            text="Arsip Notulen Rapat"
            className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight"
          />
          <p className="text-xs sm:text-sm text-slate-500">
            Halo, <span className="font-semibold text-slate-700">{user?.fullName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="min-w-[2.875rem] min-h-[2.875rem] px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
            title="Muat ulang daftar rapat"
            aria-label="Muat ulang daftar rapat"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenNewMeeting}
            className="flex-1 sm:flex-initial min-h-[2.875rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Rapat Baru</span>
          </button>
        </div>
      </section>

      {/* Crash Recovery Banner (IndexedDB Pending Audio) */}
      {pendingRecoverySessions.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2.5">
          {pendingRecoverySessions.map((sess) => (
            <div
              key={sess.sessionId}
              className="flex flex-wrap items-center justify-between gap-2.5"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-900 truncate">
                    Ditemukan Rekaman Belum Diproses: {sess.meta?.title || 'Rapat'}
                  </p>
                  <p className="text-[0.7rem] text-amber-700">
                    Tersimpan aman di perangkat ini ({formatDurationShort(sess.elapsedSec || 0)}).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => onRecoverSession(sess)}
                  className="flex-1 sm:flex-initial min-h-[2.5rem] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Proses ke AI
                </button>
                <button
                  type="button"
                  onClick={() => onDiscardRecovery(sess.sessionId)}
                  className="min-h-[2.5rem] px-3 py-1.5 bg-white border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl hover:bg-amber-100/60 transition cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Compact Stats Row (Fluid Flexbox + Motion) */}
      <section className="flex flex-wrap gap-2.5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
          whileHover={{ y: -2 }}
          className="flex-1 basis-[7.5rem] bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.7rem] font-semibold">Total Notulen</span>
            <FileText className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-lg font-extrabold text-slate-900">{stats.totalMeetings}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -2 }}
          className="flex-1 basis-[7.5rem] bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.7rem] font-semibold">Durasi Terekam</span>
            <Mic className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-extrabold text-slate-900">
            {formatDurationShort(stats.totalDuration)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
          whileHover={{ y: -2 }}
          className="flex-1 basis-[7.5rem] bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.7rem] font-semibold">Tindak Lanjut</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-extrabold text-slate-900">
            {stats.totalPending} <span className="text-xs font-medium text-slate-500">pending</span>
          </p>
        </motion.div>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap gap-2.5">
        <div className="relative flex-1 basis-[13rem]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, nomor surat, atau ruangan..."
            className="w-full min-h-[2.75rem] pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative flex-1 basis-[10rem] sm:max-w-[13rem]">
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full min-h-[2.75rem] pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Semua Jenis Rapat</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 basis-[9rem] sm:max-w-[11rem]">
          <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full min-h-[2.75rem] pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter bulan"
          />
        </div>
      </section>

      {/* Meetings Grid / Skeleton / Empty */}
      {isLoading ? (
        <MeetingCardSkeleton count={3} />
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          title={meetings.length === 0 ? 'Belum Ada Notulen Rapat' : 'Tidak Ada Rapat yang Cocok'}
          description={
            meetings.length === 0
              ? 'Tekan tombol Rapat Baru untuk mulai merekam audio rapat dan menyusun notulen resmi secara otomatis.'
              : 'Ubah kata kunci pencarian atau reset filter untuk melihat riwayat rapat Anda.'
          }
          actionLabel={meetings.length === 0 ? 'Mulai Rapat Pertama' : 'Reset Pencarian'}
          onAction={
            meetings.length === 0
              ? onOpenNewMeeting
              : () => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setMonthFilter('');
              }
          }
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {filteredMeetings.map((m, idx) => (
            <MeetingCard
              key={m.meeting_id}
              meeting={m}
              index={idx}
              onClick={onSelectMeeting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
