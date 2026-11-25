/**
 * Utilitas pemecah audio berdurasi panjang di browser menjadi segmen WAV 16 kHz mono
 * agar aman dari batas payload Gemini inline_data (20 MB) & Google Apps Script.
 */

export const MAX_SINGLE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB binary (~13.3 MB Base64)

function writeAsciiString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Mengkodekan Float32Array PCM mono menjadi Blob WAV 16-bit yang valid & mandiri.
 */
export function encodeWavPcm16(samples, sampleRate) {
  const numSamples = samples.length;
  const dataByteLen = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(buffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLen, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataByteLen, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function mixDownToMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  if (channels === 1) {
    return audioBuffer.getChannelData(0);
  }
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const chData = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] += chData[i] / channels;
    }
  }
  return mono;
}

/**
 * Memecah Blob audio besar (WebM/MP4/MP3/WAV) menjadi beberapa segmen WAV 16 kHz mono
 * berdurasi ~4 menit (~7.68 MB per segmen) untuk pemrosesan sekuensial di Gemini.
 */
export async function splitAudioBlobToWavSegments(
  blob,
  { segmentDurationSec = 240, targetSampleRate = 16000, onStatus } = {}
) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Browser tidak mendukung pemecahan audio otomatis (Web Audio API).');
  }

  onStatus?.('Mendekode & mengompresi audio panjang di perangkat...');

  const ctx = new AudioCtx({ sampleRate: targetSampleRate });
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const monoSamples = mixDownToMono(audioBuffer);
    const actualRate = audioBuffer.sampleRate;
    const samplesPerSegment = Math.max(actualRate * 30, Math.floor(actualRate * segmentDurationSec));

    const segments = [];
    for (let start = 0; start < monoSamples.length; start += samplesPerSegment) {
      const end = Math.min(monoSamples.length, start + samplesPerSegment);
      const slice = monoSamples.subarray(start, end);
      if (slice.length < actualRate * 0.5) continue; // Lewati ekor kosong < 0.5 detik
      const wavBlob = encodeWavPcm16(slice, actualRate);
      segments.push({
        blob: wavBlob,
        mimeType: 'audio/wav',
      });
    }

    if (segments.length === 0) {
      throw new Error('Audio kosong atau terlalu pendek untuk diproses.');
    }

    return segments;
  } finally {
    try {
      await ctx.close();
    } catch {
      // ignore
    }
  }
}
