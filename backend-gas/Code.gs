/**
 * ============================================================================
 * NOTULIS — AI Meeting Minutes Serverless Backend (Google Apps Script)
 * ============================================================================
 * Script Properties wajib diisi di Project Settings > Script Properties:
 * - SPREADSHEET_ID       : ID Google Spreadsheet database (opsional jika script terikat langsung ke Sheet)
 * - DRIVE_FOLDER_ID      : ID Folder Google Drive penyimpanan audio, logo, transkrip, & .docx
 * - GEMINI_API_KEY       : API Key Google Gemini (gemini-3.8-flash)
 * - GEMINI_MODEL         : (Opsional) Override nama model Gemini (default: gemini-3.8-flash)
 * - API_KEY              : Token keamanan sederhana yang dicocokkan dengan VITE_API_KEY
 * - TURNSTILE_SECRET_KEY : (Opsional) Secret Key Cloudflare Turnstile (fallback dummy dev key)
 * ============================================================================
 */

const PROPS = PropertiesService.getScriptProperties();
const MAX_AUDIO_BASE64_LEN = 18 * 1024 * 1024; // ~13.5MB binary per segmen (aman di bawah batas 20MB inline_data Gemini)
const MAX_CELL_TRANSCRIPT_LEN = 40000;
const ALLOWED_AUDIO_MIMES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'audio/x-m4a'
];

// ==================== SPREADSHEET & RESPONSE HELPERS ====================

function getSpreadsheet() {
  const ssId = PROPS.getProperty('SPREADSHEET_ID');
  if (ssId) {
    return SpreadsheetApp.openById(ssId);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('SPREADSHEET_ID belum diatur di Script Properties.');
  }
  return active;
}

function getSheet(name) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet "${name}" tidak ditemukan. Jalankan setupInitialSheets() terlebih dahulu.`);
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sanitasi sel agar aman dari Spreadsheet Formula Injection (=, +, -, @)
 */
function sanitizeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

/**
 * Menghapus tanda petik pengaman formula saat membaca kembali untuk UI
 */
function unsanitizeDisplay(val) {
  if (typeof val !== 'string') return val;
  return val.startsWith("'") && /^[=+\-@]/.test(val.slice(1)) ? val.slice(1) : val;
}

function validateApiKey(providedKey) {
  const expected = PROPS.getProperty('API_KEY');
  if (!expected) return true; // Jika belum diset di Script Properties, izinkan
  return typeof providedKey === 'string' && providedKey === expected;
}

// ==================== PASSWORD & TOKEN SECURITY ====================

function sha256Hex(input) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  );
  return digest
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
}

function hashPassword(password, salt) {
  const useSalt = salt || Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const hash = sha256Hex(`${useSalt}:${password}`);
  return `${useSalt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes('$')) return false;
  const parts = stored.split('$');
  const salt = parts[0];
  const expected = parts[1];
  return sha256Hex(`${salt}:${password}`) === expected;
}

function maskApiKey(key) {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 10) return '••••••••';
  return `${clean.slice(0, 6)}••••••${clean.slice(-4)}`;
}

function ensureUsersGeminiColumn(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 9) {
    sheet.getRange(1, 9).setValue('gemini_api_key');
    sheet.getRange(1, 9).setBackground('#0F172A').setFontColor('#FFFFFF').setFontWeight('bold');
  }
}

function authenticateToken(token) {
  if (!token || typeof token !== 'string') return null;
  const rows = getSheet('Users').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[6] === token && row[5] === 'ACTIVE') {
      const geminiKey = String(row[8] || '').trim();
      return {
        rowIndex: i + 1,
        userId: row[0],
        email: row[1],
        fullName: row[3],
        role: row[4],
        licenseStatus: row[5],
        geminiApiKey: geminiKey,
        hasCustomGeminiKey: Boolean(geminiKey),
        geminiKeyMasked: maskApiKey(geminiKey)
      };
    }
  }
  return null;
}

// ==================== GOOGLE DRIVE & LOGO HELPERS ====================

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

function resolveLogoDataUrl(rawVal) {
  const str = String(rawVal || '').replace(/^'+/, '').trim();
  if (!str) return '';
  if (str.startsWith('data:image/')) {
    const commaIdx = str.indexOf(',');
    if (commaIdx < 0) return '';
    const header = str.slice(0, commaIdx).trim();
    const payload = str.slice(commaIdx + 1).replace(/\s+/g, '');
    return payload ? `${header},${payload}` : '';
  }
  const fileId = extractDriveFileId(str);
  if (fileId) {
    try {
      const blob = DriveApp.getFileById(fileId).getBlob();
      const rawMime = String(blob.getContentType() || '').split(';')[0].trim().toLowerCase();
      const mime = rawMime.startsWith('image/') ? rawMime : 'image/png';
      return `data:${mime};base64,${Utilities.base64Encode(blob.getBytes())}`;
    } catch (e) {
      return `https://lh3.googleusercontent.com/d/${fileId}=w320`;
    }
  }
  return /^https?:\/\//i.test(str) ? str : '';
}

function resolveLogoBlob(rawVal) {
  const str = String(rawVal || '').replace(/^'+/, '').trim();
  if (!str) return null;
  if (str.startsWith('data:image/')) {
    const commaIdx = str.indexOf(',');
    if (commaIdx < 0) return null;
    const header = str.slice(0, commaIdx);
    const payload = str.slice(commaIdx + 1).replace(/\s+/g, '');
    if (!payload) return null;
    const mimeMatch = header.match(/data:([^;]+);/i);
    const rawMime = mimeMatch ? mimeMatch[1].trim().toLowerCase() : 'image/png';
    const mime = rawMime.startsWith('image/') ? rawMime : 'image/png';
    try {
      return Utilities.newBlob(Utilities.base64Decode(payload), mime, 'logo.png');
    } catch (e) {
      return null;
    }
  }
  const fileId = extractDriveFileId(str);
  if (!fileId) return null;
  try {
    return DriveApp.getFileById(fileId).getBlob();
  } catch (e) {
    return null;
  }
}

function getDriveFolder() {
  const folderId = PROPS.getProperty('DRIVE_FOLDER_ID');
  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }
  const folders = DriveApp.getFoldersByName('Notulis_Storage');
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder('Notulis_Storage');
}

function saveTranscriptIfLong(meetingId, text) {
  const str = String(text || '');
  if (str.length <= MAX_CELL_TRANSCRIPT_LEN) {
    return sanitizeCell(str);
  }
  const folder = getDriveFolder();
  const file = folder.createFile(`${meetingId}_transcript.txt`, str, MimeType.PLAIN_TEXT);
  return `DRIVE_FILE:${file.getId()}`;
}

function readTranscript(rawVal) {
  const str = String(rawVal || '');
  if (str.startsWith('DRIVE_FILE:')) {
    const fileId = str.replace('DRIVE_FILE:', '').trim();
    try {
      return DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');
    } catch (e) {
      return '(Transkrip tersimpan di Google Drive tidak dapat diakses.)';
    }
  }
  return unsanitizeDisplay(str);
}

function safeTrashDriveFile(fileIdOrRef) {
  if (!fileIdOrRef || typeof fileIdOrRef !== 'string') return;
  let id = fileIdOrRef.trim();
  if (id.startsWith('DRIVE_FILE:')) {
    id = id.replace('DRIVE_FILE:', '').trim();
  }
  if (!id || id.startsWith('http')) return;
  try {
    DriveApp.getFileById(id).setTrashed(true);
  } catch (e) {
    // Abaikan jika file sudah dihapus atau tidak ditemukan
  }
}

// ==================== INITIAL DATABASE SETUP ====================

/**
 * Jalankan fungsi ini SEKALI dari editor GAS untuk membuat 5 tab sheet,
 * header kolom, styling, serta data awal (ADMIN, USER, Kop & Contoh Rapat).
 */
function setupInitialSheets() {
  const ss = getSpreadsheet();

  const schema = [
    {
      name: 'Users',
      headers: [
        'user_id',
        'email',
        'password_hash',
        'full_name',
        'role',
        'license_status',
        'session_token',
        'created_at',
        'gemini_api_key'
      ],
      widths: [240, 220, 260, 200, 90, 110, 240, 180, 220]
    },
    {
      name: 'Instansi_Kop',
      headers: [
        'kop_id',
        'user_id',
        'header_line_1',
        'header_line_2',
        'institution_name',
        'address',
        'phone',
        'logo_drive_url'
      ],
      widths: [240, 240, 240, 200, 240, 260, 160, 260]
    },
    {
      name: 'Meetings',
      headers: [
        'meeting_id',
        'user_id',
        'kop_id',
        'title',
        'doc_type_title',
        'doc_number',
        'meeting_date',
        'time_range',
        'location',
        'duration_sec',
        'participant_count',
        'audio_drive_id',
        'docx_drive_id',
        'transcript_text',
        'summary_json',
        'status',
        'is_ai_generated',
        'created_at'
      ],
      widths: [240, 240, 240, 280, 200, 180, 110, 140, 220, 100, 110, 200, 200, 320, 320, 110, 110, 180]
    },
    {
      name: 'Participants',
      headers: [
        'participant_id',
        'meeting_id',
        'user_id',
        'name',
        'position',
        'attendance_status'
      ],
      widths: [240, 240, 240, 220, 200, 130]
    },
    {
      name: 'Action_Items',
      headers: [
        'action_id',
        'meeting_id',
        'user_id',
        'order_no',
        'description',
        'pic_name',
        'deadline',
        'status'
      ],
      widths: [240, 240, 240, 80, 320, 180, 140, 100]
    }
  ];

  schema.forEach((def) => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
    } else {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    }
    const headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    headerRange
      .setBackground('#0F172A')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    def.widths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));
  });

  // Hapus sheet default "Sheet1" jika kosong & tab lain sudah terbuat
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  // Seed akun awal jika Users masih kosong
  const usersSheet = getSheet('Users');
  if (usersSheet.getLastRow() <= 1) {
    const nowIso = new Date().toISOString();
    const adminId = Utilities.getUuid();
    const userId = Utilities.getUuid();

    usersSheet.appendRow([
      adminId,
      'admin@notulis.id',
      hashPassword('Admin123!'),
      'Administrator Notulis',
      'ADMIN',
      'ACTIVE',
      '',
      nowIso,
      ''
    ]);
    usersSheet.appendRow([
      userId,
      'sekretaris@smpn3sejahtera.sch.id',
      hashPassword('Notulis123!'),
      'Siti Aminah, S.Pd.',
      'USER',
      'ACTIVE',
      '',
      nowIso,
      ''
    ]);

    // Seed default Instansi_Kop
    const kopId = Utilities.getUuid();
    const kopSheet = getSheet('Instansi_Kop');
    kopSheet.appendRow([
      kopId,
      userId,
      'PEMERINTAH KABUPATEN SEJAHTERA',
      'DINAS PENDIDIKAN',
      'SMP NEGERI 3 SEJAHTERA',
      'Jl. Pelajar No. 3, Kota Sejahtera',
      'Telp. (0000) 551 203',
      ''
    ]);

    // Seed 1 contoh rapat lengkap
    const meetingId = Utilities.getUuid();
    const meetingsSheet = getSheet('Meetings');
    const summaryObj = {
      pembahasan:
        'Rapat dibuka oleh Kepala Sekolah pukul 13.00 WIB membahas kesiapan penyusunan kisi-kisi soal, jadwal pengawasan ruang, serta digitalisasi rekap nilai Penilaian Akhir Semester (PAS) Ganjil Tahun Ajaran 2026/2027.',
      keputusan: [
        'Pelaksanaan Penilaian Akhir Semester (PAS) dimulai tanggal 7 Desember 2026 secara luring berbasis kertas dan CBT.',
        'Setiap guru mata pelajaran wajib mengunggah naskah soal dan kisi-kisi maksimal tanggal 30 November 2026.',
        'Panitia ujian membentuk tim verifikasi soal dan jadwal pengawas ruang lintas rumpun mata pelajaran.'
      ]
    };

    meetingsSheet.appendRow([
      meetingId,
      userId,
      kopId,
      'Rapat Dewan Guru Persiapan Penilaian Akhir Semester',
      'NOTULEN RAPAT DEWAN GURU',
      '421.3/046/NOT/XI/2026',
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
      '13.00 – 15.15 WIB',
      'Ruang Guru SMP Negeri 3 Sejahtera',
      4820,
      4,
      '',
      '',
      'Kepala Sekolah: Assalamualaikum warahmatullahi wabarakatuh. Hari ini kita bahas persiapan PAS Ganjil agar seluruh guru mata pelajaran siap dengan kisi-kisi dan bank soal.\nWakil Kurikulum: Usulan pelaksanaan PAS dimulai 7 Desember 2026. Pengumpulan soal maksimal 30 November 2026 agar tim editor punya waktu telaah.',
      JSON.stringify(summaryObj),
      'COMPLETED',
      true,
      nowIso
    ]);

    const partSheet = getSheet('Participants');
    const sampleParticipants = [
      ['Drs. H. Ahmad Fauzi, M.Pd.', 'Kepala Sekolah', 'HADIR'],
      ['Rina Kusuma, S.Pd.', 'Wakil Kepala Kurikulum', 'HADIR'],
      ['Budi Santoso, S.Pd.', 'Koordinator Sarpras & CBT', 'HADIR'],
      ['Siti Aminah, S.Pd.', 'Sekretaris / Notulis', 'HADIR']
    ];
    sampleParticipants.forEach((p) => {
      partSheet.appendRow([
        Utilities.getUuid(),
        meetingId,
        userId,
        p[0],
        p[1],
        p[2]
      ]);
    });

    const actionSheet = getSheet('Action_Items');
    const sampleActions = [
      [1, 'Menyusun & mengunggah kisi-kisi dan naskah soal PAS', 'Guru Mata Pelajaran', '30 Nov 2026', 'PENDING'],
      [2, 'Finalisasi jadwal pengawas ruang dan tata tertib ujian', 'Wakil Kepala Kurikulum', '2 Des 2026', 'DONE'],
      [3, 'Pengecekan perangkat server dan jaringan laboratorium CBT', 'Koordinator Sarpras', '4 Des 2026', 'PENDING']
    ];
    sampleActions.forEach((a) => {
      actionSheet.appendRow([
        Utilities.getUuid(),
        meetingId,
        userId,
        a[0],
        a[1],
        a[2],
        a[3],
        a[4]
      ]);
    });
  }

  Logger.log('Setup database Google Sheets Notulis berhasil.');
  return 'Setup berhasil!';
}

// ==================== ROUTER GET (READ-ONLY) ====================

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (!validateApiKey(params.apiKey)) {
      return jsonResponse({ success: false, code: 403, message: 'API Key tidak valid.' });
    }

    const action = params.action || '';
    if (action === 'health') {
      return jsonResponse({
        success: true,
        message: 'Notulis GAS API aktif.',
        timestamp: new Date().toISOString()
      });
    }

    const auth = authenticateToken(params.token);
    if (!auth) {
      return jsonResponse({ success: false, code: 401, message: 'Sesi tidak valid atau telah berakhir.' });
    }

    if (action === 'getProfile') {
      return jsonResponse({
        success: true,
        data: {
          userId: auth.userId,
          email: auth.email,
          fullName: auth.fullName,
          role: auth.role,
          licenseStatus: auth.licenseStatus,
          hasCustomGeminiKey: auth.hasCustomGeminiKey,
          geminiKeyMasked: auth.geminiKeyMasked
        }
      });
    }

    if (action === 'getMeetings') {
      return jsonResponse(handleGetMeetings(auth.userId));
    }

    if (action === 'getMeetingDetail') {
      return jsonResponse(handleGetMeetingDetail(params.meetingId, auth.userId));
    }

    if (action === 'getAudioBase64') {
      return jsonResponse(handleGetAudioBase64(params.meetingId, auth.userId));
    }

    if (action === 'getKopList') {
      return jsonResponse(handleGetKopList(auth.userId));
    }

    if (action === 'getUsers') {
      if (auth.role !== 'ADMIN') {
        return jsonResponse({ success: false, code: 403, message: 'Akses ditolak.' });
      }
      return jsonResponse(handleGetUsers());
    }

    return jsonResponse({ success: false, code: 400, message: 'Permintaan tidak valid.' });
  } catch (err) {
    Logger.log(err);
    return jsonResponse({ success: false, code: 500, message: 'Terjadi kesalahan sistem.' });
  }
}

// ==================== ROUTER POST (WRITE + LOCKSERVICE) ====================

function doPost(e) {
  const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (parseErr) {
    return jsonResponse({ success: false, code: 400, message: 'Format permintaan tidak valid.' });
  }

  if (!validateApiKey(body.apiKey)) {
    return jsonResponse({ success: false, code: 403, message: 'API Key tidak valid.' });
  }

  const action = body.action || '';

  // Transkripsi segmen audio & tes koneksi Gemini tidak menulis ke Sheet -> jalankan di luar LockService
  if (action === 'transcribeAudioSegment') {
    try {
      const authSeg = authenticateToken(body.token);
      if (!authSeg) {
        return jsonResponse({ success: false, code: 401, message: 'Sesi tidak valid atau telah berakhir.' });
      }
      return jsonResponse(handleTranscribeAudioSegment(body, authSeg.geminiApiKey, authSeg.userId));
    } catch (segErr) {
      Logger.log(segErr);
      return jsonResponse({
        success: false,
        code: segErr.httpCode || 500,
        message: segErr.message || 'Gagal mentranskripsi segmen audio.'
      });
    }
  }

  if (action === 'testGeminiApiKey') {
    try {
      const authTest = authenticateToken(body.token);
      if (!authTest) {
        return jsonResponse({ success: false, code: 401, message: 'Sesi tidak valid atau telah berakhir.' });
      }
      return jsonResponse(handleTestGeminiApiKey(body, authTest));
    } catch (testErr) {
      Logger.log(testErr);
      return jsonResponse({
        success: false,
        code: testErr.httpCode || 500,
        message: testErr.message || 'Gagal menguji koneksi Gemini API Key.'
      });
    }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    // Endpoint publik (tanpa token sesi)
    if (action === 'login') {
      return jsonResponse(handleLogin(body));
    }
    if (action === 'register') {
      return jsonResponse(handleRegister(body));
    }

    // Endpoint terautentikasi
    const auth = authenticateToken(body.token);
    if (!auth) {
      return jsonResponse({ success: false, code: 401, message: 'Sesi tidak valid atau telah berakhir.' });
    }

    if (action === 'logout') {
      return jsonResponse(handleLogout(auth.rowIndex));
    }
    if (action === 'saveGeminiApiKey') {
      return jsonResponse(handleSaveGeminiApiKey(body, auth));
    }
    if (action === 'processMeetingAudio') {
      return jsonResponse(handleProcessMeetingAudio(body, auth.userId, auth.geminiApiKey));
    }
    if (action === 'synthesizeMinutesFromTranscript') {
      return jsonResponse(handleSynthesizeMinutes(body, auth.userId, auth.geminiApiKey));
    }
    if (action === 'updateMeeting') {
      return jsonResponse(handleUpdateMeeting(body, auth.userId));
    }
    if (action === 'updateActionItemStatus') {
      return jsonResponse(handleUpdateActionItemStatus(body, auth.userId));
    }
    if (action === 'deleteMeeting') {
      return jsonResponse(handleDeleteMeeting(body.meetingId, auth.userId));
    }
    if (action === 'saveKop') {
      return jsonResponse(handleSaveKop(body, auth.userId));
    }
    if (action === 'deleteKop') {
      return jsonResponse(handleDeleteKop(body.kopId, auth.userId));
    }
    if (action === 'exportDocx') {
      return jsonResponse(handleExportDocx(body.meetingId, auth.userId));
    }
    if (action === 'manageUser') {
      if (auth.role !== 'ADMIN') {
        return jsonResponse({ success: false, code: 403, message: 'Akses ditolak.' });
      }
      return jsonResponse(handleManageUser(body));
    }

    return jsonResponse({ success: false, code: 400, message: 'Aksi tidak dikenali.' });
  } catch (err) {
    Logger.log(err);
    return jsonResponse({
      success: false,
      code: err.httpCode || 500,
      message: err.httpCode ? err.message : (err.message || 'Terjadi kesalahan saat memproses permintaan.')
    });
  } finally {
    lock.releaseLock();
  }
}

// ==================== AUTH HANDLERS ====================

function handleLogin(body) {
  const turnstileToken = body['cf-turnstile-response'] || body.turnstileToken || '';
  const turnstileCheck = verifyTurnstileToken(turnstileToken);
  if (!turnstileCheck.valid) {
    return { success: false, code: turnstileCheck.code, message: turnstileCheck.message };
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return { success: false, code: 400, message: 'Email dan kata sandi wajib diisi.' };
  }

  const sheet = getSheet('Users');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[1]).trim().toLowerCase() === email) {
      if (row[5] !== 'ACTIVE') {
        return { success: false, code: 403, message: 'Lisensi akun Anda sedang dinonaktifkan.' };
      }
      if (!verifyPassword(password, row[2])) {
        return { success: false, code: 401, message: 'Email atau kata sandi salah.' };
      }
      const token = `${Utilities.getUuid()}-${Utilities.getUuid().slice(0, 8)}`;
      sheet.getRange(i + 1, 7).setValue(token);
      const userGeminiKey = String(row[8] || '').trim();
      return {
        success: true,
        message: 'Login berhasil.',
        data: {
          token,
          user: {
            userId: row[0],
            email: row[1],
            fullName: unsanitizeDisplay(row[3]),
            role: row[4],
            licenseStatus: row[5],
            hasCustomGeminiKey: Boolean(userGeminiKey),
            geminiKeyMasked: maskApiKey(userGeminiKey)
          }
        }
      };
    }
  }
  return { success: false, code: 401, message: 'Email atau kata sandi salah.' };
}

function handleRegister(body) {
  const turnstileToken = body['cf-turnstile-response'] || body.turnstileToken || '';
  const turnstileCheck = verifyTurnstileToken(turnstileToken);
  if (!turnstileCheck.valid) {
    return { success: false, code: turnstileCheck.code, message: turnstileCheck.message };
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();

  if (!email || !password || !fullName) {
    return { success: false, code: 400, message: 'Nama lengkap, email, dan kata sandi wajib diisi.' };
  }
  if (password.length < 6) {
    return { success: false, code: 400, message: 'Kata sandi minimal 6 karakter.' };
  }

  const sheet = getSheet('Users');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).trim().toLowerCase() === email) {
      return { success: false, code: 409, message: 'Email sudah terdaftar.' };
    }
  }

  const userId = Utilities.getUuid();
  const token = `${Utilities.getUuid()}-${Utilities.getUuid().slice(0, 8)}`;
  ensureUsersGeminiColumn(sheet);
  sheet.appendRow([
    userId,
    sanitizeCell(email),
    hashPassword(password),
    sanitizeCell(fullName),
    'USER',
    'ACTIVE',
    token,
    new Date().toISOString(),
    ''
  ]);

  // Buat kop instansi default untuk pengguna baru
  const kopSheet = getSheet('Instansi_Kop');
  kopSheet.appendRow([
    Utilities.getUuid(),
    userId,
    'PEMERINTAH KABUPATEN / KOTA',
    'DINAS / INSTANSI TERKAIT',
    'UNIT KERJA / SEKOLAH',
    'Jl. Alamat Instansi No. 1',
    'Telp. (0000) 000 000',
    ''
  ]);

  return {
    success: true,
    message: 'Pendaftaran berhasil.',
    data: {
      token,
      user: {
        userId,
        email,
        fullName,
        role: 'USER',
        licenseStatus: 'ACTIVE',
        hasCustomGeminiKey: false,
        geminiKeyMasked: ''
      }
    }
  };
}

function handleLogout(rowIndex) {
  getSheet('Users').getRange(rowIndex, 7).setValue('');
  return { success: true, message: 'Berhasil keluar.' };
}

function handleSaveGeminiApiKey(body, auth) {
  const rawKey = String(body.geminiApiKey || '').trim();
  if (rawKey && rawKey.length < 15) {
    return { success: false, code: 400, message: 'Format GEMINI_API_KEY tidak valid.' };
  }

  const sheet = getSheet('Users');
  ensureUsersGeminiColumn(sheet);
  sheet.getRange(auth.rowIndex, 9).setValue(sanitizeCell(rawKey));

  const cacheKey = `NOTULIS_ACTIVE_GEMINI_MODEL_${auth.userId || 'global'}`;
  CacheService.getScriptCache().remove(cacheKey);

  return {
    success: true,
    message: rawKey
      ? 'GEMINI_API_KEY pribadi berhasil disimpan.'
      : 'GEMINI_API_KEY pribadi dihapus (menggunakan key default server).',
    data: {
      hasCustomGeminiKey: Boolean(rawKey),
      geminiKeyMasked: maskApiKey(rawKey)
    }
  };
}

function handleTestGeminiApiKey(body, auth) {
  const overrideKey = String(body.geminiApiKey || '').trim();
  const keyToTest = overrideKey || auth.geminiApiKey || String(PROPS.getProperty('GEMINI_API_KEY') || '').trim();
  if (!keyToTest) {
    return {
      success: false,
      code: 400,
      message: 'GEMINI_API_KEY belum diisi di profil maupun di server.'
    };
  }

  const cacheScope = overrideKey ? `test_${auth.userId}` : auth.userId;
  CacheService.getScriptCache().remove(`NOTULIS_ACTIVE_GEMINI_MODEL_${cacheScope || 'global'}`);

  const reply = invokeGemini(
    { contents: [{ role: 'user', parts: [{ text: 'Balas dengan satu kata: OK' }] }] },
    keyToTest,
    cacheScope
  );
  const activeModel =
    CacheService.getScriptCache().get(`NOTULIS_ACTIVE_GEMINI_MODEL_${cacheScope || 'global'}`) ||
    'gemini';

  return {
    success: true,
    message: `Koneksi Gemini berhasil (${activeModel})`,
    data: { activeModel, reply: String(reply || '').trim() }
  };
}

// ==================== MEETINGS READ HANDLERS (RBAC) ====================

function handleGetMeetings(authenticatedUserId) {
  const rows = getSheet('Meetings').getDataRange().getValues();
  const actionRows = getSheet('Action_Items').getDataRange().getValues();
  const pendingCountMap = {};

  for (let i = 1; i < actionRows.length; i++) {
    const ar = actionRows[i];
    if (ar[2] === authenticatedUserId && ar[7] !== 'DONE') {
      pendingCountMap[ar[1]] = (pendingCountMap[ar[1]] || 0) + 1;
    }
  }

  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] !== authenticatedUserId) continue;

    let summary = {};
    try {
      summary = JSON.parse(r[14] || '{}');
    } catch (e) {
      summary = {};
    }

    list.push({
      meeting_id: r[0],
      kop_id: r[2],
      title: unsanitizeDisplay(r[3]),
      doc_type_title: unsanitizeDisplay(r[4]),
      doc_number: unsanitizeDisplay(r[5]),
      meeting_date: r[6],
      time_range: unsanitizeDisplay(r[7]),
      location: unsanitizeDisplay(r[8]),
      duration_sec: Number(r[9]) || 0,
      participant_count: Number(r[10]) || 0,
      has_audio: Boolean(r[11]),
      status: r[15] || 'COMPLETED',
      is_ai_generated: r[16] === true || r[16] === 'TRUE',
      created_at: r[17],
      pending_action_count: pendingCountMap[r[0]] || 0,
      decision_count: Array.isArray(summary.keputusan) ? summary.keputusan.length : 0
    });
  }

  list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { success: true, data: list };
}

function handleGetMeetingDetail(meetingId, authenticatedUserId) {
  if (!meetingId) {
    return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
  }

  const rows = getSheet('Meetings').getDataRange().getValues();
  const match = rows.slice(1).find((r) => r[0] === meetingId && r[1] === authenticatedUserId);
  if (!match) {
    return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
  }

  let summary = { pembahasan: '', keputusan: [] };
  try {
    summary = JSON.parse(match[14] || '{}');
  } catch (e) {
    summary = { pembahasan: '', keputusan: [] };
  }

  // Ambil Kop Surat terkait
  const kopRows = getSheet('Instansi_Kop').getDataRange().getValues();
  const kopMatch = kopRows.slice(1).find((k) => k[0] === match[2] && k[1] === authenticatedUserId);
  const kop = kopMatch
    ? {
        kop_id: kopMatch[0],
        header_line_1: unsanitizeDisplay(kopMatch[2]),
        header_line_2: unsanitizeDisplay(kopMatch[3]),
        institution_name: unsanitizeDisplay(kopMatch[4]),
        address: unsanitizeDisplay(kopMatch[5]),
        phone: unsanitizeDisplay(kopMatch[6]),
        logo_drive_url: resolveLogoDataUrl(kopMatch[7] || '')
      }
    : null;

  // Ambil Daftar Hadir
  const partRows = getSheet('Participants').getDataRange().getValues();
  const participants = partRows
    .slice(1)
    .filter((p) => p[1] === meetingId && p[2] === authenticatedUserId)
    .map((p) => ({
      participant_id: p[0],
      name: unsanitizeDisplay(p[3]),
      position: unsanitizeDisplay(p[4]),
      attendance_status: p[5] || 'HADIR'
    }));

  // Ambil Action Items
  const actionRows = getSheet('Action_Items').getDataRange().getValues();
  const actionItems = actionRows
    .slice(1)
    .filter((a) => a[1] === meetingId && a[2] === authenticatedUserId)
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .map((a) => ({
      action_id: a[0],
      order_no: Number(a[3]) || 1,
      description: unsanitizeDisplay(a[4]),
      pic_name: unsanitizeDisplay(a[5]),
      deadline: unsanitizeDisplay(a[6]),
      status: a[7] || 'PENDING'
    }));

  return {
    success: true,
    data: {
      meeting_id: match[0],
      kop_id: match[2],
      kop,
      title: unsanitizeDisplay(match[3]),
      doc_type_title: unsanitizeDisplay(match[4]),
      doc_number: unsanitizeDisplay(match[5]),
      meeting_date: match[6],
      time_range: unsanitizeDisplay(match[7]),
      location: unsanitizeDisplay(match[8]),
      duration_sec: Number(match[9]) || 0,
      participant_count: Number(match[10]) || participants.length,
      audio_drive_id: match[11] || '',
      docx_drive_id: match[12] || '',
      transcript_text: readTranscript(match[13]),
      summary,
      status: match[15] || 'COMPLETED',
      is_ai_generated: match[16] === true || match[16] === 'TRUE',
      created_at: match[17],
      participants,
      action_items: actionItems
    }
  };
}

function handleGetAudioBase64(meetingId, authenticatedUserId) {
  if (!meetingId) {
    return { success: false, code: 404, message: 'Audio tidak ditemukan.' };
  }
  const rows = getSheet('Meetings').getDataRange().getValues();
  const match = rows.slice(1).find((r) => r[0] === meetingId && r[1] === authenticatedUserId);
  if (!match || !match[11]) {
    return { success: false, code: 404, message: 'Audio tidak ditemukan.' };
  }

  try {
    const file = DriveApp.getFileById(match[11]);
    const blob = file.getBlob();
    return {
      success: true,
      data: {
        mimeType: blob.getContentType() || 'audio/webm',
        base64: Utilities.base64Encode(blob.getBytes())
      }
    };
  } catch (err) {
    return { success: false, code: 404, message: 'File audio tidak tersedia di Drive.' };
  }
}

// ==================== CORE: AUDIO TO AI MINUTES ====================

function saveMeetingRecords(data, authenticatedUserId, aiResult, audioDriveId) {
  const meetingId = Utilities.getUuid();
  const now = new Date();
  const meetingDate = String(data.meetingDate || Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd'));
  const title = String(data.title || '').trim();
  const location = String(data.location || '').trim();
  const kopId = String(data.kopId || '').trim();
  const docTypeTitle = String(data.docTypeTitle || 'NOTULEN RAPAT').trim();
  const docNumber = String(data.docNumber || '-').trim();
  const durationSec = Number(data.durationSec) || 0;
  const participantsInput = Array.isArray(data.participants) ? data.participants : [];
  const participantCount = Number(data.participantCount) || participantsInput.length || 0;

  const meetingsSheet = getSheet('Meetings');
  const defaultTimeRange = `${Utilities.formatDate(now, 'Asia/Jakarta', 'HH.mm')} WIB`;
  const summaryPayload = JSON.stringify({
    pembahasan: aiResult.pembahasan || '',
    keputusan: Array.isArray(aiResult.keputusan) ? aiResult.keputusan : []
  });

  const transcriptCell = saveTranscriptIfLong(meetingId, aiResult.transkrip || '');

  meetingsSheet.appendRow([
    meetingId,
    authenticatedUserId,
    sanitizeCell(kopId),
    sanitizeCell(title),
    sanitizeCell(docTypeTitle),
    sanitizeCell(docNumber),
    meetingDate,
    sanitizeCell(aiResult.time_range || defaultTimeRange),
    sanitizeCell(location),
    durationSec,
    participantCount,
    audioDriveId || '',
    '',
    transcriptCell,
    summaryPayload,
    'COMPLETED',
    true,
    now.toISOString()
  ]);

  if (participantsInput.length > 0) {
    const partSheet = getSheet('Participants');
    participantsInput.forEach((p) => {
      if (!p || !p.name) return;
      partSheet.appendRow([
        Utilities.getUuid(),
        meetingId,
        authenticatedUserId,
        sanitizeCell(p.name),
        sanitizeCell(p.position || 'Peserta'),
        p.attendance_status || 'HADIR'
      ]);
    });
  }

  const actionSheet = getSheet('Action_Items');
  const tindakLanjut = Array.isArray(aiResult.tindak_lanjut) ? aiResult.tindak_lanjut : [];
  tindakLanjut.forEach((item, idx) => {
    actionSheet.appendRow([
      Utilities.getUuid(),
      meetingId,
      authenticatedUserId,
      idx + 1,
      sanitizeCell(item.uraian || '-'),
      sanitizeCell(item.penanggung_jawab || '-'),
      sanitizeCell(item.batas_waktu || '-'),
      'PENDING'
    ]);
  });

  return meetingId;
}

function handleProcessMeetingAudio(data, authenticatedUserId, userGeminiKey) {
  const title = String(data.title || '').trim();
  const location = String(data.location || '').trim();
  const participantsInput = Array.isArray(data.participants) ? data.participants : [];
  const audioBase64 = String(data.audioBase64 || '');
  const rawMime = String(data.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();

  if (!title || !location || !audioBase64) {
    return { success: false, code: 400, message: 'Judul, lokasi, dan rekaman audio wajib diisi.' };
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LEN) {
    return { success: false, code: 413, message: 'Ukuran segmen audio melebihi batas maksimal 13.5 MB.' };
  }
  if (!ALLOWED_AUDIO_MIMES.includes(rawMime)) {
    return { success: false, code: 415, message: 'Format audio tidak didukung.' };
  }

  // 1. Simpan file audio ke Google Drive
  const folder = getDriveFolder();
  const ext = rawMime.includes('mp4') ? 'm4a' : rawMime.includes('mpeg') ? 'mp3' : rawMime.includes('wav') ? 'wav' : 'webm';
  const decodedBytes = Utilities.base64Decode(audioBase64);
  const blob = Utilities.newBlob(decodedBytes, rawMime, `${Utilities.getUuid()}.${ext}`);
  const audioFile = folder.createFile(blob);
  const audioDriveId = audioFile.getId();

  // 2. Panggil Gemini API (Transkripsi & Notulen JSON terstruktur)
  const aiResult = callGeminiForMinutes(
    audioBase64,
    rawMime,
    title,
    location,
    participantsInput,
    userGeminiKey,
    authenticatedUserId
  );

  // 3. Simpan ke Sheets
  const meetingId = saveMeetingRecords(data, authenticatedUserId, aiResult, audioDriveId);

  return {
    success: true,
    message: 'Notulen resmi berhasil disusun oleh AI.',
    data: { meetingId, audioDriveId }
  };
}

function handleTranscribeAudioSegment(data, userGeminiKey, authenticatedUserId) {
  const title = String(data.title || 'Rapat').trim();
  const location = String(data.location || '-').trim();
  const segmentIndex = Number(data.segmentIndex) || 1;
  const totalSegments = Number(data.totalSegments) || 1;
  const previousContext = String(data.previousContext || '').trim();
  const audioBase64 = String(data.audioBase64 || '');
  const rawMime = String(data.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();

  if (!audioBase64) {
    return { success: false, code: 400, message: 'Data segmen audio kosong.' };
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LEN) {
    return { success: false, code: 413, message: 'Ukuran segmen audio melebihi batas maksimal 13.5 MB.' };
  }
  if (!ALLOWED_AUDIO_MIMES.includes(rawMime)) {
    return { success: false, code: 415, message: 'Format audio tidak didukung.' };
  }

  const transcript = callGeminiTranscribeSegment(
    audioBase64,
    rawMime,
    {
      title,
      location,
      segmentIndex,
      totalSegments,
      previousContext
    },
    userGeminiKey,
    authenticatedUserId
  );

  return {
    success: true,
    data: { segmentIndex, transcript }
  };
}

function handleSynthesizeMinutes(data, authenticatedUserId, userGeminiKey) {
  const title = String(data.title || '').trim();
  const location = String(data.location || '').trim();
  const transcriptText = String(data.transcriptText || '').trim();
  const participantsInput = Array.isArray(data.participants) ? data.participants : [];

  if (!title || !location || !transcriptText) {
    return { success: false, code: 400, message: 'Judul, lokasi, dan transkrip rapat wajib diisi.' };
  }

  const aiResult = callGeminiMinutesFromTranscript(
    transcriptText,
    title,
    location,
    participantsInput,
    userGeminiKey,
    authenticatedUserId
  );
  aiResult.transkrip = transcriptText;

  const meetingId = saveMeetingRecords(data, authenticatedUserId, aiResult, '');

  return {
    success: true,
    message: 'Notulen resmi berhasil disusun oleh AI.',
    data: { meetingId, audioDriveId: '' }
  };
}

function buildGeminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function invokeGemini(payload, userGeminiKey, cacheScope) {
  const apiKey =
    String(userGeminiKey || '').trim() ||
    String(PROPS.getProperty('GEMINI_API_KEY') || '').trim();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY belum diatur. Silakan isi di menu Akun & Server.');
    err.httpCode = 400;
    throw err;
  }

  const normalizedPayload = {
    ...payload,
    contents: (payload.contents || []).map((c) => ({
      role: c.role || 'user',
      parts: c.parts || []
    }))
  };

  const scriptCache = CacheService.getScriptCache();
  const cacheKey = `NOTULIS_ACTIVE_GEMINI_MODEL_${cacheScope || 'global'}`;
  const cachedModel = String(scriptCache.get(cacheKey) || '').trim();
  const customModel = String(PROPS.getProperty('GEMINI_MODEL') || '').trim();
  const candidates = [
    ...(customModel ? [customModel] : []),
    ...(cachedModel ? [cachedModel] : []),
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  ];
  const models = candidates.filter((m, idx) => candidates.indexOf(m) === idx);
  let lastError = null;
  let saw503 = false;
  let saw429 = false;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const url = buildGeminiUrl(model);
    const max503Attempts = 2;

    for (let attempt = 0; attempt < max503Attempts; attempt++) {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey
        },
        payload: JSON.stringify(normalizedPayload),
        muteHttpExceptions: true
      });

      const statusCode = response.getResponseCode();
      const bodyText = response.getContentText();

      if (statusCode >= 200 && statusCode < 300) {
        const json = JSON.parse(bodyText);
        scriptCache.put(cacheKey, model, 600);
        Logger.log(`Gemini sukses dengan model: ${model}`);
        return (
          (json.candidates &&
            json.candidates[0] &&
            json.candidates[0].content &&
            json.candidates[0].content.parts &&
            json.candidates[0].content.parts[0] &&
            json.candidates[0].content.parts[0].text) ||
          ''
        );
      }

      Logger.log(`Gemini API (${model}, percobaan ${attempt + 1}) HTTP ${statusCode}: ${bodyText}`);

      let detail = '';
      try {
        const errJson = JSON.parse(bodyText || '{}');
        detail = (errJson.error && errJson.error.message) || '';
      } catch (e) {
        detail = '';
      }
      const cleanDetail = detail.replace(/\s+/g, ' ').slice(0, 180);

      // Jika model tidak ditemukan (404), langsung pindah ke model fallback berikutnya
      if (statusCode === 404) {
        if (!saw503 && !saw429) {
          lastError = new Error(`Model ${model} tidak tersedia (HTTP 404).`);
          lastError.httpCode = 404;
        }
        break;
      }

      // Jika kuota model ini habis / rate-limit (429), pindah ke model cadangan lain yang punya kuota terpisah
      if (statusCode === 429) {
        saw429 = true;
        if (cachedModel === model) {
          scriptCache.remove(cacheKey);
        }
        lastError = new Error(
          `Kuota / batas kecepatan Gemini tercapai (HTTP 429)${cleanDetail ? ': ' + cleanDetail : '.'}`
        );
        lastError.httpCode = 429;
        break;
      }

      // Jika server Gemini sibuk sementara (503), tunggu sebentar lalu pindah cepat ke model cadangan
      if (statusCode === 503) {
        saw503 = true;
        if (!saw429) {
          lastError = new Error('Server Gemini sedang sibuk (HTTP 503). Silakan coba ulang.');
          lastError.httpCode = 503;
        }
        if (attempt < max503Attempts - 1) {
          Utilities.sleep(2000);
          continue;
        }
        break;
      }

      let friendlyMsg = `Gemini API error (HTTP ${statusCode})${cleanDetail ? ': ' + cleanDetail : ''}.`;
      if (statusCode === 400) {
        friendlyMsg = `API Key atau permintaan Gemini ditolak (HTTP 400)${cleanDetail ? ': ' + cleanDetail : '.'}`;
      } else if (statusCode === 403) {
        friendlyMsg = `Akses API Key Gemini ditolak (HTTP 403)${cleanDetail ? ': ' + cleanDetail : '.'}`;
      }

      const fatalErr = new Error(friendlyMsg);
      fatalErr.httpCode = statusCode;
      throw fatalErr;
    }
  }

  throw lastError || new Error('Pemrosesan AI gagal merespons.');
}

/**
 * Jalankan dari Editor Apps Script untuk menemukan model Gemini yang saat ini memiliki kuota aktif.
 */
function findWorkingGeminiModel() {
  CacheService.getScriptCache().remove('NOTULIS_ACTIVE_GEMINI_MODEL_global');
  const res = testGeminiConnection();
  const active = CacheService.getScriptCache().get('NOTULIS_ACTIVE_GEMINI_MODEL_global');
  Logger.log('Model aktif terpilih: ' + active + ' | Respon: ' + res);
  return { activeModel: active, response: res };
}

/**
 * Jalankan fungsi ini dari Editor Apps Script untuk melihat daftar model yang aktif untuk GEMINI_API_KEY Anda.
 */
function listAvailableGeminiModels() {
  const apiKey = String(PROPS.getProperty('GEMINI_API_KEY') || '').trim();
  const resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    method: 'get',
    headers: { 'x-goog-api-key': apiKey },
    muteHttpExceptions: true
  });
  const json = JSON.parse(resp.getContentText() || '{}');
  const names = (json.models || []).map((m) => m.name);
  Logger.log('Model tersedia: ' + JSON.stringify(names));
  return names;
}

/**
 * Jalankan fungsi ini dari Editor Apps Script untuk menguji koneksi & validitas GEMINI_API_KEY.
 */
function testGeminiConnection() {
  const res = invokeGemini({
    contents: [{ role: 'user', parts: [{ text: 'Balas dengan satu kata: OK' }] }]
  });
  Logger.log('Hasil tes Gemini: ' + res);
  return res;
}

function callGeminiTranscribeSegment(audioBase64, mimeType, ctx, userGeminiKey, cacheScope) {
  const promptText = `Anda adalah transkriber profesional rapat resmi di Indonesia.
Ini adalah segmen audio ke-${ctx.segmentIndex} dari ${ctx.totalSegments} untuk rapat "${ctx.title}" di "${ctx.location}".
${ctx.previousContext ? `Konteks akhir segmen sebelumnya: "...${ctx.previousContext}"` : ''}
Transkripsikan seluruh percakapan pada segmen audio ini secara lengkap, akurat, dan rapi dalam bahasa Indonesia.
Kembalikan HANYA teks transkrip percakapan tanpa markdown, tanpa pembuka, dan tanpa penutup.`;

  const rawText = invokeGemini(
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType, data: audioBase64 } }
          ]
        }
      ]
    },
    userGeminiKey,
    cacheScope
  );

  return rawText.trim();
}

function callGeminiMinutesFromTranscript(transcriptText, title, location, participants, userGeminiKey, cacheScope) {
  const participantNames = (participants || []).map((p) => `${p.name} (${p.position || 'Peserta'})`).join(', ');
  const safeTranscript = transcriptText.slice(0, 120000);

  const promptText = `Anda adalah sekretaris & notulis profesional instansi resmi di Indonesia.
Berikut adalah transkrip lengkap rapat berjudul "${title}" bertempat di "${location}".
${participantNames ? `Daftar peserta yang hadir: ${participantNames}.` : ''}

TRANSKRIP:
"""
${safeTranscript}
"""

Susun notulen rapat resmi dan kembalikan HANYA JSON valid tanpa markdown dengan struktur persis berikut:
{
  "pembahasan": "ringkasan naratif pembahasan rapat yang formal dan komprehensif",
  "keputusan": ["poin keputusan 1", "poin keputusan 2"],
  "tindak_lanjut": [
    {"uraian": "uraian tugas", "penanggung_jawab": "nama atau jabatan", "batas_waktu": "tanggal atau tenggat"}
  ]
}`;

  const rawText = invokeGemini(
    {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: 'application/json' }
    },
    userGeminiKey,
    cacheScope
  );

  const cleaned = (rawText || '{}').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

function callGeminiForMinutes(audioBase64, mimeType, title, location, participants, userGeminiKey, cacheScope) {
  const participantNames = (participants || []).map((p) => `${p.name} (${p.position || 'Peserta'})`).join(', ');

  const promptText = `Anda adalah sekretaris & notulis profesional instansi resmi di Indonesia.
Dengarkan rekaman audio rapat berjudul "${title}" bertempat di "${location}".
${participantNames ? `Daftar peserta yang hadir: ${participantNames}.` : ''}
Tugas Anda:
1. Buat transkrip percakapan lengkap dan rapi dalam bahasa Indonesia.
2. Susun ringkasan pembahasan rapat secara formal dan jelas.
3. Ekstrak daftar poin keputusan rapat.
4. Ekstrak tabel tindak lanjut (action items) yang konkret.

Kembalikan HANYA JSON valid tanpa markdown dengan struktur persis berikut:
{
  "transkrip": "transkrip percakapan lengkap bahasa Indonesia",
  "pembahasan": "ringkasan naratif pembahasan rapat yang formal",
  "keputusan": ["poin keputusan 1", "poin keputusan 2"],
  "tindak_lanjut": [
    {"uraian": "uraian tugas", "penanggung_jawab": "nama atau jabatan", "batas_waktu": "tanggal atau tenggat"}
  ]
}`;

  const rawText = invokeGemini(
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType, data: audioBase64 } }
          ]
        }
      ],
      generationConfig: { responseMimeType: 'application/json' }
    },
    userGeminiKey,
    cacheScope
  );

  const cleaned = (rawText || '{}').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ==================== UPDATE & DELETE MEETING (RBAC) ====================

function handleUpdateMeeting(data, authenticatedUserId) {
  const meetingId = data.meetingId;
  if (!meetingId) {
    return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
  }

  const sheet = getSheet('Meetings');
  const rows = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === meetingId && rows[i][1] === authenticatedUserId) {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) {
    return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
  }

  const currentRow = rows[rowIdx - 1];
  const participants = Array.isArray(data.participants) ? data.participants : null;

  sheet.getRange(rowIdx, 3).setValue(sanitizeCell(data.kop_id !== undefined ? data.kop_id : currentRow[2]));
  sheet.getRange(rowIdx, 4).setValue(sanitizeCell(data.title !== undefined ? data.title : currentRow[3]));
  sheet.getRange(rowIdx, 5).setValue(sanitizeCell(data.doc_type_title !== undefined ? data.doc_type_title : currentRow[4]));
  sheet.getRange(rowIdx, 6).setValue(sanitizeCell(data.doc_number !== undefined ? data.doc_number : currentRow[5]));
  sheet.getRange(rowIdx, 7).setValue(data.meeting_date !== undefined ? data.meeting_date : currentRow[6]);
  sheet.getRange(rowIdx, 8).setValue(sanitizeCell(data.time_range !== undefined ? data.time_range : currentRow[7]));
  sheet.getRange(rowIdx, 9).setValue(sanitizeCell(data.location !== undefined ? data.location : currentRow[8]));

  if (participants) {
    sheet.getRange(rowIdx, 11).setValue(participants.length);
    deleteChildRows('Participants', meetingId, authenticatedUserId);
    const partSheet = getSheet('Participants');
    participants.forEach((p) => {
      if (!p || !p.name) return;
      partSheet.appendRow([
        p.participant_id || Utilities.getUuid(),
        meetingId,
        authenticatedUserId,
        sanitizeCell(p.name),
        sanitizeCell(p.position || 'Peserta'),
        p.attendance_status || 'HADIR'
      ]);
    });
  }

  if (data.summary) {
    sheet.getRange(rowIdx, 15).setValue(
      JSON.stringify({
        pembahasan: data.summary.pembahasan || '',
        keputusan: Array.isArray(data.summary.keputusan) ? data.summary.keputusan : []
      })
    );
  }

  if (Array.isArray(data.action_items)) {
    deleteChildRows('Action_Items', meetingId, authenticatedUserId);
    const actionSheet = getSheet('Action_Items');
    data.action_items.forEach((item, idx) => {
      actionSheet.appendRow([
        item.action_id || Utilities.getUuid(),
        meetingId,
        authenticatedUserId,
        idx + 1,
        sanitizeCell(item.description || '-'),
        sanitizeCell(item.pic_name || '-'),
        sanitizeCell(item.deadline || '-'),
        item.status === 'DONE' ? 'DONE' : 'PENDING'
      ]);
    });
  }

  return handleGetMeetingDetail(meetingId, authenticatedUserId);
}

function handleUpdateActionItemStatus(data, authenticatedUserId) {
  const { meetingId, actionId, status } = data;
  if (!meetingId || !actionId) {
    return { success: false, code: 404, message: 'Data tidak ditemukan.' };
  }

  const sheet = getSheet('Action_Items');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === actionId && rows[i][1] === meetingId && rows[i][2] === authenticatedUserId) {
      const nextStatus = status === 'DONE' ? 'DONE' : 'PENDING';
      sheet.getRange(i + 1, 8).setValue(nextStatus);
      return { success: true, message: 'Status tindak lanjut diperbarui.', data: { actionId, status: nextStatus } };
    }
  }
  return { success: false, code: 404, message: 'Data tidak ditemukan.' };
}

function handleDeleteMeeting(meetingId, authenticatedUserId) {
  if (!meetingId) {
    return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
  }

  const sheet = getSheet('Meetings');
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === meetingId && rows[i][1] === authenticatedUserId) {
      safeTrashDriveFile(rows[i][11]); // audio_drive_id
      safeTrashDriveFile(rows[i][12]); // docx_drive_id
      safeTrashDriveFile(rows[i][13]); // DRIVE_FILE:<id> jika ada
      sheet.deleteRow(i + 1);
      deleteChildRows('Action_Items', meetingId, authenticatedUserId);
      deleteChildRows('Participants', meetingId, authenticatedUserId);
      return { success: true, message: 'Rapat berhasil dihapus.' };
    }
  }
  return { success: false, code: 404, message: 'Data rapat tidak ditemukan.' };
}

function deleteChildRows(sheetName, meetingId, authenticatedUserId) {
  const sheet = getSheet(sheetName);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][1] === meetingId && rows[i][2] === authenticatedUserId) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==================== KOP INSTANSI HANDLERS ====================

function handleGetKopList(authenticatedUserId) {
  const rows = getSheet('Instansi_Kop').getDataRange().getValues();
  const list = rows
    .slice(1)
    .filter((r) => r[1] === authenticatedUserId)
    .map((r) => ({
      kop_id: r[0],
      header_line_1: unsanitizeDisplay(r[2]),
      header_line_2: unsanitizeDisplay(r[3]),
      institution_name: unsanitizeDisplay(r[4]),
      address: unsanitizeDisplay(r[5]),
      phone: unsanitizeDisplay(r[6]),
      logo_drive_url: resolveLogoDataUrl(r[7] || '')
    }));

  return { success: true, data: list };
}

function handleSaveKop(data, authenticatedUserId) {
  const sheet = getSheet('Instansi_Kop');
  const rows = sheet.getDataRange().getValues();
  const kopId = data.kop_id || Utilities.getUuid();

  let existingRowIdx = -1;
  let prevLogoCell = '';
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === kopId && rows[i][1] === authenticatedUserId) {
      existingRowIdx = i + 1;
      prevLogoCell = String(rows[i][7] || '');
      break;
    }
  }

  let storedLogoCell = prevLogoCell;
  let responseLogoUrl = '';
  if (data.clearLogo) {
    storedLogoCell = '';
    responseLogoUrl = '';
  } else if (data.logoBase64 && data.logoMimeType) {
    const rawMime = String(data.logoMimeType).split(';')[0].trim().toLowerCase();
    const cleanMime = rawMime.startsWith('image/') ? rawMime : 'image/png';
    const cleanBase64 = String(data.logoBase64).replace(/\s+/g, '');
    const dataUrl = `data:${cleanMime};base64,${cleanBase64}`;
    // Simpan backup ke Drive & simpan data URL inline jika muat dalam batas sel (<40.000 karakter)
    const folder = getDriveFolder();
    const bytes = Utilities.base64Decode(cleanBase64);
    const ext = cleanMime.includes('jpeg') || cleanMime.includes('jpg') ? 'jpg' : 'png';
    const blob = Utilities.newBlob(bytes, cleanMime, `logo_${kopId}.${ext}`);
    const file = folder.createFile(blob);
    storedLogoCell = dataUrl.length <= 40000 ? dataUrl : `DRIVE_IMAGE:${file.getId()}`;
    responseLogoUrl = dataUrl;
  } else if (!prevLogoCell && data.logo_drive_url) {
    const incoming = String(data.logo_drive_url).replace(/^'+/, '').trim();
    if (incoming.startsWith('data:image/') && incoming.length > 40000) {
      const commaIdx = incoming.indexOf(',');
      if (commaIdx > 0) {
        const mimeMatch = incoming.slice(0, commaIdx).match(/data:([^;]+);/i);
        const rawMime = mimeMatch ? mimeMatch[1].trim().toLowerCase() : 'image/png';
        const cleanMime = rawMime.startsWith('image/') ? rawMime : 'image/png';
        const cleanBase64 = incoming.slice(commaIdx + 1).replace(/\s+/g, '');
        const folder = getDriveFolder();
        const bytes = Utilities.base64Decode(cleanBase64);
        const ext = cleanMime.includes('jpeg') || cleanMime.includes('jpg') ? 'jpg' : 'png';
        const blob = Utilities.newBlob(bytes, cleanMime, `logo_${kopId}.${ext}`);
        const file = folder.createFile(blob);
        storedLogoCell = `DRIVE_IMAGE:${file.getId()}`;
        responseLogoUrl = `data:${cleanMime};base64,${cleanBase64}`;
      }
    } else {
      storedLogoCell = incoming;
    }
  }

  const rowValues = [
    kopId,
    authenticatedUserId,
    sanitizeCell(data.header_line_1 || ''),
    sanitizeCell(data.header_line_2 || ''),
    sanitizeCell(data.institution_name || ''),
    sanitizeCell(data.address || ''),
    sanitizeCell(data.phone || ''),
    storedLogoCell
  ];

  if (existingRowIdx > 0) {
    sheet.getRange(existingRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return {
    success: true,
    message: 'Kop instansi berhasil disimpan.',
    data: {
      kop_id: kopId,
      header_line_1: data.header_line_1 || '',
      header_line_2: data.header_line_2 || '',
      institution_name: data.institution_name || '',
      address: data.address || '',
      phone: data.phone || '',
      logo_drive_url: responseLogoUrl || resolveLogoDataUrl(storedLogoCell)
    }
  };
}

function handleDeleteKop(kopId, authenticatedUserId) {
  if (!kopId) {
    return { success: false, code: 404, message: 'Kop instansi tidak ditemukan.' };
  }
  const sheet = getSheet('Instansi_Kop');
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === kopId && rows[i][1] === authenticatedUserId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Kop instansi berhasil dihapus.' };
    }
  }
  return { success: false, code: 404, message: 'Kop instansi tidak ditemukan.' };
}

// ==================== EKSPOR GOOGLE DOCS -> .DOCX ====================

function appendFormattedParagraph(body, text, opts) {
  const o = opts || {};
  const p = body.appendParagraph(String(text || ''));
  if (o.align) p.setAlignment(o.align);
  if (o.spacingBefore !== undefined) p.setSpacingBefore(o.spacingBefore);
  if (o.spacingAfter !== undefined) p.setSpacingAfter(o.spacingAfter);
  if (o.indentStart !== undefined) p.setIndentStart(o.indentStart);
  if (o.indentFirstLine !== undefined) p.setIndentFirstLine(o.indentFirstLine);

  const txt = p.editAsText();
  txt.setFontFamily('Times New Roman');
  txt.setFontSize(o.size || 11);
  // Eksplisit setBold(false) agar tidak mewarisi bold dari paragraf heading sebelumnya
  txt.setBold(Boolean(o.bold));
  txt.setUnderline(Boolean(o.underline));
  return p;
}

function styleDataTable(table, colWidths) {
  table.setBorderColor('#94A3B8');
  table.setBorderWidth(0.75);
  const numRows = table.getNumRows();
  for (let r = 0; r < numRows; r++) {
    const row = table.getRow(r);
    const isHeader = r === 0;
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      if (colWidths && colWidths[c]) {
        cell.setWidth(colWidths[c]);
      }
      cell.setBackgroundColor(isHeader ? '#F1F5F9' : '#FFFFFF');
      cell.setPaddingTop(5);
      cell.setPaddingBottom(5);
      cell.setPaddingLeft(7);
      cell.setPaddingRight(7);
      const txt = cell.editAsText();
      txt.setFontFamily('Times New Roman');
      txt.setFontSize(10);
      txt.setBold(isHeader);
    }
  }
}

function sanitizeDocFilenameSegment(raw, maxLen) {
  return String(raw || '')
    .replace(/[/\\]+/g, '-')
    .replace(/[:*?"<>|\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim();
}

function buildMeetingDocFilename(m) {
  const cleanTitle = sanitizeDocFilenameSegment(m && m.title, 80) || 'Rapat';
  const rawNumber = String((m && m.doc_number) || '').trim();
  const cleanNumber =
    !rawNumber || rawNumber === '-'
      ? ''
      : sanitizeDocFilenameSegment(rawNumber, 40);

  return cleanNumber
    ? `Notulis - ${cleanTitle} - ${cleanNumber}`
    : `Notulis - ${cleanTitle}`;
}

function handleExportDocx(meetingId, authenticatedUserId) {
  const detailRes = handleGetMeetingDetail(meetingId, authenticatedUserId);
  if (!detailRes.success) return detailRes;

  const m = detailRes.data;
  const folder = getDriveFolder();
  const docTitle = buildMeetingDocFilename(m);
  const doc = DocumentApp.create(docTitle);
  const body = doc.getBody();

  body.setMarginTop(54);
  body.setMarginBottom(54);
  body.setMarginLeft(64);
  body.setMarginRight(54);

  // Hapus paragraf kosong bawaan lalu pastikan style normal tidak bold
  if (body.getNumChildren() > 0) {
    const first = body.getChild(0);
    if (first.getType() === DocumentApp.ElementType.PARAGRAPH) {
      first.asParagraph().editAsText().setFontFamily('Times New Roman').setFontSize(11).setBold(false);
    }
  }

  // Kop Instansi (dengan Logo jika ada)
  if (m.kop) {
    const logoBlob = resolveLogoBlob(m.kop.logo_drive_url);
    const contactLine = [m.kop.address, m.kop.phone].filter(Boolean).join(' · ');

    if (logoBlob) {
      const kopTable = body.appendTable([['', '']]);
      kopTable.setBorderWidth(0);
      const kopRow = kopTable.getRow(0);

      const logoCell = kopRow.getCell(0);
      logoCell.setWidth(72);
      logoCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const logoPara = logoCell.getChild(0).asParagraph();
      logoPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      try {
        const inlineImg = logoPara.appendInlineImage(logoBlob);
        const w = inlineImg.getWidth();
        const h = inlineImg.getHeight();
        const maxSide = 58;
        if (w > 0 && h > 0) {
          const scale = Math.min(maxSide / w, maxSide / h);
          inlineImg.setWidth(Math.round(w * scale)).setHeight(Math.round(h * scale));
        }
      } catch (imgErr) {
        Logger.log('Gagal menyisipkan logo kop di .docx: ' + imgErr);
      }

      const textCell = kopRow.getCell(1);
      textCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const p0 = textCell.getChild(0).asParagraph();
      if (m.kop.header_line_1) {
        p0.setText(String(m.kop.header_line_1).toUpperCase());
        p0.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        p0.editAsText().setFontFamily('Times New Roman').setFontSize(11).setBold(true);
      }
      if (m.kop.header_line_2) {
        const p2 = textCell.appendParagraph(String(m.kop.header_line_2).toUpperCase());
        p2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        p2.editAsText().setFontFamily('Times New Roman').setFontSize(12).setBold(true);
      }
      if (m.kop.institution_name) {
        const p3 = textCell.appendParagraph(String(m.kop.institution_name).toUpperCase());
        p3.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        p3.editAsText().setFontFamily('Times New Roman').setFontSize(14).setBold(true);
      }
      if (contactLine) {
        const p4 = textCell.appendParagraph(contactLine);
        p4.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        p4.editAsText().setFontFamily('Times New Roman').setFontSize(9).setBold(false);
      }
    } else {
      if (m.kop.header_line_1) {
        appendFormattedParagraph(body, String(m.kop.header_line_1).toUpperCase(), {
          align: DocumentApp.HorizontalAlignment.CENTER,
          size: 11,
          bold: true,
          spacingAfter: 1
        });
      }
      if (m.kop.header_line_2) {
        appendFormattedParagraph(body, String(m.kop.header_line_2).toUpperCase(), {
          align: DocumentApp.HorizontalAlignment.CENTER,
          size: 12,
          bold: true,
          spacingAfter: 1
        });
      }
      if (m.kop.institution_name) {
        appendFormattedParagraph(body, String(m.kop.institution_name).toUpperCase(), {
          align: DocumentApp.HorizontalAlignment.CENTER,
          size: 14,
          bold: true,
          spacingAfter: 2
        });
      }
      if (contactLine) {
        appendFormattedParagraph(body, contactLine, {
          align: DocumentApp.HorizontalAlignment.CENTER,
          size: 9,
          bold: false,
          spacingAfter: 4
        });
      }
    }

    body.appendHorizontalRule();
  }

  // Judul Dokumen
  appendFormattedParagraph(body, String(m.doc_type_title || 'NOTULEN RAPAT').toUpperCase(), {
    align: DocumentApp.HorizontalAlignment.CENTER,
    size: 13,
    bold: true,
    underline: true,
    spacingBefore: 10,
    spacingAfter: 2
  });

  appendFormattedParagraph(body, `Nomor: ${m.doc_number || '-'}`, {
    align: DocumentApp.HorizontalAlignment.CENTER,
    size: 10,
    bold: false,
    spacingAfter: 12
  });

  // I. Pelaksanaan Rapat (tabel tanpa border agar sejajar rapi & tidak bold)
  appendFormattedParagraph(body, 'I. PELAKSANAAN RAPAT', { size: 11, bold: true, spacingAfter: 4 });
  const infoTable = body.appendTable([
    ['Agenda Rapat', ':', m.title || '-'],
    ['Tanggal', ':', m.meeting_date || '-'],
    ['Waktu', ':', m.time_range || '-'],
    ['Tempat', ':', m.location || '-'],
    ['Jumlah Peserta', ':', `${m.participant_count || (m.participants && m.participants.length) || 0} orang`]
  ]);
  infoTable.setBorderWidth(0);
  for (let r = 0; r < infoTable.getNumRows(); r++) {
    const row = infoTable.getRow(r);
    row.getCell(0).setWidth(110);
    row.getCell(1).setWidth(14);
    for (let c = 0; c < 3; c++) {
      const cell = row.getCell(c);
      cell.setPaddingTop(2);
      cell.setPaddingBottom(2);
      cell.setPaddingLeft(0);
      cell.setPaddingRight(4);
      const txt = cell.editAsText();
      txt.setFontFamily('Times New Roman');
      txt.setFontSize(11);
      txt.setBold(r === 0 && c === 2);
    }
  }

  // II. Daftar Hadir
  appendFormattedParagraph(body, 'II. DAFTAR HADIR PESERTA', {
    size: 11,
    bold: true,
    spacingBefore: 10,
    spacingAfter: 4
  });
  if (m.participants && m.participants.length > 0) {
    const pRows = [['No', 'Nama Peserta', 'Jabatan / Unit', 'Status']];
    m.participants.forEach((p, idx) => {
      pRows.push([String(idx + 1), p.name, p.position || '-', p.attendance_status || 'HADIR']);
    });
    const pTable = body.appendTable(pRows);
    styleDataTable(pTable, [32, 180, 155, 78]);
  } else {
    appendFormattedParagraph(body, '(Daftar hadir terlampir)', { size: 11, bold: false });
  }

  // III. Pembahasan
  appendFormattedParagraph(body, 'III. PEMBAHASAN', {
    size: 11,
    bold: true,
    spacingBefore: 12,
    spacingAfter: 4
  });
  appendFormattedParagraph(body, (m.summary && m.summary.pembahasan) || '-', {
    align: DocumentApp.HorizontalAlignment.JUSTIFY,
    size: 11,
    bold: false,
    spacingAfter: 8
  });

  // IV. Keputusan
  appendFormattedParagraph(body, 'IV. KEPUTUSAN RAPAT', {
    size: 11,
    bold: true,
    spacingBefore: 8,
    spacingAfter: 4
  });
  const decisions = (m.summary && m.summary.keputusan) || [];
  if (decisions.length > 0) {
    decisions.forEach((d, idx) => {
      appendFormattedParagraph(body, `${idx + 1}. ${d}`, {
        size: 11,
        bold: false,
        indentStart: 18,
        indentFirstLine: 0,
        spacingAfter: 3
      });
    });
  } else {
    appendFormattedParagraph(body, '-', { size: 11, bold: false });
  }

  // V. Tindak Lanjut
  appendFormattedParagraph(body, 'V. TINDAK LANJUT', {
    size: 11,
    bold: true,
    spacingBefore: 10,
    spacingAfter: 4
  });
  if (m.action_items && m.action_items.length > 0) {
    const aRows = [['No', 'Uraian Tindak Lanjut', 'Penanggung Jawab', 'Batas Waktu']];
    m.action_items.forEach((a, idx) => {
      aRows.push([String(idx + 1), a.description, a.pic_name, a.deadline]);
    });
    const aTable = body.appendTable(aRows);
    styleDataTable(aTable, [32, 215, 115, 83]);
  } else {
    appendFormattedParagraph(body, 'Tidak ada tindak lanjut khusus.', { size: 11, bold: false });
  }

  // Tanda Tangan
  appendFormattedParagraph(body, `${m.meeting_date || ''}\nNotulis Rapat,`, {
    align: DocumentApp.HorizontalAlignment.RIGHT,
    size: 10.5,
    bold: false,
    spacingBefore: 24,
    spacingAfter: 42
  });
  appendFormattedParagraph(body, '___________________________', {
    align: DocumentApp.HorizontalAlignment.RIGHT,
    size: 10.5,
    bold: true
  });

  doc.saveAndClose();

  // Pindahkan Google Doc ke folder storage dan ekspor ke .docx
  const docFile = DriveApp.getFileById(doc.getId());
  folder.addFile(docFile);

  const exportUrl = `https://docs.google.com/feeds/download/documents/export/Export?id=${doc.getId()}&exportFormat=docx`;
  const resp = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  });

  const docxBlob = resp.getBlob().setName(`${docTitle}.docx`);
  const savedDocx = folder.createFile(docxBlob);
  savedDocx.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true);

  // Simpan ID file .docx ke Meetings
  const mSheet = getSheet('Meetings');
  const mRows = mSheet.getDataRange().getValues();
  for (let i = 1; i < mRows.length; i++) {
    if (mRows[i][0] === meetingId && mRows[i][1] === authenticatedUserId) {
      mSheet.getRange(i + 1, 13).setValue(savedDocx.getId());
      break;
    }
  }

  return {
    success: true,
    message: 'Dokumen .docx berhasil dibuat.',
    data: {
      docxDriveId: savedDocx.getId(),
      downloadUrl: `https://drive.google.com/uc?export=download&id=${savedDocx.getId()}`,
      base64: Utilities.base64Encode(docxBlob.getBytes()),
      fileName: docxBlob.getName()
    }
  };
}

// ==================== ADMIN: USER MANAGEMENT ====================

function handleGetUsers() {
  const rows = getSheet('Users').getDataRange().getValues();
  const users = rows.slice(1).map((r) => ({
    userId: r[0],
    email: r[1],
    fullName: unsanitizeDisplay(r[3]),
    role: r[4],
    licenseStatus: r[5],
    createdAt: r[7]
  }));
  return { success: true, data: users };
}

function handleManageUser(body) {
  const sheet = getSheet('Users');
  const op = body.operation || '';

  if (op === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();
    const role = body.role === 'ADMIN' ? 'ADMIN' : 'USER';

    if (!email || !password || !fullName) {
      return { success: false, code: 400, message: 'Data pengguna tidak lengkap.' };
    }
    const rows = sheet.getDataRange().getValues();
    if (rows.slice(1).some((r) => String(r[1]).toLowerCase() === email)) {
      return { success: false, code: 409, message: 'Email sudah terdaftar.' };
    }

    const userId = Utilities.getUuid();
    sheet.appendRow([
      userId,
      sanitizeCell(email),
      hashPassword(password),
      sanitizeCell(fullName),
      role,
      'ACTIVE',
      '',
      new Date().toISOString()
    ]);
    return { success: true, message: 'Pengguna berhasil ditambahkan.' };
  }

  if (op === 'updateStatus') {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === body.targetUserId) {
        const nextStatus = body.licenseStatus === 'REVOKED' ? 'REVOKED' : 'ACTIVE';
        sheet.getRange(i + 1, 6).setValue(nextStatus);
        if (nextStatus === 'REVOKED') {
          sheet.getRange(i + 1, 7).setValue('');
        }
        return { success: true, message: `Status lisensi diubah menjadi ${nextStatus}.` };
      }
    }
    return { success: false, code: 404, message: 'Pengguna tidak ditemukan.' };
  }

  return { success: false, code: 400, message: 'Operasi admin tidak valid.' };
}
