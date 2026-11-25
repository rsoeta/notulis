/**
 * Mock Backend Lokal (localStorage) — aktif otomatis hanya jika VITE_GAS_WEBAPP_URL
 * belum diisi, agar seluruh alur Notulis (Login, Rekam, AI Notulen, RBAC, Admin, Ekspor)
 * dapat diuji secara penuh sebelum deploy ke Google Apps Script.
 */

const DB_STORAGE_KEY = 'notulis_demo_db_v1';

const wait = (ms = 550) => new Promise((r) => setTimeout(r, ms));
const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function createSeedDb() {
  const adminId = 'usr-admin-001';
  const userId = 'usr-sekretaris-001';
  const kop1Id = 'kop-smpn3-001';
  const kop2Id = 'kop-dinas-002';
  const mtg1Id = 'mtg-pas-2026';
  const mtg2Id = 'mtg-kurikulum-2026';

  return {
    users: [
      {
        userId: adminId,
        email: 'admin@notulis.id',
        password: 'Admin123!',
        fullName: 'Administrator Notulis',
        role: 'ADMIN',
        licenseStatus: 'ACTIVE',
        token: '',
        createdAt: '2026-11-01T08:00:00.000Z',
      },
      {
        userId,
        email: 'sekretaris@smpn3sejahtera.sch.id',
        password: 'Notulis123!',
        fullName: 'Siti Aminah, S.Pd.',
        role: 'USER',
        licenseStatus: 'ACTIVE',
        token: '',
        createdAt: '2026-11-02T08:00:00.000Z',
      },
    ],
    kops: [
      {
        kop_id: kop1Id,
        user_id: userId,
        header_line_1: 'PEMERINTAH KABUPATEN SEJAHTERA',
        header_line_2: 'DINAS PENDIDIKAN',
        institution_name: 'SMP NEGERI 3 SEJAHTERA',
        address: 'Jl. Pelajar No. 3, Kota Sejahtera',
        phone: 'Telp. (0000) 551 203',
        logo_drive_url: '',
      },
      {
        kop_id: kop2Id,
        user_id: adminId,
        header_line_1: 'PEMERINTAH KABUPATEN SEJAHTERA',
        header_line_2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
        institution_name: 'SEKRETARIAT DINAS PENDIDIKAN',
        address: 'Jl. Merdeka Raya No. 18, Kota Sejahtera',
        phone: 'Telp. (0000) 550 112',
        logo_drive_url: '',
      },
    ],
    meetings: [
      {
        meeting_id: mtg1Id,
        user_id: userId,
        kop_id: kop1Id,
        title: 'Rapat Dewan Guru Persiapan Penilaian Akhir Semester',
        doc_type_title: 'NOTULEN RAPAT DEWAN GURU',
        doc_number: '421.3/046/NOT/XI/2026',
        meeting_date: '2026-11-24',
        time_range: '13.00 – 15.15 WIB',
        location: 'Ruang Guru SMP Negeri 3 Sejahtera',
        duration_sec: 4820,
        participant_count: 6,
        audio_drive_id: '',
        docx_drive_id: '',
        transcript_text:
          'Kepala Sekolah (Drs. H. Ahmad Fauzi, M.Pd.): Selamat siang Bapak dan Ibu guru sekalian. Agenda utama kita siang ini adalah finalisasi kesiapan Penilaian Akhir Semester Ganjil.\n\nWakil Kurikulum (Rina Kusuma, S.Pd.): Sesuai kalender pendidikan, PAS dimulai tanggal 7 Desember 2026. Kami mohon seluruh guru mata pelajaran mengunggah kisi-kisi dan naskah soal paling lambat 30 November 2026.\n\nKoordinator Sarpras (Budi Santoso, S.Pd.): Untuk ruang CBT laboratorium 1 dan 2 siap menampung 72 peserta per sesi. Tinggal pengecekan UPS dan jaringan cadangan.\n\nKepala Sekolah: Baik, keputusan rapat kita tetapkan. Tolong notulis mencatat pembagian tugas dan tenggat waktunya agar dapat ditindaklanjuti segera.',
        summary: {
          pembahasan:
            'Rapat dipimpin oleh Kepala Sekolah untuk menyelaraskan persiapan akademik, teknis pelaksanaan, dan sarana prasarana Penilaian Akhir Semester (PAS) Ganjil Tahun Ajaran 2026/2027. Fokus pembahasan meliputi batas akhir pengumpulan naskah soal beserta kisi-kisi, pembagian jadwal pengawasan ruang lintas rumpun, serta kesiapan server laboratorium CBT.',
          keputusan: [
            'Pelaksanaan Penilaian Akhir Semester (PAS) Ganjil ditetapkan mulai tanggal 7 Desember 2026.',
            'Seluruh guru mata pelajaran wajib menyerahkan kisi-kisi dan naskah soal paling lambat 30 November 2026.',
            'Lab Komputer 1 dan 2 disiapkan untuk ujian berbasis CBT dengan pengawas teknis khusus.',
          ],
        },
        status: 'COMPLETED',
        is_ai_generated: true,
        created_at: '2026-11-24T08:15:00.000Z',
        participants: [
          { participant_id: uuid(), name: 'Drs. H. Ahmad Fauzi, M.Pd.', position: 'Kepala Sekolah', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Rina Kusuma, S.Pd.', position: 'Wakil Kepala Kurikulum', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Budi Santoso, S.Pd.', position: 'Koordinator Sarpras', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Siti Aminah, S.Pd.', position: 'Sekretaris / Notulis', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Dewi Lestari, S.Pd.', position: 'Koordinator Mapel IPA', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Hendra Wijaya, S.Pd.', position: 'Koordinator Mapel IPS', attendance_status: 'IZIN' },
        ],
        action_items: [
          {
            action_id: uuid(),
            order_no: 1,
            description: 'Mengunggah kisi-kisi & naskah soal PAS ke portal kurikulum',
            pic_name: 'Seluruh Guru Mapel',
            deadline: '30 Nov 2026',
            status: 'PENDING',
          },
          {
            action_id: uuid(),
            order_no: 2,
            description: 'Menyusun SK Panitia & jadwal pengawas ruang ujian',
            pic_name: 'Rina Kusuma, S.Pd.',
            deadline: '2 Des 2026',
            status: 'DONE',
          },
          {
            action_id: uuid(),
            order_no: 3,
            description: 'Uji coba server CBT, jaringan LAN, dan cadangan daya UPS',
            pic_name: 'Budi Santoso, S.Pd.',
            deadline: '4 Des 2026',
            status: 'PENDING',
          },
        ],
      },
      {
        meeting_id: mtg2Id,
        user_id: userId,
        kop_id: kop1Id,
        title: 'Koordinasi Evaluasi Program Ekstrakurikuler & Literasi Sekolah',
        doc_type_title: 'NOTULEN RAPAT KOORDINASI',
        doc_number: '421.3/041/NOT/XI/2026',
        meeting_date: '2026-11-18',
        time_range: '10.00 – 11.30 WIB',
        location: 'Aula Mini SMP Negeri 3 Sejahtera',
        duration_sec: 3180,
        participant_count: 4,
        audio_drive_id: '',
        docx_drive_id: '',
        transcript_text:
          'Pembina OSIS: Kami melaporkan tingkat partisipasi siswa pada kegiatan pramuka dan literasi pagi meningkat 18 persen di semester ini.\nKepala Perpustakaan: Pojok baca kelas perlu penambahan 30 judul buku fiksi dan sains populer sebelum akhir tahun.',
        summary: {
          pembahasan:
            'Evaluasi capaian program ekstrakurikuler wajib dan penguatan gerakan literasi sekolah 15 menit sebelum jam pelajaran pertama. Dibahas pula kebutuhan peremajaan koleksi buku pojok baca kelas VII sampai IX.',
          keputusan: [
            'Gerakan literasi pagi dilanjutkan dengan jurnal baca mingguan yang diparaf wali kelas.',
            'Pengadaan 30 judul buku pengayaan untuk pojok baca dialokasikan dari anggaran BOS tahap akhir.',
          ],
        },
        status: 'COMPLETED',
        is_ai_generated: true,
        created_at: '2026-11-18T04:30:00.000Z',
        participants: [
          { participant_id: uuid(), name: 'Siti Aminah, S.Pd.', position: 'Notulis / Wali Kelas VIII', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Agus Pratama, S.Pd.', position: 'Pembina OSIS', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Ratna Sari, S.Pust.', position: 'Kepala Perpustakaan', attendance_status: 'HADIR' },
          { participant_id: uuid(), name: 'Rina Kusuma, S.Pd.', position: 'Wakil Kurikulum', attendance_status: 'HADIR' },
        ],
        action_items: [
          {
            action_id: uuid(),
            order_no: 1,
            description: 'Rekap daftar usulan buku pojok baca dari masing-masing kelas',
            pic_name: 'Ratna Sari, S.Pust.',
            deadline: '28 Nov 2026',
            status: 'DONE',
          },
        ],
      },
    ],
  };
}

function loadDb() {
  const raw = localStorage.getItem(DB_STORAGE_KEY);
  if (!raw) {
    const seed = createSeedDb();
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
}

function saveDb(db) {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
}

function getAuthUser(db, token) {
  if (!token) return null;
  return db.users.find((u) => u.token === token && u.licenseStatus === 'ACTIVE') || null;
}

function maskKey(key) {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 10) return '••••••••';
  return `${clean.slice(0, 6)}••••••${clean.slice(-4)}`;
}

export async function mockRequest(action, payload = {}) {
  await wait(480);
  const db = loadDb();

  if (action === 'health') {
    return { success: true, message: 'Mode Demo Lokal Aktif' };
  }

  if (action === 'login') {
    const cfToken = String(payload['cf-turnstile-response'] || payload.turnstileToken || '').trim();
    if (!cfToken) {
      const err = new Error('Verifikasi anti-bot (Cloudflare Turnstile) wajib diselesaikan.');
      err.code = 400;
      throw err;
    }
    if (cfToken === 'INVALID_TEST_TOKEN') {
      const err = new Error('Verifikasi anti-bot gagal atau kedaluwarsa. Silakan ulangi.');
      err.code = 403;
      throw err;
    }
    const email = String(payload.email || '').trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== payload.password) {
      throw new Error('Email atau kata sandi salah.');
    }
    if (user.licenseStatus !== 'ACTIVE') {
      throw new Error('Lisensi akun Anda sedang dinonaktifkan.');
    }
    const token = `demo-token-${uuid()}`;
    user.token = token;
    saveDb(db);
    return {
      success: true,
      data: {
        token,
        user: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          licenseStatus: user.licenseStatus,
          hasCustomGeminiKey: Boolean(user.geminiApiKey),
          geminiKeyMasked: maskKey(user.geminiApiKey),
        },
      },
    };
  }

  if (action === 'register') {
    const cfToken = String(payload['cf-turnstile-response'] || payload.turnstileToken || '').trim();
    if (!cfToken) {
      const err = new Error('Verifikasi anti-bot (Cloudflare Turnstile) wajib diselesaikan.');
      err.code = 400;
      throw err;
    }
    if (cfToken === 'INVALID_TEST_TOKEN') {
      const err = new Error('Verifikasi anti-bot gagal atau kedaluwarsa. Silakan ulangi.');
      err.code = 403;
      throw err;
    }
    const email = String(payload.email || '').trim().toLowerCase();
    const fullName = String(payload.fullName || '').trim();
    const password = String(payload.password || '');
    if (!email || !fullName || password.length < 6) {
      throw new Error('Lengkapi nama, email, dan kata sandi (min. 6 karakter).');
    }
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('Email sudah terdaftar.');
    }
    const userId = uuid();
    const token = `demo-token-${uuid()}`;
    const newUser = {
      userId,
      email,
      password,
      fullName,
      role: 'USER',
      licenseStatus: 'ACTIVE',
      token,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    db.kops.push({
      kop_id: uuid(),
      user_id: userId,
      header_line_1: 'PEMERINTAH KABUPATEN SEJAHTERA',
      header_line_2: 'DINAS PENDIDIKAN',
      institution_name: 'UNIT KERJA / INSTANSI ANDA',
      address: 'Jl. Contoh Alamat No. 1',
      phone: 'Telp. (0000) 000 000',
      logo_drive_url: '',
    });
    saveDb(db);
    return {
      success: true,
      data: {
        token,
        user: {
          userId,
          email,
          fullName,
          role: 'USER',
          licenseStatus: 'ACTIVE',
          hasCustomGeminiKey: false,
          geminiKeyMasked: '',
        },
      },
    };
  }

  const user = getAuthUser(db, payload.token);
  if (!user) {
    const err = new Error('Sesi tidak valid atau telah berakhir.');
    err.code = 401;
    throw err;
  }

  if (action === 'logout') {
    user.token = '';
    saveDb(db);
    return { success: true };
  }

  if (action === 'getProfile') {
    return {
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        licenseStatus: user.licenseStatus,
        hasCustomGeminiKey: Boolean(user.geminiApiKey),
        geminiKeyMasked: maskKey(user.geminiApiKey),
      },
    };
  }

  if (action === 'saveGeminiApiKey') {
    const clean = String(payload.geminiApiKey || '').trim();
    if (clean && clean.length < 15) {
      throw new Error('Format GEMINI_API_KEY tidak valid.');
    }
    user.geminiApiKey = clean;
    saveDb(db);
    return {
      success: true,
      data: {
        hasCustomGeminiKey: Boolean(clean),
        geminiKeyMasked: maskKey(clean),
      },
    };
  }

  if (action === 'testGeminiApiKey') {
    await wait(600);
    const keyToTest = String(payload.geminiApiKey || user.geminiApiKey || '').trim();
    if (!keyToTest) {
      throw new Error('Masukkan atau simpan GEMINI_API_KEY terlebih dahulu.');
    }
    return {
      success: true,
      message: 'Koneksi Gemini berhasil (Mode Demo: gemini-3.8-flash)',
      data: { activeModel: 'gemini-3.8-flash', reply: 'OK' },
    };
  }

  if (action === 'getKopList') {
    return {
      success: true,
      data: db.kops.filter((k) => k.user_id === user.userId),
    };
  }

  if (action === 'saveKop') {
    const kopId = payload.kop_id || uuid();
    const record = {
      kop_id: kopId,
      user_id: user.userId,
      header_line_1: payload.header_line_1 || '',
      header_line_2: payload.header_line_2 || '',
      institution_name: payload.institution_name || '',
      address: payload.address || '',
      phone: payload.phone || '',
      logo_drive_url: payload.logoBase64
        ? `data:${payload.logoMimeType || 'image/png'};base64,${payload.logoBase64}`
        : payload.logo_drive_url || '',
    };
    const idx = db.kops.findIndex((k) => k.kop_id === kopId && k.user_id === user.userId);
    if (idx >= 0) db.kops[idx] = record;
    else db.kops.push(record);
    saveDb(db);
    return { success: true, data: record };
  }

  if (action === 'deleteKop') {
    const idx = db.kops.findIndex((k) => k.kop_id === payload.kopId && k.user_id === user.userId);
    if (idx < 0) throw new Error('Kop instansi tidak ditemukan.');
    db.kops.splice(idx, 1);
    saveDb(db);
    return { success: true };
  }

  if (action === 'getMeetings') {
    const items = db.meetings
      .filter((m) => m.user_id === user.userId)
      .map((m) => ({
        meeting_id: m.meeting_id,
        kop_id: m.kop_id,
        title: m.title,
        doc_type_title: m.doc_type_title,
        doc_number: m.doc_number,
        meeting_date: m.meeting_date,
        time_range: m.time_range,
        location: m.location,
        duration_sec: m.duration_sec,
        participant_count: m.participant_count,
        has_audio: Boolean(m.has_local_audio),
        status: m.status,
        is_ai_generated: m.is_ai_generated,
        created_at: m.created_at,
        pending_action_count: (m.action_items || []).filter((a) => a.status !== 'DONE').length,
        decision_count: (m.summary?.keputusan || []).length,
      }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    return { success: true, data: items };
  }

  if (action === 'getMeetingDetail') {
    const m = db.meetings.find((x) => x.meeting_id === payload.meetingId && x.user_id === user.userId);
    if (!m) throw new Error('Data rapat tidak ditemukan.');
    const kop = db.kops.find((k) => k.kop_id === m.kop_id && k.user_id === user.userId) || null;
    return {
      success: true,
      data: { ...m, kop },
    };
  }

  if (action === 'transcribeAudioSegment') {
    await wait(700);
    return {
      success: true,
      data: {
        segmentIndex: payload.segmentIndex || 1,
        transcript: `Segmen ${payload.segmentIndex || 1}: Pembahasan rapat "${payload.title}" di ${payload.location} berlangsung lancar dan terarah sesuai agenda.`,
      },
    };
  }

  if (action === 'synthesizeMinutesFromTranscript') {
    return mockRequest('processMeetingAudio', {
      ...payload,
      liveTranscriptHint: payload.transcriptText,
    });
  }

  if (action === 'processMeetingAudio') {
    await wait(1400); // Simulasi pemrosesan transkripsi + penyusunan notulen AI
    const meetingId = uuid();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const startClock = now.toTimeString().slice(0, 5).replace(':', '.');
    const participants = Array.isArray(payload.participants) ? payload.participants : [];
    const liveTranscript = String(payload.liveTranscriptHint || '').trim();

    const transcriptText =
      liveTranscript.length > 20
        ? liveTranscript
        : `Pimpinan Rapat: Baik Bapak/Ibu, kita mulai rapat "${payload.title}" di ${payload.location}. Mohon setiap koordinator menyampaikan laporan singkat.\nNotulis (${user.fullName}): Siap, seluruh catatan pembahasan, keputusan, dan tindak lanjut telah direkam untuk disusun menjadi notulen resmi.`;

    const newMeeting = {
      meeting_id: meetingId,
      user_id: user.userId,
      kop_id: payload.kopId || db.kops.find((k) => k.user_id === user.userId)?.kop_id || '',
      title: payload.title,
      doc_type_title: payload.docTypeTitle || 'NOTULEN RAPAT',
      doc_number: payload.docNumber || '-',
      meeting_date: payload.meetingDate || today,
      time_range: `${startClock} WIB`,
      location: payload.location,
      duration_sec: Number(payload.durationSec) || 0,
      participant_count: Number(payload.participantCount) || participants.length || 1,
      has_local_audio: true,
      transcript_text: transcriptText,
      summary: {
        pembahasan: `Rapat "${payload.title}" dilaksanakan di ${payload.location} dengan durasi ${Math.max(1, Math.round((payload.durationSec || 60) / 60))} menit. Peserta membahas agenda utama secara terarah, mengevaluasi kendala teknis lapangan, serta menyepakati pembagian tugas lintas penanggung jawab.`,
        keputusan: [
          `Menyetujui rencana pelaksanaan agenda "${payload.title}" sesuai jadwal yang ditetapkan.`,
          'Menugaskan koordinator terkait untuk melakukan tindak lanjut dan pelaporan berkala.',
        ],
      },
      status: 'COMPLETED',
      is_ai_generated: true,
      created_at: now.toISOString(),
      participants: participants.map((p) => ({
        participant_id: uuid(),
        name: p.name,
        position: p.position || 'Peserta',
        attendance_status: p.attendance_status || 'HADIR',
      })),
      action_items: [
        {
          action_id: uuid(),
          order_no: 1,
          description: `Menyusun laporan tindak lanjut hasil ${payload.title}`,
          pic_name: participants[0]?.name || user.fullName,
          deadline: '3 hari kerja',
          status: 'PENDING',
        },
        {
          action_id: uuid(),
          order_no: 2,
          description: 'Mendistribusikan dokumen notulen resmi ke seluruh peserta rapat',
          pic_name: user.fullName,
          deadline: 'Hari ini',
          status: 'PENDING',
        },
      ],
    };

    db.meetings.unshift(newMeeting);
    saveDb(db);
    return {
      success: true,
      message: 'Notulen AI berhasil disusun (Mode Demo).',
      data: { meetingId },
    };
  }

  if (action === 'updateMeeting') {
    const idx = db.meetings.findIndex((x) => x.meeting_id === payload.meetingId && x.user_id === user.userId);
    if (idx < 0) throw new Error('Data rapat tidak ditemukan.');
    const cur = db.meetings[idx];
    const updated = {
      ...cur,
      kop_id: payload.kop_id !== undefined ? payload.kop_id : cur.kop_id,
      title: payload.title !== undefined ? payload.title : cur.title,
      doc_type_title: payload.doc_type_title !== undefined ? payload.doc_type_title : cur.doc_type_title,
      doc_number: payload.doc_number !== undefined ? payload.doc_number : cur.doc_number,
      meeting_date: payload.meeting_date !== undefined ? payload.meeting_date : cur.meeting_date,
      time_range: payload.time_range !== undefined ? payload.time_range : cur.time_range,
      location: payload.location !== undefined ? payload.location : cur.location,
      summary: payload.summary !== undefined ? payload.summary : cur.summary,
      participants: Array.isArray(payload.participants) ? payload.participants : cur.participants,
      participant_count: Array.isArray(payload.participants)
        ? payload.participants.length
        : cur.participant_count,
      action_items: Array.isArray(payload.action_items) ? payload.action_items : cur.action_items,
    };
    db.meetings[idx] = updated;
    saveDb(db);
    const kop = db.kops.find((k) => k.kop_id === updated.kop_id && k.user_id === user.userId) || null;
    return { success: true, data: { ...updated, kop } };
  }

  if (action === 'updateActionItemStatus') {
    const m = db.meetings.find((x) => x.meeting_id === payload.meetingId && x.user_id === user.userId);
    if (!m) throw new Error('Data rapat tidak ditemukan.');
    const item = (m.action_items || []).find((a) => a.action_id === payload.actionId);
    if (!item) throw new Error('Tindak lanjut tidak ditemukan.');
    item.status = payload.status === 'DONE' ? 'DONE' : 'PENDING';
    saveDb(db);
    return { success: true, data: { actionId: item.action_id, status: item.status } };
  }

  if (action === 'deleteMeeting') {
    const idx = db.meetings.findIndex((x) => x.meeting_id === payload.meetingId && x.user_id === user.userId);
    if (idx < 0) throw new Error('Data rapat tidak ditemukan.');
    db.meetings.splice(idx, 1);
    saveDb(db);
    return { success: true, message: 'Rapat berhasil dihapus.' };
  }

  if (action === 'getUsers') {
    if (user.role !== 'ADMIN') throw new Error('Akses ditolak.');
    return {
      success: true,
      data: db.users.map((u) => ({
        userId: u.userId,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        licenseStatus: u.licenseStatus,
        createdAt: u.createdAt,
      })),
    };
  }

  if (action === 'manageUser') {
    if (user.role !== 'ADMIN') throw new Error('Akses ditolak.');
    if (payload.operation === 'create') {
      const email = String(payload.email || '').trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error('Email sudah terdaftar.');
      }
      db.users.push({
        userId: uuid(),
        email,
        password: payload.password,
        fullName: payload.fullName,
        role: payload.role === 'ADMIN' ? 'ADMIN' : 'USER',
        licenseStatus: 'ACTIVE',
        token: '',
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
      return { success: true };
    }
    if (payload.operation === 'updateStatus') {
      const target = db.users.find((u) => u.userId === payload.targetUserId);
      if (!target) throw new Error('Pengguna tidak ditemukan.');
      target.licenseStatus = payload.licenseStatus === 'REVOKED' ? 'REVOKED' : 'ACTIVE';
      saveDb(db);
      return { success: true };
    }
  }

  throw new Error('Aksi tidak dikenali.');
}
