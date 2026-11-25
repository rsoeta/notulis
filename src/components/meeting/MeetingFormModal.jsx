import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  DEFAULT_DOC_TYPE,
  normalizeDocTypeTitle,
  saveCustomDocType,
} from '../../utils/docTypes';
import { generateDefaultDocNumber } from '../../utils/formatters';
import { showToast } from '../../utils/swal';
import DocTypeSelector from './DocTypeSelector';

export default function MeetingFormModal({
  kopList = [],
  existingCount = 0,
  onClose,
  onStartRecord,
  onUploadAudio,
}) {
  const [title, setTitle] = useState('');
  const [docTypeTitle, setDocTypeTitle] = useState(DEFAULT_DOC_TYPE);
  const [docNumber, setDocNumber] = useState(() => generateDefaultDocNumber(existingCount + 1));
  const [location, setLocation] = useState('');
  const [kopId, setKopId] = useState(kopList[0]?.kop_id || '');
  const [participants, setParticipants] = useState([
    { name: '', position: 'Pimpinan Rapat', attendance_status: 'HADIR' },
    { name: '', position: 'Notulis', attendance_status: 'HADIR' },
  ]);

  const addParticipantRow = () => {
    setParticipants((prev) => [...prev, { name: '', position: 'Peserta', attendance_status: 'HADIR' }]);
  };

  const updateParticipant = (idx, field, val) => {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  };

  const removeParticipant = (idx) => {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildValidatedMeta = () => {
    if (!title.trim()) {
      showToast('warning', 'Judul rapat wajib diisi.');
      return null;
    }
    if (!location.trim()) {
      showToast('warning', 'Lokasi / ruang rapat wajib diisi.');
      return null;
    }
    const cleanParticipants = participants
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        position: p.position.trim() || 'Peserta',
        attendance_status: p.attendance_status || 'HADIR',
      }));

    const finalDocType = normalizeDocTypeTitle(docTypeTitle) || DEFAULT_DOC_TYPE;
    saveCustomDocType(finalDocType);

    return {
      kopId,
      title: title.trim(),
      docTypeTitle: finalDocType,
      docNumber: docNumber.trim() || '-',
      location: location.trim(),
      participants: cleanParticipants,
      participantCount: Math.max(cleanParticipants.length, 1),
    };
  };

  const handleSubmitRecord = (e) => {
    e.preventDefault();
    const meta = buildValidatedMeta();
    if (meta) onStartRecord(meta);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const meta = buildValidatedMeta();
    if (!meta) {
      e.target.value = '';
      return;
    }
    onUploadAudio(meta, file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Sesi Rapat Baru</h2>
            <p className="text-[0.7rem] text-slate-500">
              Lengkapi identitas rapat sebelum merekam audio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body + Sticky Footer */}
        <form
          onSubmit={handleSubmitRecord}
          className="flex-1 flex flex-col min-h-0"
        >
          <div
            data-lenis-prevent
            className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 pb-6 space-y-3.5"
          >
          {kopList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kop Surat Instansi
              </label>
              <select
                value={kopId}
                onChange={(e) => setKopId(e.target.value)}
                className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {kopList.map((k) => (
                  <option key={k.kop_id} value={k.kop_id}>
                    {k.institution_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul / Agenda Rapat <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Rapat Koordinasi Evaluasi Program Triwulan I"
              className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <DocTypeSelector
            value={docTypeTitle}
            onChange={setDocTypeTitle}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor Surat
            </label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="001/NOT/XI/2026"
              className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lokasi / Ruangan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Ruang Rapat Utama / Aula Lantai 2 / Zoom Meeting"
              className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Daftar Hadir Awal */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Daftar Peserta / Hadir (Opsional)
              </label>
              <button
                type="button"
                onClick={addParticipantRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.7rem] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Peserta
              </button>
            </div>

            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateParticipant(idx, 'name', e.target.value)}
                    placeholder="Nama & gelar"
                    className="flex-1 min-w-0 min-h-[2.5rem] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={p.position}
                    onChange={(e) => updateParticipant(idx, 'position', e.target.value)}
                    placeholder="Jabatan"
                    className="w-28 sm:w-32 min-h-[2.5rem] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(idx)}
                      className="min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          </div>

          {/* Sticky Submit Footer */}
          <div className="shrink-0 px-4 sm:px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-slate-100 bg-white flex flex-wrap gap-2">
            <button
              type="submit"
              className="flex-1 basis-[11rem] min-h-[3rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Mulai Rekam Rapat</span>
            </button>

            <label className="flex-1 basis-[9rem] min-h-[3rem] px-3 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Unggah Audio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
