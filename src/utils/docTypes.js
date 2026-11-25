export const CUSTOM_DOC_TYPE_VALUE = '__CUSTOM__';
export const DEFAULT_DOC_TYPE = 'NOTULEN RAPAT';
const STORAGE_KEY = 'notulis_custom_doc_types';
const MAX_CUSTOM_DOC_TYPES = 20;

export const DOC_TYPE_GROUPS = [
  {
    label: 'Umum & Manajemen',
    options: [
      'NOTULEN RAPAT',
      'NOTULEN RAPAT KOORDINASI',
      'NOTULEN RAPAT EVALUASI',
      'NOTULEN RAPAT KERJA (RAKER)',
      'NOTULEN RAPAT PIMPINAN (RAPIM)',
      'NOTULEN RAPAT PLENO',
      'NOTULEN RAPAT INTERNAL TIM',
      'RISALAH RAPAT',
      'BERITA ACARA RAPAT',
    ],
  },
  {
    label: 'Pemerintahan & Instansi Dinas',
    options: [
      'NOTULEN RAPAT DINAS',
      'NOTULEN RAPAT STAF',
      'NOTULEN FORUM PERANGKAT DAERAH',
      'NOTULEN MUSYAWARAH DESA / KELURAHAN',
      'NOTULEN RAPAT LINTAS SEKTOR',
      'NOTULEN RAPAT ANGGARAN & PERENCANAAN',
    ],
  },
  {
    label: 'Perusahaan, Bisnis & Proyek',
    options: [
      'NOTULEN RAPAT MANAJEMEN',
      'NOTULEN RAPAT DIREKSI / RUPS',
      'NOTULEN RAPAT PROYEK / KICK-OFF',
      'NOTULEN RAPAT KLIEN / MITRA',
      'NOTULEN WEEKLY / MONTHLY SYNC',
      'NOTULEN AUDIT & TINJAUAN MANAJEMEN',
      'MINUTES OF MEETING (MoM)',
    ],
  },
  {
    label: 'Pendidikan & Kampus',
    options: [
      'NOTULEN RAPAT DEWAN GURU',
      'NOTULEN RAPAT KOMITE & WALI MURID',
      'NOTULEN RAPAT SENAT / FAKULTAS',
      'NOTULEN RAPAT AKADEMIK & KURIKULUM',
      'NOTULEN RAPAT PANITIA KEGIATAN',
    ],
  },
  {
    label: 'Organisasi, Yayasan & Komunitas',
    options: [
      'NOTULEN RAPAT PENGURUS',
      'NOTULEN MUSYAWARAH ANGGOTA / MUBES',
      'NOTULEN RAPAT YAYASAN / LEMBAGA',
      'NOTULEN RAPAT RT / RW / WARGA',
      'NOTULEN RAPAT KEPANITIAAN',
    ],
  },
  {
    label: 'Kesehatan & Layanan Publik',
    options: [
      'NOTULEN RAPAT KOMITE MEDIS / MUTU',
      'NOTULEN LOKAKARYA MINI (LOKMIN)',
      'NOTULEN RAPAT MANAJEMEN LAYANAN',
    ],
  },
];

export const ALL_DOC_TYPE_PRESETS = DOC_TYPE_GROUPS.flatMap((group) => group.options);

export function normalizeDocTypeTitle(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function isBuiltinDocType(title) {
  const clean = normalizeDocTypeTitle(title).toLowerCase();
  if (!clean) return false;
  return ALL_DOC_TYPE_PRESETS.some((preset) => preset.toLowerCase() === clean);
}

function dedupeCustomList(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const clean = normalizeDocTypeTitle(item);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key) || isBuiltinDocType(clean)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= MAX_CUSTOM_DOC_TYPES) break;
  }
  return result;
}

export function loadCustomDocTypes() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeCustomList(parsed);
  } catch {
    return [];
  }
}

function persistCustomDocTypes(list) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Abaikan error kuota penyimpanan browser
  }
}

export function saveCustomDocType(rawTitle) {
  const clean = normalizeDocTypeTitle(rawTitle);
  const current = loadCustomDocTypes();
  if (!clean || isBuiltinDocType(clean)) {
    return current;
  }
  const filtered = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...filtered].slice(0, MAX_CUSTOM_DOC_TYPES);
  persistCustomDocTypes(next);
  return next;
}

export function removeCustomDocType(title) {
  const clean = normalizeDocTypeTitle(title).toLowerCase();
  const current = loadCustomDocTypes();
  const next = current.filter((item) => item.toLowerCase() !== clean);
  persistCustomDocTypes(next);
  return next;
}
