import React from 'react';
import { Download, Printer, Sparkles } from 'lucide-react';
import { formatDateIndo } from '../../utils/formatters';
import { ButtonSpinner } from '../common/LoadingOverlay';
import KopLogo from '../common/KopLogo';
import ActionItemTable from './ActionItemTable';

export default function MinutesPreview({
  meeting,
  isExportingDocx,
  togglingActionId,
  onDownloadDocx,
  onPrintPdf,
  onToggleActionStatus,
}) {
  const kop = meeting.kop;
  const participants = meeting.participants || [];
  const decisions = meeting.summary?.keputusan || [];

  return (
    <div className="space-y-3">
      {/* Action Buttons Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          {meeting.is_ai_generated && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Disusun AI
            </span>
          )}
          <span className="text-xs text-slate-500 hidden sm:inline">
            Dokumen siap ekspor & cetak A4
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={isExportingDocx}
            onClick={onDownloadDocx}
            className="flex-1 sm:flex-initial min-h-[2.875rem] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {isExportingDocx ? (
              <ButtonSpinner className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExportingDocx ? 'Menyiapkan...' : 'Unduh .docx'}</span>
          </button>

          <button
            type="button"
            onClick={onPrintPdf}
            className="flex-1 sm:flex-initial min-h-[2.875rem] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Formal A4 Document Preview */}
      <article className="minutes-sheet font-serif-doc bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-10 text-slate-900">
        {/* Kop Surat Resmi */}
        {kop && (
          <header className="pb-3 mb-5 border-b-[3px] border-double border-slate-900 flex items-center gap-3 sm:gap-4">
            <KopLogo
              src={kop.logo_drive_url}
              alt="Logo Instansi"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
            />
            <div className="flex-1 text-center leading-tight">
              {kop.header_line_1 && (
                <p className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                  {kop.header_line_1}
                </p>
              )}
              {kop.header_line_2 && (
                <p className="text-xs sm:text-[0.95rem] font-bold tracking-wide uppercase">
                  {kop.header_line_2}
                </p>
              )}
              {kop.institution_name && (
                <p className="text-sm sm:text-lg font-extrabold tracking-wide uppercase mt-0.5">
                  {kop.institution_name}
                </p>
              )}
              {(kop.address || kop.phone) && (
                <p className="text-[0.7rem] sm:text-xs text-slate-700 mt-1">
                  {[kop.address, kop.phone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </header>
        )}

        {/* Judul & Nomor Surat */}
        <div className="text-center mb-6">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide underline underline-offset-4">
            {meeting.doc_type_title || 'NOTULEN RAPAT'}
          </h2>
          <p className="text-xs sm:text-[0.8125rem] mt-1">
            Nomor: {meeting.doc_number || '-'}
          </p>
        </div>

        {/* I. Pelaksanaan Rapat */}
        <section className="mb-5">
          <h3 className="text-xs sm:text-[0.875rem] font-bold uppercase mb-2">
            I. Pelaksanaan Rapat
          </h3>
          <div className="space-y-1 text-xs sm:text-[0.85rem]">
            <div className="flex gap-2">
              <span className="w-28 sm:w-36 shrink-0">Agenda Rapat</span>
              <span>:</span>
              <span className="font-semibold">{meeting.title}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 sm:w-36 shrink-0">Hari / Tanggal</span>
              <span>:</span>
              <span>{formatDateIndo(meeting.meeting_date)}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 sm:w-36 shrink-0">Waktu</span>
              <span>:</span>
              <span>{meeting.time_range || '-'}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 sm:w-36 shrink-0">Tempat</span>
              <span>:</span>
              <span>{meeting.location || '-'}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 sm:w-36 shrink-0">Jumlah Peserta</span>
              <span>:</span>
              <span>{meeting.participant_count || participants.length || 0} orang</span>
            </div>
          </div>
        </section>

        {/* II. Daftar Hadir */}
        <section className="mb-5">
          <h3 className="text-xs sm:text-[0.875rem] font-bold uppercase mb-2">
            II. Daftar Hadir Peserta
          </h3>
          {participants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs sm:text-[0.8125rem]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1.5 text-center w-10">No</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-left">Nama</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-left">Jabatan</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-center w-24">Ket.</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => (
                    <tr key={p.participant_id || idx}>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 px-2.5 py-1.5">{p.name}</td>
                      <td className="border border-slate-300 px-2.5 py-1.5">{p.position || '-'}</td>
                      <td className="border border-slate-300 px-2.5 py-1.5 text-center">
                        {p.attendance_status || 'HADIR'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs sm:text-[0.85rem] text-slate-600 italic">
              Daftar hadir terlampir ({meeting.participant_count || 0} peserta).
            </p>
          )}
        </section>

        {/* III. Pembahasan */}
        <section className="mb-5">
          <h3 className="text-xs sm:text-[0.875rem] font-bold uppercase mb-2">
            III. Pembahasan
          </h3>
          <p className="text-xs sm:text-[0.85rem] leading-relaxed text-justify whitespace-pre-line">
            {meeting.summary?.pembahasan || '-'}
          </p>
        </section>

        {/* IV. Keputusan */}
        <section className="mb-5">
          <h3 className="text-xs sm:text-[0.875rem] font-bold uppercase mb-2">
            IV. Keputusan Rapat
          </h3>
          {decisions.length > 0 ? (
            <ol className="list-decimal pl-5 space-y-1.5 text-xs sm:text-[0.85rem] leading-relaxed">
              {decisions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ol>
          ) : (
            <p className="text-xs sm:text-[0.85rem] text-slate-600">-</p>
          )}
        </section>

        {/* V. Tindak Lanjut */}
        <section className="mb-8">
          <h3 className="text-xs sm:text-[0.875rem] font-bold uppercase mb-2">
            V. Tindak Lanjut
          </h3>
          <ActionItemTable
            items={meeting.action_items || []}
            togglingId={togglingActionId}
            onToggleStatus={onToggleActionStatus}
          />
        </section>

        {/* Tanda Tangan */}
        <footer className="flex justify-end pt-4">
          <div className="text-center text-xs sm:text-[0.85rem] min-w-[12rem]">
            <p>{formatDateIndo(meeting.meeting_date).split(', ').slice(1).join('')}</p>
            <p className="mb-14">Notulis Rapat,</p>
            <p className="font-bold border-t border-slate-800 pt-1">
              _______________________
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
