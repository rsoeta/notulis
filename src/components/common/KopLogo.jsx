import React, { useEffect, useMemo, useState } from 'react';

function extractDriveFileId(rawVal) {
  const str = String(rawVal || '').replace(/^'+/, '').trim();
  if (!str) return '';
  if (str.startsWith('DRIVE_IMAGE:')) {
    return str.replace('DRIVE_IMAGE:', '').trim();
  }
  if (str.startsWith('DRIVE_FILE:')) {
    return str.replace('DRIVE_FILE:', '').trim();
  }
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  const dMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];
  if (/^[a-zA-Z0-9_-]{20,80}$/.test(str)) return str;
  return '';
}

export function normalizeLogoCandidates(rawUrl) {
  const str = String(rawUrl || '').replace(/^'+/, '').trim();
  if (!str) return [];

  if (str.startsWith('data:image/')) {
    const commaIdx = str.indexOf(',');
    if (commaIdx < 0) return [];
    const header = str.slice(0, commaIdx).trim();
    const payload = str.slice(commaIdx + 1).replace(/\s+/g, '');
    return payload ? [`${header},${payload}`] : [];
  }

  const driveId = extractDriveFileId(str);
  if (driveId) {
    const candidates = [
      `https://lh3.googleusercontent.com/d/${driveId}=w320`,
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w320`,
    ];
    return Array.from(new Set(candidates));
  }

  if (/^https?:\/\//i.test(str)) {
    return [str];
  }

  return [];
}

/**
 * Merender logo kop instansi dengan normalisasi data URL / Google Drive URL
 * serta fallback otomatis bila URL pertama gagal dimuat.
 */
export default function KopLogo({
  src,
  alt = 'Logo Instansi',
  className = 'w-14 h-14 object-contain shrink-0',
  showErrorFallback = false,
}) {
  const candidates = useMemo(() => normalizeLogoCandidates(src), [src]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCandidateIdx(0);
    setFailed(false);
  }, [src]);

  if (candidates.length === 0) {
    return null;
  }

  if (failed || candidateIdx >= candidates.length) {
    if (!showErrorFallback) return null;
    return (
      <div className="w-14 h-14 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-700 text-[0.65rem] font-semibold flex items-center justify-center text-center p-1 leading-tight shrink-0">
        Logo gagal dimuat
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIdx]}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      className={className}
      onError={() => {
        if (candidateIdx + 1 < candidates.length) {
          setCandidateIdx((idx) => idx + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
