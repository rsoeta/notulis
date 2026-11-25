const DB_NAME = 'notulis_audio_db';
const DB_VERSION = 1;
const STORE_CHUNKS = 'audio_chunks';
const STORE_SESSIONS = 'recording_sessions';
const STORE_PLAYBACK = 'meeting_audio_cache';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYBACK)) {
        db.createObjectStore(STORE_PLAYBACK, { keyPath: 'meetingId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSessionMeta(sessionId, meta, elapsedSec = 0) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).put({
      sessionId,
      meta,
      elapsedSec,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const req = tx.objectStore(STORE_SESSIONS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioChunk(sessionId, index, blob, segmentIndex = 0) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).add({
      sessionId,
      index,
      segmentIndex,
      blob,
      createdAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSessionChunks(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const idx = tx.objectStore(STORE_CHUNKS).index('sessionId');
    const req = idx.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => {
      const items = (req.result || []).sort((a, b) => a.index - b.index);
      resolve(items.map((item) => item.blob));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mengelompokkan potongan IndexedDB per segmentIndex (kompatibel mundur dengan rekaman lama).
 */
export async function getSessionSegments(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const idx = tx.objectStore(STORE_CHUNKS).index('sessionId');
    const req = idx.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => {
      const items = (req.result || []).sort((a, b) => a.index - b.index);
      if (items.length === 0) {
        resolve([]);
        return;
      }
      const grouped = new Map();
      items.forEach((item) => {
        const segIdx = Number.isInteger(item.segmentIndex) ? item.segmentIndex : 0;
        if (!grouped.has(segIdx)) grouped.set(segIdx, []);
        grouped.get(segIdx).push(item.blob);
      });

      const segments = Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([segmentIndex, blobs]) => {
          const mimeType = (blobs[0]?.type || 'audio/webm').split(';')[0] || 'audio/webm';
          return {
            segmentIndex,
            mimeType,
            blob: new Blob(blobs, { type: mimeType }),
          };
        });
      resolve(segments);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearRecordingSession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSIONS, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(sessionId);
    const idx = tx.objectStore(STORE_CHUNKS).index('sessionId');
    const cursorReq = idx.openCursor(IDBKeyRange.only(sessionId));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMeetingAudioLocal(meetingId, blob) {
  if (!meetingId || !blob) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYBACK, 'readwrite');
    tx.objectStore(STORE_PLAYBACK).put({
      meetingId,
      blob,
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeetingAudioLocal(meetingId) {
  if (!meetingId) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYBACK, 'readonly');
    const req = tx.objectStore(STORE_PLAYBACK).get(meetingId);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMeetingAudioLocal(meetingId) {
  if (!meetingId) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYBACK, 'readwrite');
    tx.objectStore(STORE_PLAYBACK).delete(meetingId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
