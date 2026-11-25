const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function formatTimeHMS(totalSec = 0) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatDurationShort(totalSec = 0) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m} menit`;
  return `${s} detik`;
}

export function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${HARI_INDO[d.getDay()]}, ${d.getDate()} ${BULAN_INDO[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${BULAN_INDO[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function generateDefaultDocNumber(sequence = 1) {
  const now = new Date();
  const num = String(sequence).padStart(3, '0');
  const romawi = BULAN_ROMAWI[now.getMonth()];
  return `${num}/NOT/${romawi}/${now.getFullYear()}`;
}

function sanitizeFilenameSegment(raw, maxLen) {
  return String(raw || '')
    .replace(/[/\\]+/g, '-')
    .replace(/[:*?"<>|\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
}

export function formatMeetingDocFilename(meeting) {
  const cleanTitle = sanitizeFilenameSegment(meeting?.title, 80) || 'Rapat';
  const rawNumber = String(meeting?.doc_number || '').trim();
  const cleanNumber =
    !rawNumber || rawNumber === '-'
      ? ''
      : sanitizeFilenameSegment(rawNumber, 40);

  return cleanNumber
    ? `Notulis - ${cleanTitle} - ${cleanNumber}`
    : `Notulis - ${cleanTitle}`;
}

export function formatWhatsAppSummary(meeting) {
  if (!meeting) return '';
  const decisions = (meeting.summary?.keputusan || [])
    .map((k, idx) => `${idx + 1}. ${k}`)
    .join('\n');
  const actions = (meeting.action_items || [])
    .map((a, idx) => `${idx + 1}. ${a.description} — PIC: ${a.pic_name} (${a.deadline})`)
    .join('\n');

  return [
    `*${meeting.doc_type_title || 'NOTULEN RAPAT'}*`,
    `Nomor: ${meeting.doc_number || '-'}`,
    `Judul: ${meeting.title}`,
    `Hari/Tgl: ${formatDateIndo(meeting.meeting_date)}`,
    `Waktu: ${meeting.time_range || '-'}`,
    `Tempat: ${meeting.location || '-'}`,
    '',
    '*Pembahasan:*',
    meeting.summary?.pembahasan || '-',
    '',
    '*Keputusan:*',
    decisions || '-',
    '',
    '*Tindak Lanjut:*',
    actions || '-',
  ].join('\n');
}
