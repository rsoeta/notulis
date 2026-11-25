import {
  apiProcessMeetingAudio,
  apiSynthesizeMinutes,
  apiTranscribeAudioSegment,
  blobToBase64,
} from './api';
import {
  MAX_SINGLE_UPLOAD_BYTES,
  splitAudioBlobToWavSegments,
} from '../utils/audioChunker';

const CHECKPOINT_PREFIX = 'notulis_seg_cache_';

function loadSegmentCheckpoint(sessionId) {
  if (!sessionId) return {};
  try {
    const raw = localStorage.getItem(`${CHECKPOINT_PREFIX}${sessionId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSegmentCheckpoint(sessionId, map) {
  if (!sessionId) return;
  try {
    localStorage.setItem(`${CHECKPOINT_PREFIX}${sessionId}`, JSON.stringify(map));
  } catch {
    // Abaikan jika localStorage penuh
  }
}

function clearSegmentCheckpoint(sessionId) {
  if (!sessionId) return;
  try {
    localStorage.removeItem(`${CHECKPOINT_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

async function transcribeWithRetry(payload, { onWait } = {}) {
  let lastError;
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await apiTranscribeAudioSegment(payload);
    } catch (err) {
      lastError = err;
      const code = Number(err.code) || 0;

      // Jangan ulangi jika error berasal dari API Key / autentikasi / format invalid
      if (code === 400 || code === 401 || code === 403 || code === 413 || code === 415) {
        throw err;
      }

      if (attempt < maxAttempts - 1) {
        const waitSec = code === 429 ? 18 : 4 * (attempt + 1);
        onWait?.(waitSec, code);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      }
    }
  }
  throw lastError;
}

/**
 * Menormalkan daftar segmen agar setiap segmen <= MAX_SINGLE_UPLOAD_BYTES.
 */
async function ensureUploadableSegments(blob, segments, mimeType, onProgress) {
  const candidateSegments =
    Array.isArray(segments) && segments.length > 0
      ? segments.map((s) => ({
          blob: s.blob || s,
          mimeType: (s.mimeType || s.blob?.type || mimeType || 'audio/webm').split(';')[0],
        }))
      : [{ blob, mimeType: (mimeType || blob?.type || 'audio/webm').split(';')[0] }];

  const finalSegments = [];
  for (let i = 0; i < candidateSegments.length; i++) {
    const seg = candidateSegments[i];
    if (!seg.blob || seg.blob.size === 0) continue;

    if (seg.blob.size <= MAX_SINGLE_UPLOAD_BYTES) {
      finalSegments.push(seg);
    } else {
      onProgress?.({
        title: 'Menyiapkan Audio Panjang...',
        html: `Audio melebihi 10 MB (${(seg.blob.size / (1024 * 1024)).toFixed(1)} MB).<br/>Memecah menjadi segmen 6 menit yang hemat kuota...`,
      });
      const splitParts = await splitAudioBlobToWavSegments(seg.blob, {
        segmentDurationSec: 360,
        targetSampleRate: 12000,
      });
      finalSegments.push(...splitParts);
    }
  }

  if (finalSegments.length === 0) {
    throw new Error('Tidak ada data audio yang dapat diproses.');
  }

  return finalSegments;
}

/**
 * Memproses rekaman pendek (single-shot) maupun rekaman panjang 40 menit–3 jam (multi-segmen)
 * dengan checkpoint resume per segmen & backoff otomatis saat limit Gemini (429).
 */
export async function processAndCreateMeeting({
  sessionId = '',
  blob,
  segments = null,
  mimeType = 'audio/webm',
  durationSec = 0,
  meetingMeta,
  liveTranscriptHint = '',
  onProgress,
}) {
  const combinedBlob =
    blob ||
    (Array.isArray(segments) && segments.length > 0
      ? new Blob(
          segments.map((s) => s.blob || s),
          { type: mimeType }
        )
      : null);

  if (!combinedBlob || combinedBlob.size === 0) {
    throw new Error('Rekaman audio kosong.');
  }

  const hasSingleSmallSegment =
    (!segments || segments.length <= 1) && combinedBlob.size <= MAX_SINGLE_UPLOAD_BYTES;

  // Jalur cepat 1 langkah untuk rekaman di bawah 10 MB
  if (hasSingleSmallSegment) {
    onProgress?.({
      title: 'Menyusun Notulen...',
      html: '<b>1/2</b> Mengunggah audio & mentranskripsi dengan AI...<br/>Mohon tunggu ±1 menit.',
    });
    const audioBase64 = await blobToBase64(combinedBlob);
    const res = await apiProcessMeetingAudio({
      kopId: meetingMeta.kopId || '',
      title: meetingMeta.title,
      docTypeTitle: meetingMeta.docTypeTitle || 'NOTULEN RAPAT',
      docNumber: meetingMeta.docNumber || '-',
      location: meetingMeta.location,
      participants: meetingMeta.participants || [],
      participantCount: meetingMeta.participantCount || 1,
      durationSec,
      audioBase64,
      mimeType: (mimeType || 'audio/webm').split(';')[0],
      liveTranscriptHint,
    });
    return { meetingId: res.data.meetingId, playbackBlob: combinedBlob };
  }

  // Jalur multi-segmen untuk audio panjang (>10 MB / 40 menit – 3 jam)
  const uploadSegments = await ensureUploadableSegments(
    combinedBlob,
    segments,
    mimeType,
    onProgress
  );

  const total = uploadSegments.length;
  const checkpoint = loadSegmentCheckpoint(sessionId);
  const transcriptParts = [];

  for (let i = 0; i < total; i++) {
    const segNum = i + 1;
    if (typeof checkpoint[segNum] === 'string' && checkpoint[segNum].length > 0) {
      transcriptParts.push(`[Bagian ${segNum}/${total}]\n${checkpoint[segNum]}`);
      continue;
    }

    const seg = uploadSegments[i];
    const sizeMb = (seg.blob.size / (1024 * 1024)).toFixed(1);
    onProgress?.({
      title: 'Mentranskripsi Audio...',
      html: `Memproses bagian <b>${segNum} dari ${total}</b> (${sizeMb} MB)...<br/>Jangan tutup halaman ini.`,
    });

    const audioBase64 = await blobToBase64(seg.blob);
    const prevContext = transcriptParts.length
      ? transcriptParts[transcriptParts.length - 1].slice(-250)
      : '';

    const segRes = await transcribeWithRetry(
      {
        title: meetingMeta.title,
        location: meetingMeta.location,
        segmentIndex: segNum,
        totalSegments: total,
        previousContext: prevContext,
        audioBase64,
        mimeType: seg.mimeType,
      },
      {
        onWait: (waitSec, code) => {
          onProgress?.({
            title: code === 429 ? 'Menunggu Kuota Gemini...' : 'Mencoba Ulang...',
            html:
              code === 429
                ? `Batas kecepatan Gemini tercapai pada bagian <b>${segNum}/${total}</b>.<br/>Melanjutkan otomatis dalam ${waitSec} detik...`
                : `Koneksi sibuk pada bagian <b>${segNum}/${total}</b>.<br/>Mencoba ulang dalam ${waitSec} detik...`,
          });
        },
      }
    );

    const text = String(segRes.data?.transcript || '').trim();
    checkpoint[segNum] = text || '(Hening)';
    saveSegmentCheckpoint(sessionId, checkpoint);

    if (text) {
      transcriptParts.push(`[Bagian ${segNum}/${total}]\n${text}`);
    }

    // Jeda ringan antar segmen agar tidak memicu rate-limit RPM Gemini
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const fullTranscript =
    transcriptParts.join('\n\n').trim() ||
    liveTranscriptHint ||
    '(Audio tidak memiliki ucapan terdeteksi.)';

  onProgress?.({
    title: 'Menyusun Notulen Resmi...',
    html: 'Menggabungkan seluruh transkrip menjadi keputusan & tabel tindak lanjut...',
  });

  const synthRes = await apiSynthesizeMinutes({
    kopId: meetingMeta.kopId || '',
    title: meetingMeta.title,
    docTypeTitle: meetingMeta.docTypeTitle || 'NOTULEN RAPAT',
    docNumber: meetingMeta.docNumber || '-',
    location: meetingMeta.location,
    participants: meetingMeta.participants || [],
    participantCount: meetingMeta.participantCount || 1,
    durationSec,
    transcriptText: fullTranscript,
  });

  clearSegmentCheckpoint(sessionId);

  return { meetingId: synthRes.data.meetingId, playbackBlob: combinedBlob };
}
