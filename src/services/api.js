import { mockRequest } from './mockBackend';

const GAS_URL = (
  import.meta.env.VITE_GAS_WEBAPP_URL ||
  import.meta.env.VITE_GAS_API_URL ||
  ''
).trim();
const API_KEY = (import.meta.env.VITE_API_KEY || '').trim();

const TOKEN_STORAGE_KEY = 'notulis_token';
const USER_STORAGE_KEY = 'notulis_user';

export function isDemoMode() {
  return !GAS_URL;
}

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token || '');
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user || null));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Mengirim POST ke Google Apps Script menggunakan Content-Type: text/plain;charset=utf-8
 * agar menjadi Simple Request dan terhindar dari blokir CORS preflight OPTIONS.
 */
export async function postToGAS(action, payload = {}) {
  const token = getSessionToken();

  if (isDemoMode()) {
    return mockRequest(action, { ...payload, token });
  }

  const controller = new AbortController();
  const longActions = new Set([
    'processMeetingAudio',
    'transcribeAudioSegment',
    'synthesizeMinutesFromTranscript',
    'testGeminiApiKey',
    'exportDocx',
  ]);
  const timeoutMs = longActions.has(action) ? 180000 : 35000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        apiKey: API_KEY,
        token,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error('Gagal terhubung ke server Google Apps Script.');
    }

    const result = await response.json();
    if (!result.success) {
      const err = new Error(result.message || 'Permintaan tidak dapat diproses.');
      err.code = result.code;
      throw err;
    }
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Koneksi timeout. Proses di server memakan waktu terlalu lama.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getFromGAS(action, params = {}) {
  const token = getSessionToken();

  if (isDemoMode()) {
    return mockRequest(action, { ...params, token });
  }

  const query = new URLSearchParams({
    action,
    apiKey: API_KEY,
    token,
    ...params,
  }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${GAS_URL}?${query}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Gagal mengambil data dari server.');
    }

    const result = await response.json();
    if (!result.success) {
      const err = new Error(result.message || 'Gagal memuat data.');
      err.code = result.code;
      throw err;
    }
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Koneksi timeout saat memuat data.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ==================== HIGH-LEVEL API HELPERS ====================

export const apiLogin = (email, password, turnstileToken = '') =>
  postToGAS('login', {
    email,
    password,
    turnstileToken,
    'cf-turnstile-response': turnstileToken,
  });

export const apiRegister = (fullName, email, password, turnstileToken = '') =>
  postToGAS('register', {
    fullName,
    email,
    password,
    turnstileToken,
    'cf-turnstile-response': turnstileToken,
  });
export const apiLogout = () => postToGAS('logout');
export const apiGetProfile = () => getFromGAS('getProfile');
export const apiSaveGeminiApiKey = (geminiApiKey = '') =>
  postToGAS('saveGeminiApiKey', { geminiApiKey });
export const apiTestGeminiApiKey = (geminiApiKey = '') =>
  postToGAS('testGeminiApiKey', { geminiApiKey });

export const apiGetMeetings = () => getFromGAS('getMeetings');
export const apiGetMeetingDetail = (meetingId) => getFromGAS('getMeetingDetail', { meetingId });
export const apiGetAudioBase64 = (meetingId) => getFromGAS('getAudioBase64', { meetingId });
export const apiProcessMeetingAudio = (payload) => postToGAS('processMeetingAudio', payload);
export const apiTranscribeAudioSegment = (payload) => postToGAS('transcribeAudioSegment', payload);
export const apiSynthesizeMinutes = (payload) =>
  postToGAS('synthesizeMinutesFromTranscript', payload);
export const apiUpdateMeeting = (payload) => postToGAS('updateMeeting', payload);
export const apiUpdateActionItemStatus = (meetingId, actionId, status) =>
  postToGAS('updateActionItemStatus', { meetingId, actionId, status });
export const apiDeleteMeeting = (meetingId) => postToGAS('deleteMeeting', { meetingId });
export const apiExportDocx = (meetingId) => postToGAS('exportDocx', { meetingId });

export const apiGetKopList = () => getFromGAS('getKopList');
export const apiSaveKop = (kopPayload) => postToGAS('saveKop', kopPayload);
export const apiDeleteKop = (kopId) => postToGAS('deleteKop', { kopId });

export const apiGetUsers = () => getFromGAS('getUsers');
export const apiManageUser = (payload) => postToGAS('manageUser', payload);

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64, mimeType = 'audio/webm') {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNums)], { type: mimeType });
}
