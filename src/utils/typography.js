export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 20;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_ID = 'plus-jakarta';
export const CUSTOM_FONT_ID = 'custom';

const STORAGE_KEY = 'notulis_typography_prefs';
const DYNAMIC_FONT_LINK_ID = 'notulis-dynamic-gfont';

export const FONT_FAMILIES = [
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    subtitle: 'Default · Rapi & Modern',
    googleFamily: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'inter',
    label: 'Inter',
    subtitle: 'Minimalis & Bersih',
    googleFamily: 'Inter',
    stack: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'poppins',
    label: 'Poppins',
    subtitle: 'Bulat & Ramah',
    googleFamily: 'Poppins',
    stack: "'Poppins', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'roboto',
    label: 'Roboto',
    subtitle: 'Klasik & Tegas',
    googleFamily: 'Roboto',
    stack: "'Roboto', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'nunito',
    label: 'Nunito',
    subtitle: 'Lembut & Nyaman',
    googleFamily: 'Nunito',
    stack: "'Nunito', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    subtitle: 'Netral & Humanis',
    googleFamily: 'Open Sans',
    stack: "'Open Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'lato',
    label: 'Lato',
    subtitle: 'Profesional & Seimbang',
    googleFamily: 'Lato',
    stack: "'Lato', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    subtitle: 'Geometris & Tegas',
    googleFamily: 'Montserrat',
    stack: "'Montserrat', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    subtitle: 'Serif Formal',
    googleFamily: 'Merriweather',
    stack: "'Merriweather', Georgia, 'Times New Roman', serif",
  },
  {
    id: 'lora',
    label: 'Lora',
    subtitle: 'Serif Editorial',
    googleFamily: 'Lora',
    stack: "'Lora', Georgia, 'Times New Roman', serif",
  },
  {
    id: 'system',
    label: 'Font Sistem',
    subtitle: 'Bawaan Perangkat',
    googleFamily: '',
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
];

export const CUSTOM_FONT_SUGGESTIONS = [
  'Outfit',
  'DM Sans',
  'Quicksand',
  'Space Grotesk',
  'Lexend',
  'Fira Sans',
  'Ubuntu',
  'Playfair Display',
];

export const FONT_SIZE_PRESETS = [12, 14, 16, 18, 20];

export function clampFontSize(val) {
  const num = Number(val);
  if (Number.isNaN(num)) return DEFAULT_FONT_SIZE;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(num)));
}

export function sanitizeGoogleFontName(raw) {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function loadGoogleFontStylesheet(fontName) {
  const cleanName = sanitizeGoogleFontName(fontName);
  if (!cleanName || typeof document === 'undefined') {
    return Promise.resolve();
  }

  const encoded = encodeURIComponent(cleanName).replace(/%20/g, '+');
  const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700;800&display=swap`;

  return new Promise((resolve, reject) => {
    let link = document.getElementById(DYNAMIC_FONT_LINK_ID);
    if (link && link.getAttribute('href') === href) {
      resolve(cleanName);
      return;
    }

    if (!link) {
      link = document.createElement('link');
      link.id = DYNAMIC_FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    link.onload = () => resolve(cleanName);
    link.onerror = () => reject(new Error(`Font "${cleanName}" tidak ditemukan di Google Fonts.`));
    link.href = href;
  });
}

export function getActiveFontMeta(prefs) {
  if (prefs?.fontId === CUSTOM_FONT_ID) {
    const clean = sanitizeGoogleFontName(prefs?.customFontName);
    if (clean) {
      return {
        id: CUSTOM_FONT_ID,
        label: clean,
        subtitle: 'Custom Google Font',
        googleFamily: clean,
        stack: `'${clean}', ui-sans-serif, system-ui, -apple-system, sans-serif`,
      };
    }
  }
  return FONT_FAMILIES.find((f) => f.id === prefs?.fontId) || FONT_FAMILIES[0];
}

export function loadTypographyPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { fontId: DEFAULT_FONT_ID, customFontName: '', fontSize: DEFAULT_FONT_SIZE };
    }
    const parsed = JSON.parse(raw);
    const customFontName = sanitizeGoogleFontName(parsed.customFontName);
    const isCustom = parsed.fontId === CUSTOM_FONT_ID && Boolean(customFontName);
    const preset = FONT_FAMILIES.find((f) => f.id === parsed.fontId);
    return {
      fontId: isCustom ? CUSTOM_FONT_ID : preset ? preset.id : DEFAULT_FONT_ID,
      customFontName: isCustom ? customFontName : '',
      fontSize: clampFontSize(parsed.fontSize),
    };
  } catch {
    return { fontId: DEFAULT_FONT_ID, customFontName: '', fontSize: DEFAULT_FONT_SIZE };
  }
}

export function applyTypographyPrefs(prefs) {
  if (typeof document === 'undefined') return;
  const fontMeta = getActiveFontMeta(prefs);
  const clampedSize = clampFontSize(prefs?.fontSize);
  const root = document.documentElement;
  root.style.setProperty('--app-font-family', fontMeta.stack);
  root.style.setProperty('--app-font-size', `${clampedSize}px`);

  if (fontMeta.googleFamily && fontMeta.id !== DEFAULT_FONT_ID) {
    loadGoogleFontStylesheet(fontMeta.googleFamily).catch(() => {});
  }
}

export function saveTypographyPrefs(prefs) {
  const customFontName = sanitizeGoogleFontName(prefs?.customFontName);
  const isCustom = prefs?.fontId === CUSTOM_FONT_ID && Boolean(customFontName);
  const preset = FONT_FAMILIES.find((f) => f.id === prefs?.fontId);

  const normalized = {
    fontId: isCustom ? CUSTOM_FONT_ID : preset ? preset.id : DEFAULT_FONT_ID,
    customFontName: isCustom ? customFontName : '',
    fontSize: clampFontSize(prefs?.fontSize),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
  applyTypographyPrefs(normalized);
  return normalized;
}

export function resetTypographyPrefs() {
  return saveTypographyPrefs({
    fontId: DEFAULT_FONT_ID,
    customFontName: '',
    fontSize: DEFAULT_FONT_SIZE,
  });
}
