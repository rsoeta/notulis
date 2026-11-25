import React, { useMemo } from 'react';
import AudioRecorder from '../components/meeting/AudioRecorder';
import { processAndCreateMeeting } from '../services/meetingProcessor';
import { clearRecordingSession, saveMeetingAudioLocal } from '../services/indexedDb';
import {
  closeLoadingModal,
  showErrorAlert,
  showLoadingModal,
  showToast,
  updateLoadingModal,
} from '../utils/swal';

export default function RecordPage({ meetingMeta, onComplete, onBack }) {
  const sessionId = useMemo(
    () => `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    []
  );

  const submitAudioToAI = async ({ blob, segments, mimeType, durationSec, liveTranscriptHint }) => {
    showLoadingModal(
      'Menyusun Notulen...',
      'Menyiapkan audio rapat untuk diproses AI...'
    );

    try {
      const { meetingId, playbackBlob } = await processAndCreateMeeting({
        sessionId,
        blob,
        segments,
        mimeType,
        durationSec,
        meetingMeta,
        liveTranscriptHint,
        onProgress: ({ title, html }) => updateLoadingModal(title, html),
      });

      await saveMeetingAudioLocal(meetingId, playbackBlob).catch(() => {});
      await clearRecordingSession(sessionId).catch(() => {});

      closeLoadingModal();
      await showToast('success', 'Notulen AI berhasil disusun!');
      onComplete(meetingId);
    } catch (error) {
      closeLoadingModal();
      showErrorAlert(
        'Gagal Menyusun Notulen',
        error.message || 'Periksa koneksi internet Anda. Potongan audio tetap aman di perangkat.'
      );
    }
  };

  const handleUploadFile = async (file) => {
    const cleanMime = (file.type || 'audio/mpeg').split(';')[0];
    await submitAudioToAI({
      blob: file,
      segments: null,
      mimeType: cleanMime,
      durationSec: 60,
      liveTranscriptHint: '',
    });
  };

  return (
    <AudioRecorder
      sessionId={sessionId}
      meetingMeta={meetingMeta}
      onFinishRecording={submitAudioToAI}
      onUploadFile={handleUploadFile}
      onCancelSession={clearRecordingSession}
      onBack={onBack}
    />
  );
}
