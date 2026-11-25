import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Mic, Pause, Play, Square, Upload } from 'lucide-react';
import { formatTimeHMS } from '../../utils/formatters';
import { confirmDialog, showToast } from '../../utils/swal';
import { saveAudioChunk, saveSessionMeta } from '../../services/indexedDb';

const BAR_COUNT = 28;
const VOICE_BITRATE = 24000; // 24 kbps mono Opus (~180 KB/menit, sangat jernih untuk rapat suara)
const SEGMENT_ROTATION_SEC = 900; // Rotasi segmen otomatis tiap 15 menit (~2.7 MB per segmen)

export default function AudioRecorder({
  sessionId,
  meetingMeta,
  onFinishRecording,
  onUploadFile,
  onBack,
  onCancelSession,
}) {
  const [status, setStatus] = useState('idle'); // idle | recording | paused
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [chunkStats, setChunkStats] = useState({ recorded: 0, saved: 0, synced: 0 });
  const [bars, setBars] = useState(() => Array(BAR_COUNT).fill(14));
  const [liveCaption, setLiveCaption] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const currentSegmentChunksRef = useRef([]);
  const completedSegmentsRef = useRef([]);
  const segmentIndexRef = useRef(0);
  const segmentStartElapsedRef = useRef(0);
  const isRotatingRef = useRef(false);
  const chunkIdxRef = useRef(0);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const speechRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');
  const chosenMimeFullRef = useRef('');
  const transcriptAccumRef = useRef('');
  const elapsedRef = useRef(0);

  const cleanupMedia = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {
        // ignore
      }
      speechRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupMedia();
  }, []);

  const setupAnalyser = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const nextBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = dataArray[i % dataArray.length] || 0;
          return Math.max(14, Math.min(96, Math.round((val / 255) * 90) + 12));
        });
        setBars(nextBars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // Fallback visual tetap berjalan jika Web Audio API tidak tersedia
    }
  };

  const setupLiveSpeech = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    try {
      const rec = new SpeechRec();
      rec.lang = 'id-ID';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            transcriptAccumRef.current = `${transcriptAccumRef.current} ${text}`.trim();
          } else {
            interim += text;
          }
        }
        const combined = `${transcriptAccumRef.current} ${interim}`.trim();
        setLiveCaption(combined.slice(-220));
      };
      rec.onerror = () => {};
      rec.start();
      speechRef.current = rec;
    } catch {
      // Abaikan jika browser memblokir speech recognition
    }
  };

  const createRecorderInstance = (stream) => {
    const chosenType = chosenMimeFullRef.current;
    try {
      const opts = chosenType
        ? { mimeType: chosenType, audioBitsPerSecond: VOICE_BITRATE }
        : { audioBitsPerSecond: VOICE_BITRATE };
      return new MediaRecorder(stream, opts);
    } catch {
      return chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);
    }
  };

  const attachAndStartRecorder = (stream, segIdx) => {
    const recorder = createRecorderInstance(stream);
    currentSegmentChunksRef.current = [];
    segmentStartElapsedRef.current = elapsedRef.current;

    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) {
        const idx = chunkIdxRef.current++;
        currentSegmentChunksRef.current.push(e.data);
        setRecordedBytes((prev) => prev + e.data.size);
        setChunkStats((prev) => ({ ...prev, recorded: prev.recorded + 1 }));
        try {
          await saveAudioChunk(sessionId, idx, e.data, segIdx);
          setChunkStats((prev) => ({ ...prev, saved: prev.saved + 1 }));
        } catch {
          // Tetap tersimpan di memory
        }
      }
    };

    recorder.onstop = () => {
      if (currentSegmentChunksRef.current.length > 0) {
        const segBlob = new Blob(currentSegmentChunksRef.current, { type: mimeTypeRef.current });
        completedSegmentsRef.current.push({
          segmentIndex: segIdx,
          mimeType: mimeTypeRef.current,
          blob: segBlob,
        });
        currentSegmentChunksRef.current = [];
      }

      if (isRotatingRef.current && streamRef.current) {
        isRotatingRef.current = false;
        const nextSegIdx = ++segmentIndexRef.current;
        attachAndStartRecorder(streamRef.current, nextSegIdx);
      }
    };

    recorder.start(10000); // Simpan potongan per 10 detik ke IndexedDB
    mediaRecorderRef.current = recorder;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenType =
        preferredTypes.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
      chosenMimeFullRef.current = chosenType;
      mimeTypeRef.current = chosenType ? chosenType.split(';')[0] : 'audio/webm';

      completedSegmentsRef.current = [];
      currentSegmentChunksRef.current = [];
      segmentIndexRef.current = 0;
      chunkIdxRef.current = 0;
      elapsedRef.current = 0;
      setRecordedBytes(0);

      await saveSessionMeta(sessionId, meetingMeta, 0);
      attachAndStartRecorder(stream, 0);
      setStatus('recording');

      setupAnalyser(stream);
      setupLiveSpeech();

      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          elapsedRef.current = next;

          if (next % 10 === 0) {
            saveSessionMeta(sessionId, meetingMeta, next).catch(() => {});
          }

          // Rotasi segmen otomatis tiap 15 menit agar setiap file segmen tetap kecil (<3 MB)
          if (
            next - segmentStartElapsedRef.current >= SEGMENT_ROTATION_SEC &&
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === 'recording' &&
            !isRotatingRef.current
          ) {
            isRotatingRef.current = true;
            mediaRecorderRef.current.stop();
          }

          return next;
        });
      }, 1000);
    } catch {
      showToast('error', 'Izin mikrofon ditolak atau perangkat tidak mendukung.');
    }
  };

  const togglePause = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;

    if (status === 'recording' && rec.state === 'recording') {
      rec.pause();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      setBars(Array(BAR_COUNT).fill(14));
      setStatus('paused');
    } else if (status === 'paused' && rec.state === 'paused') {
      rec.resume();
      setStatus('recording');
      if (streamRef.current) setupAnalyser(streamRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          const next = prev + 1;
          elapsedRef.current = next;
          return next;
        });
      }, 1000);
    }
  };

  const finalizeAndEmit = () => {
    const segs = completedSegmentsRef.current;
    const combinedBlob = new Blob(
      segs.map((s) => s.blob),
      { type: mimeTypeRef.current }
    );
    cleanupMedia();
    setChunkStats((prev) => ({ ...prev, synced: prev.recorded }));
    onFinishRecording({
      blob: combinedBlob,
      segments: segs,
      mimeType: mimeTypeRef.current,
      durationSec: elapsedRef.current,
      liveTranscriptHint: transcriptAccumRef.current,
    });
  };

  const handleStopPrompt = async () => {
    const durationText = formatTimeHMS(elapsedSec);
    const confirmed = await confirmDialog({
      icon: 'question',
      title: 'Rapat selesai?',
      html: `Rekaman <b>${durationText}</b> akan ditranskrip lalu disusun jadi notulen. Semua potongan sudah tersimpan aman di perangkat ini.`,
      confirmText: 'Selesai & susun notulen',
      cancelText: 'Lanjut merekam',
    });

    if (!confirmed) return;

    clearInterval(timerRef.current);
    isRotatingRef.current = false;
    setStatus('idle');

    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      const prevOnStop = rec.onstop;
      rec.onstop = () => {
        if (prevOnStop) prevOnStop();
        finalizeAndEmit();
      };
      rec.stop();
    } else {
      finalizeAndEmit();
    }
  };

  const handleBackGuard = async () => {
    if (status === 'idle' && chunkStats.recorded === 0) {
      onBack();
      return;
    }
    const confirmed = await confirmDialog({
      icon: 'warning',
      title: 'Batalkan rekaman?',
      text: 'Rekaman rapat yang sedang berjalan akan dihentikan dan dibuang jika Anda kembali sekarang.',
      confirmText: 'Ya, Keluar',
      cancelText: 'Tetap di Sini',
      danger: true,
    });
    if (confirmed) {
      cleanupMedia();
      if (onCancelSession) await onCancelSession(sessionId);
      onBack();
    }
  };

  const handleLocalUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    cleanupMedia();
    onUploadFile(file);
  };

  const sizeMbText = (recordedBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between px-4 py-4">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleBackGuard}
            className="min-w-[3rem] min-h-[3rem] -ml-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
            aria-label="Kembali"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate text-slate-100">
              {meetingMeta.title}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              {meetingMeta.location} · {meetingMeta.participantCount || 1} peserta
            </p>
          </div>

          {status === 'recording' && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/35 px-2.5 py-1 rounded-full shrink-0">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[0.6875rem] font-bold text-red-400 tracking-wider">REC</span>
            </div>
          )}
          {status === 'paused' && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/35 px-2.5 py-1 rounded-full shrink-0">
              <span className="text-[0.6875rem] font-bold text-amber-300 tracking-wider">JEDA</span>
            </div>
          )}
        </header>

        {/* Center Timer, Waveform, Live Caption, & Chunks */}
        <main className="flex flex-col items-center my-auto py-6">
          <p className="text-[0.7rem] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            {status === 'idle'
              ? 'Siap Merekam Rapat'
              : status === 'paused'
              ? 'Perekaman Dijeda'
              : `Sedang Merekam · ${sizeMbText} MB`}
          </p>

          <div className="font-mono text-4xl sm:text-5xl font-bold tracking-wider tabular-nums mb-7 text-white">
            {formatTimeHMS(elapsedSec)}
          </div>

          {/* Real-time Audio Waveform */}
          <div className="w-full h-24 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-center gap-1 px-4 overflow-hidden">
            {bars.map((heightPct, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  status === 'recording'
                    ? 'bg-blue-400'
                    : status === 'paused'
                    ? 'bg-amber-400/60'
                    : 'bg-slate-700'
                }`}
                style={{ height: `${heightPct}%` }}
              />
            ))}
          </div>

          {/* Live Caption Preview */}
          <div className="w-full mt-4 bg-slate-900/70 border border-slate-800/90 rounded-2xl px-3.5 py-2.5 min-h-[3.5rem] flex items-center">
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {liveCaption ||
                (status === 'recording'
                  ? 'Mendengarkan percakapan rapat... (kompresi suara 24 kbps aktif)'
                  : 'Tekan tombol mikrofon di bawah untuk mulai merekam audio rapat hingga 3 jam.')}
            </p>
          </div>

          {/* Fluid Flexbox Chunk Counters */}
          <div className="flex flex-wrap gap-2.5 w-full mt-4">
            {[
              { label: 'Potongan', val: chunkStats.recorded },
              { label: 'Tersimpan Lokal', val: chunkStats.saved },
              { label: 'Diproses AI', val: chunkStats.synced },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex-1 basis-[5.5rem] bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-2 text-center"
              >
                <div className="text-base font-bold text-slate-100 tabular-nums">{item.val}</div>
                <div className="text-[0.65rem] text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </main>

        {/* Bottom Controls (Touch target >= 48x48px) */}
        <footer className="pb-6 flex flex-col items-center gap-4">
          {status === 'idle' ? (
            <>
              <button
                type="button"
                onClick={startRecording}
                className="w-16 h-16 min-w-[3.5rem] min-h-[3.5rem] rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer"
                aria-label="Mulai Rekam"
              >
                <Mic className="w-7 h-7 text-white" />
              </button>

              <label className="inline-flex items-center gap-1.5 min-h-[2.75rem] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Atau Unggah File Rekaman</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleLocalUpload}
                  className="hidden"
                />
              </label>
            </>
          ) : (
            <div className="flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={togglePause}
                className="w-14 h-14 min-w-[3rem] min-h-[3rem] rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center active:scale-95 transition cursor-pointer"
                aria-label={status === 'paused' ? 'Lanjutkan Rekam' : 'Jeda Rekam'}
              >
                {status === 'paused' ? (
                  <Play className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                ) : (
                  <Pause className="w-6 h-6 text-amber-300" />
                )}
              </button>

              <button
                type="button"
                onClick={handleStopPrompt}
                className="w-16 h-16 min-w-[3.5rem] min-h-[3.5rem] rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-95 transition cursor-pointer"
                aria-label="Akhiri Rapat"
              >
                <Square className="w-6 h-6 text-white fill-white" />
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
