import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Copy,
  Download,
  Edit3,
  FileAudio,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import MeetingTabs from '../components/meeting/MeetingTabs';
import MinutesPreview from '../components/meeting/MinutesPreview';
import DocTypeSelector from '../components/meeting/DocTypeSelector';
import AnimatedTitle from '../components/common/AnimatedTitle';
import { ButtonSpinner, MinutesDetailSkeleton } from '../components/common/LoadingOverlay';
import {
  apiDeleteMeeting,
  apiExportDocx,
  apiGetAudioBase64,
  apiGetMeetingDetail,
  apiUpdateActionItemStatus,
  apiUpdateMeeting,
  base64ToBlob,
  isDemoMode,
} from '../services/api';
import { deleteMeetingAudioLocal, getMeetingAudioLocal } from '../services/indexedDb';
import {
  DEFAULT_DOC_TYPE,
  normalizeDocTypeTitle,
  saveCustomDocType,
} from '../utils/docTypes';
import { downloadMeetingDocxClient } from '../utils/docxExporter';
import {
  formatDurationShort,
  formatMeetingDocFilename,
  formatWhatsAppSummary,
} from '../utils/formatters';
import { confirmDialog, showErrorAlert, showToast } from '../utils/swal';

export default function MeetingDetailPage({
  meetingId,
  kopList = [],
  onDeleted,
  onMeetingUpdated,
}) {
  const [meeting, setMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notulen');
  const [menuOpen, setMenuOpen] = useState(false);

  // Action states (anti double-submit)
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [togglingActionId, setTogglingActionId] = useState(null);

  // Transcript search
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Audio playback
  const [audioUrl, setAudioUrl] = useState('');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioElRef = useRef(null);

  // Editable form state (Detail & Notulen Editor)
  const [editForm, setEditForm] = useState(null);
  const [showSummaryEditorModal, setShowSummaryEditorModal] = useState(false);

  const loadDetail = async () => {
    setIsLoading(true);
    try {
      const res = await apiGetMeetingDetail(meetingId);
      setMeeting(res.data);
      syncEditForm(res.data);
    } catch (err) {
      showErrorAlert('Gagal Memuat Rapat', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const syncEditForm = (m) => {
    if (!m) return;
    setEditForm({
      kop_id: m.kop_id || '',
      title: m.title || '',
      doc_type_title: m.doc_type_title || 'NOTULEN RAPAT',
      doc_number: m.doc_number || '',
      meeting_date: m.meeting_date || '',
      time_range: m.time_range || '',
      location: m.location || '',
      pembahasan: m.summary?.pembahasan || '',
      keputusanText: (m.summary?.keputusan || []).join('\n'),
      participants: (m.participants || []).map((p) => ({ ...p })),
      action_items: (m.action_items || []).map((a) => ({ ...a })),
    });
  };

  useEffect(() => {
    loadDetail();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [meetingId]);

  useEffect(() => {
    if (!meeting) return undefined;
    const prevTitle = document.title;
    document.title = formatMeetingDocFilename(meeting);
    return () => {
      document.title = prevTitle;
    };
  }, [meeting?.title, meeting?.doc_number]);

  // Load audio when Rekaman tab is opened
  useEffect(() => {
    if (activeTab !== 'rekaman' || !meeting || audioUrl) return;
    let cancelled = false;

    const loadAudio = async () => {
      setIsLoadingAudio(true);
      try {
        const localBlob = await getMeetingAudioLocal(meeting.meeting_id);
        if (localBlob && !cancelled) {
          setAudioUrl(URL.createObjectURL(localBlob));
          return;
        }
        if (meeting.audio_drive_id && !isDemoMode()) {
          const res = await apiGetAudioBase64(meeting.meeting_id);
          const blob = base64ToBlob(res.data.base64, res.data.mimeType);
          if (!cancelled) setAudioUrl(URL.createObjectURL(blob));
        }
      } catch {
        // Audio opsional jika rapat sample belum memiliki rekaman
      } finally {
        if (!cancelled) setIsLoadingAudio(false);
      }
    };

    loadAudio();
    return () => {
      cancelled = true;
    };
  }, [activeTab, meeting, audioUrl]);

  const handlePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (audioElRef.current) {
      audioElRef.current.playbackRate = rate;
    }
  };

  const handleDownloadDocx = async () => {
    if (!meeting || isExportingDocx) return;
    setIsExportingDocx(true);
    try {
      if (isDemoMode()) {
        await downloadMeetingDocxClient(meeting);
        showToast('success', 'Dokumen .docx berhasil diunduh!');
      } else {
        try {
          const res = await apiExportDocx(meeting.meeting_id);
          if (res.data?.base64) {
            const blob = base64ToBlob(
              res.data.base64,
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fallbackName = `${formatMeetingDocFilename(meeting)}.docx`;
            a.download =
              res.data.fileName && String(res.data.fileName).startsWith('Notulis - ')
                ? res.data.fileName
                : fallbackName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } else if (res.data?.downloadUrl) {
            window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
          }
          showToast('success', 'Dokumen .docx berhasil diekspor!');
        } catch {
          // Fallback ke generator .docx sisi klien agar user tetap mendapat file resmi
          await downloadMeetingDocxClient(meeting);
          showToast('success', 'Dokumen .docx berhasil dibuat!');
        }
      }
    } catch (err) {
      showErrorAlert('Gagal Ekspor .docx', err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handlePrintPdf = () => {
    if (meeting) {
      document.title = formatMeetingDocFilename(meeting);
    }
    window.print();
  };

  const handleToggleActionStatus = async (item) => {
    if (!meeting || togglingActionId) return;
    const nextStatus = item.status === 'DONE' ? 'PENDING' : 'DONE';
    setTogglingActionId(item.action_id);
    try {
      await apiUpdateActionItemStatus(meeting.meeting_id, item.action_id, nextStatus);
      setMeeting((prev) => ({
        ...prev,
        action_items: (prev.action_items || []).map((a) =>
          a.action_id === item.action_id ? { ...a, status: nextStatus } : a
        ),
      }));
      if (onMeetingUpdated) onMeetingUpdated();
      showToast('success', nextStatus === 'DONE' ? 'Tindak lanjut ditandai selesai.' : 'Status dikembalikan ke pending.');
    } catch (err) {
      showErrorAlert('Gagal Mengubah Status', err.message);
    } finally {
      setTogglingActionId(null);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meeting || isDeleting) return;
    const confirmed = await confirmDialog({
      icon: 'warning',
      title: 'Hapus Rapat Permanen?',
      html: `Notulen <b>${meeting.title}</b> beserta daftar hadir dan file audio akan dihapus permanen.`,
      confirmText: 'Ya, Hapus Rapat',
      cancelText: 'Batal',
      danger: true,
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await apiDeleteMeeting(meeting.meeting_id);
      await deleteMeetingAudioLocal(meeting.meeting_id).catch(() => {});
      await showToast('success', 'Rapat berhasil dihapus.');
      onDeleted(meeting.meeting_id);
    } catch (err) {
      showErrorAlert('Gagal Menghapus Rapat', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDetail = async (e) => {
    if (e) e.preventDefault();
    if (!editForm || isSavingDetail) return;

    setIsSavingDetail(true);
    try {
      const decisions = editForm.keputusanText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const cleanParticipants = editForm.participants
        .filter((p) => p.name.trim())
        .map((p) => ({
          ...p,
          name: p.name.trim(),
          position: p.position.trim() || 'Peserta',
        }));

      const cleanActions = editForm.action_items
        .filter((a) => a.description.trim())
        .map((a, idx) => ({
          ...a,
          order_no: idx + 1,
          description: a.description.trim(),
          pic_name: a.pic_name.trim() || '-',
          deadline: a.deadline.trim() || '-',
        }));

      const cleanDocType = normalizeDocTypeTitle(editForm.doc_type_title) || DEFAULT_DOC_TYPE;
      saveCustomDocType(cleanDocType);

      const res = await apiUpdateMeeting({
        meetingId: meeting.meeting_id,
        kop_id: editForm.kop_id,
        title: editForm.title,
        doc_type_title: cleanDocType,
        doc_number: editForm.doc_number,
        meeting_date: editForm.meeting_date,
        time_range: editForm.time_range,
        location: editForm.location,
        summary: {
          pembahasan: editForm.pembahasan,
          keputusan: decisions,
        },
        participants: cleanParticipants,
        action_items: cleanActions,
      });

      setMeeting(res.data);
      syncEditForm(res.data);
      setShowSummaryEditorModal(false);
      if (onMeetingUpdated) onMeetingUpdated();
      showToast('success', 'Perubahan rapat disimpan.');
    } catch (err) {
      showErrorAlert('Gagal Menyimpan Perubahan', err.message);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!meeting?.transcript_text) return;
    try {
      await navigator.clipboard.writeText(meeting.transcript_text);
      showToast('success', 'Transkrip disalin ke clipboard.');
    } catch {
      showToast('error', 'Gagal menyalin teks.');
    }
  };

  const handleCopyWhatsApp = async () => {
    setMenuOpen(false);
    if (!meeting) return;
    try {
      await navigator.clipboard.writeText(formatWhatsAppSummary(meeting));
      showToast('success', 'Ringkasan siap ditempel ke WhatsApp!');
    } catch {
      showToast('error', 'Gagal menyalin ringkasan.');
    }
  };

  const transcriptLines = useMemo(() => {
    const raw = meeting?.transcript_text || '';
    const lines = raw.split('\n').filter((l) => l.trim());
    const q = transcriptSearch.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.toLowerCase().includes(q));
  }, [meeting?.transcript_text, transcriptSearch]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-28 lg:pb-12">
        <MinutesDetailSkeleton />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-8 pb-28 lg:pb-12 text-center">
        <p className="text-sm text-slate-600">Data rapat tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="print-only-container max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-28 lg:pb-12 space-y-3.5">
      {/* Top Action Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 truncate">
            {meeting.doc_type_title}
          </p>
          <AnimatedTitle
            as="h1"
            text={meeting.title}
            className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteMeeting}
            className="min-h-[2.75rem] px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? <ButtonSpinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Hapus Rapat</span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="min-w-[2.75rem] min-h-[2.75rem] rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            aria-label="Menu opsi rapat"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -6 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-12 z-20 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 space-y-0.5 origin-top-right"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSummaryEditorModal(true);
                  }}
                  className="w-full min-h-[2.5rem] px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Isi Notulen</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="w-full min-h-[2.5rem] px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Salin Format WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    loadDetail();
                  }}
                  className="w-full min-h-[2.5rem] px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Muat Ulang Data</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 4 Tabs Navigation */}
      <MeetingTabs activeTab={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {/* TAB 1: NOTULEN */}
        {activeTab === 'notulen' && (
          <motion.div
            key="notulen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <MinutesPreview
              meeting={meeting}
              isExportingDocx={isExportingDocx}
              togglingActionId={togglingActionId}
              onDownloadDocx={handleDownloadDocx}
              onPrintPdf={handlePrintPdf}
              onToggleActionStatus={handleToggleActionStatus}
            />
          </motion.div>
        )}

        {/* TAB 2: TRANSKRIP */}
        {activeTab === 'transkrip' && (
          <motion.section
            key="transkrip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5"
          >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 basis-[12rem]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Cari kata kunci di transkrip..."
                className="w-full min-h-[2.75rem] pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleCopyTranscript}
              className="min-h-[2.75rem] px-3.5 py-2 bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Transkrip</span>
            </button>
          </div>

          {transcriptLines.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 py-6 text-center">
              {meeting.transcript_text
                ? 'Tidak ada kalimat yang cocok dengan pencarian.'
                : 'Transkrip belum tersedia untuk rapat ini.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {transcriptLines.map((line, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 leading-relaxed"
                >
                  {line}
                </div>
              ))}
            </div>
          )}
          </motion.section>
        )}

        {/* TAB 3: REKAMAN AUDIO */}
        {activeTab === 'rekaman' && (
          <motion.section
            key="rekaman"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="no-print bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
          >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Rekaman Audio Rapat</h2>
              <p className="text-xs text-slate-500">
                Durasi tercatat: {formatDurationShort(meeting.duration_sec)}
              </p>
            </div>
          </div>

          {isLoadingAudio ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ButtonSpinner className="w-4 h-4 text-blue-600" />
              <span>Memuat audio rekaman...</span>
            </div>
          ) : audioUrl ? (
            <div className="space-y-3">
              <audio
                ref={audioElRef}
                controls
                src={audioUrl}
                className="w-full"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 mr-1">Kecepatan:</span>
                  {[1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handlePlaybackRate(rate)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <a
                  href={audioUrl}
                  download={`${meeting.title.slice(0, 30)}.webm`}
                  className="inline-flex items-center gap-1.5 min-h-[2.5rem] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Audio</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center text-xs text-slate-500">
              File audio tidak tersedia di cache perangkat atau Google Drive untuk rapat contoh ini.
              Rekam rapat baru untuk memutar ulang audio secara langsung.
            </div>
          )}
          </motion.section>
        )}

        {/* TAB 4: DETAIL & EDIT METADATA + DAFTAR HADIR */}
        {activeTab === 'detail' && editForm && (
          <motion.form
            key="detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onSubmit={handleSaveDetail}
            className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
          >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Edit Metadata & Daftar Hadir</h2>
            <button
              type="button"
              onClick={() => setShowSummaryEditorModal(true)}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Edit Pembahasan & Keputusan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kopList.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kop Surat Instansi
                </label>
                <select
                  value={editForm.kop_id}
                  onChange={(e) => setEditForm({ ...editForm, kop_id: e.target.value })}
                  className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
                >
                  {kopList.map((k) => (
                    <option key={k.kop_id} value={k.kop_id}>
                      {k.institution_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Rapat</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <DocTypeSelector
                value={editForm.doc_type_title}
                onChange={(val) => setEditForm({ ...editForm, doc_type_title: val })}
                label="Jenis Dokumen Notulen"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Surat</label>
              <input
                type="text"
                value={editForm.doc_number}
                onChange={(e) => setEditForm({ ...editForm, doc_number: e.target.value })}
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={editForm.meeting_date}
                onChange={(e) => setEditForm({ ...editForm, meeting_date: e.target.value })}
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Waktu</label>
              <input
                type="text"
                value={editForm.time_range}
                onChange={(e) => setEditForm({ ...editForm, time_range: e.target.value })}
                placeholder="13.00 – 15.00 WIB"
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi / Ruangan</label>
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Daftar Hadir Editor */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">Daftar Hadir Peserta</h3>
              <button
                type="button"
                onClick={() =>
                  setEditForm({
                    ...editForm,
                    participants: [
                      ...editForm.participants,
                      { name: '', position: 'Peserta', attendance_status: 'HADIR' },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Peserta
              </button>
            </div>

            <div className="space-y-2">
              {editForm.participants.map((p, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...editForm.participants];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setEditForm({ ...editForm, participants: next });
                    }}
                    placeholder="Nama peserta"
                    className="flex-1 basis-[9rem] min-h-[2.5rem] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={p.position}
                    onChange={(e) => {
                      const next = [...editForm.participants];
                      next[idx] = { ...next[idx], position: e.target.value };
                      setEditForm({ ...editForm, participants: next });
                    }}
                    placeholder="Jabatan"
                    className="flex-1 basis-[7rem] min-h-[2.5rem] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl"
                  />
                  <select
                    value={p.attendance_status || 'HADIR'}
                    onChange={(e) => {
                      const next = [...editForm.participants];
                      next[idx] = { ...next[idx], attendance_status: e.target.value };
                      setEditForm({ ...editForm, participants: next });
                    }}
                    className="min-h-[2.5rem] px-2 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="HADIR">HADIR</option>
                    <option value="IZIN">IZIN</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        participants: editForm.participants.filter((_, i) => i !== idx),
                      })
                    }
                    className="min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    aria-label="Hapus peserta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSavingDetail}
              className="w-full sm:w-auto min-h-[3rem] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isSavingDetail ? <ButtonSpinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSavingDetail ? 'Menyimpan...' : 'Simpan Perubahan Rapat'}</span>
            </button>
          </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Modal Edit Pembahasan, Keputusan & Tindak Lanjut */}
      <AnimatePresence>
        {showSummaryEditorModal && editForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="no-print fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Edit Isi Notulen AI</h3>
                <button
                  type="button"
                  onClick={() => setShowSummaryEditorModal(false)}
                  className="min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveDetail}
                className="flex-1 flex flex-col min-h-0"
              >
                <div
                  data-lenis-prevent
                  className="flex-1 overflow-y-auto p-4 pb-6 space-y-3.5"
                >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  III. Pembahasan
                </label>
                <textarea
                  rows={4}
                  value={editForm.pembahasan}
                  onChange={(e) => setEditForm({ ...editForm, pembahasan: e.target.value })}
                  className="w-full p-3 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IV. Keputusan Rapat (1 poin per baris)
                </label>
                <textarea
                  rows={4}
                  value={editForm.keputusanText}
                  onChange={(e) => setEditForm({ ...editForm, keputusanText: e.target.value })}
                  className="w-full p-3 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    V. Tabel Tindak Lanjut
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        action_items: [
                          ...editForm.action_items,
                          { description: '', pic_name: '', deadline: '', status: 'PENDING' },
                        ],
                      })
                    }
                    className="text-[0.7rem] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {editForm.action_items.map((a, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                      <input
                        type="text"
                        value={a.description}
                        onChange={(e) => {
                          const next = [...editForm.action_items];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setEditForm({ ...editForm, action_items: next });
                        }}
                        placeholder="Uraian tugas"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={a.pic_name}
                          onChange={(e) => {
                            const next = [...editForm.action_items];
                            next[idx] = { ...next[idx], pic_name: e.target.value };
                            setEditForm({ ...editForm, action_items: next });
                          }}
                          placeholder="Penanggung jawab"
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={a.deadline}
                          onChange={(e) => {
                            const next = [...editForm.action_items];
                            next[idx] = { ...next[idx], deadline: e.target.value };
                            setEditForm({ ...editForm, action_items: next });
                          }}
                          placeholder="Tenggat"
                          className="w-28 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              action_items: editForm.action_items.filter((_, i) => i !== idx),
                            })
                          }
                          className="px-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                </div>

                <div className="shrink-0 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-slate-100 bg-white">
                  <button
                    type="submit"
                    disabled={isSavingDetail}
                    className="w-full min-h-[3rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingDetail && <ButtonSpinner className="w-4 h-4" />}
                    <span>{isSavingDetail ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
