# Product Requirement Document (PRD) & Arsitektur Sistem: Replikasi Aplikasi "Notulis" (AI Meeting Minutes Serverless)

---

## 1. Ringkasan Eksekutif & Tujuan Aplikasi

Aplikasi **Notulis** adalah aplikasi web *mobile-first* berbasis AI untuk **merekam audio rapat secara langsung dari peramban (HP/laptop), mentranskripsikannya, dan menyusunnya secara otomatis menjadi dokumen notulen rapat resmi** (format `.docx` siap cetak/PDF) dalam waktu sekitar 2 menit.

* **Fungsi Utama:** Merekam audio rapat berdurasi panjang (hingga ~3 jam) menggunakan sistem penyimpanan potongan audio (*chunking*) di perangkat, melakukan transkripsi suara-ke-teks (*Speech-to-Text*), dan mengekstrak struktur notulen formal menggunakan AI—lengkap dengan kop instansi, nomor surat, daftar hadir, poin keputusan, dan tabel tindak lanjut (*action items*).
* **Target Pengguna:** Sekretaris rapat, guru/tenaga kependidikan (contoh: *SMP Negeri 3 Sejahtera*), pegawai instansi pemerintahan (*Dinas Pendidikan*), panitia organisasi, serta staf administrasi perusahaan di Indonesia yang membutuhkan format notulen baku/resmi.
* **Masalah yang Diselesaikan:** Menghilangkan beban pencatatan manual saat rapat berlangsung serta memangkas waktu pengetikan ulang notulen yang biasanya memakan waktu 1–2 jam per rapat.
* **Catatan Integrasi Peta:** Pada alur inti tidak terdapat fitur peta geografis. `[Asumsi Logika]` Apabila di masa depan ditambahkan fitur verifikasi lokasi rapat (*geo-tagging* ruang rapat/daftar hadir), modul peta wajib menggunakan **Google Maps Satellite Hybrid** (`mapTypeId: 'hybrid'`) sebagai tampilan *default* lengkap dengan label jalan dan bangunan.

---

## 2. Daftar Fitur & User Flow (Alur Pengguna)

### Daftar Fitur Teridentifikasi

1. **Autentikasi, Sesi & Object-Level RBAC `[Asumsi Logika]`:**
   * Login pengguna (email & password dengan hashing) untuk model akses lisensi.
   * Hak akses (*role*): `ADMIN` (mengelola master kop instansi & pengguna) dan `USER` (membuat, merekam, mengedit, dan mengunduh notulen miliknya sendiri).
   * Setiap endpoint API wajib memvalidasi kepemilikan data (*Object-Level RBAC*: `record.user_id === authenticatedUserId`) dan mengembalikan error generik `404 Not Found` / `403 Forbidden` jika mengakses UUID milik pengguna lain.
2. **Manajemen Profil & Kop Instansi `[Asumsi Logika]`:**
   * Pengaturan nama instansi induk, sub-instansi, nama unit (contoh: *Pemerintah Kabupaten Sejahtera / Dinas Pendidikan / SMP Negeri 3 Sejahtera*), alamat, nomor telepon, dan logo kop surat.
3. **Pembuatan Sesi Rapat Baru `[Asumsi Logika]`:**
   * Form input judul rapat, jenis notulen (*Notulen Rapat Dewan Guru*), lokasi/ruangan, nomor surat (otomatis/manual), dan daftar peserta (untuk mengisi jumlah peserta dan *Daftar Hadir*).
4. **Perekam Audio Berbasis Potongan (*Chunked Recorder*):**
   * Tampilan *dark mode* hemat baterai untuk perekaman durasi panjang.
   * Indikator status `REC`, timer presisi (`HH:MM:SS`), dan visualisasi gelombang suara (*waveform*) *real-time*.
   * Tiga indikator penghitung di bawah *waveform* `[Asumsi Logika]`: total potongan audio terekam (*chunks*), potongan tersimpan aman di penyimpanan lokal/IndexedDB, dan potongan yang sudah diproses/diunggah.
   * Pratinjau teks transkrip langsung (*live caption*) di latar belakang.
   * Tombol akhiri rekaman dengan dialog konfirmasi (*"Rapat selesai?"*).
5. **Penyusunan Notulen Otomatis oleh AI:**
   * Penggabungan audio/transkrip dan pemrosesan LLM untuk menghasilkan dokumen terstruktur berlabel badge `Disusun AI` (Nomor Surat, Hari/Tanggal, Waktu, Tempat, Daftar Hadir, Pembahasan, Keputusan, dan Tabel Tindak Lanjut).
6. **Halaman Detail Rapat Multi-Tab:**
   * **Tab Notulen:** Menampilkan dokumen terstruktur + tombol `Unduh .docx` dan `Cetak / PDF`.
   * **Tab Transkrip:** Menampilkan teks mentah hasil transkripsi percakapan `[Asumsi Logika]`.
   * **Tab Rekaman:** Pemutar audio (*audio player*) untuk memutar ulang rekaman rapat `[Asumsi Logika]`.
   * **Tab Detail Rapat:** Informasi metadata rapat, daftar hadir peserta, dan tombol edit metadata `[Asumsi Logika]`.
   * Aksi manajemen: Tombol merah `Hapus Rapat` dan menu titik tiga (`...`) untuk opsi tambahan `[Asumsi Logika]`.
7. **Pencarian & Filter Daftar Rapat `[Asumsi Logika]`:**
   * Daftar riwayat rapat di beranda dengan pencarian judul/nomor surat serta filter tanggal atau kategori rapat.

### User Flow Utama (End-to-End)

#### Alur 1: Perekaman hingga Penyusunan Notulen AI
1. Pengguna membuka aplikasi → Login → Masuk ke **Dashboard Daftar Rapat**.
2. Pengguna menekan tombol **"+ Rapat Baru"**, mengisi Judul, Tempat, Nomor Surat, dan Daftar Peserta, lalu menekan **"Mulai Rekam"**.
3. Aplikasi masuk ke **Layar Perekaman (Dark Mode)**, meminta izin mikrofon browser, dan mulai merekam audio dalam potongan kecil (misal per 10–60 detik) yang disimpan ke **IndexedDB** agar tahan *refresh*/putus sinyal `[Asumsi Logika]`.
4. Setelah rapat selesai, pengguna menekan tombol **Stop**.
5. Muncul dialog konfirmasi **SweetAlert2 (kompak)**: *"Rapat selesai? Rekaman HH:MM:SS akan ditranskrip lalu disusun jadi notulen."* dengan pilihan **"Selesai & susun notulen"** atau **"Lanjut merekam"**.
6. Pengguna memilih **"Selesai & susun notulen"** → Indikator *loading* progresif muncul (Mengunggah audio → Transkripsi AI → Menyusun Notulen → Menyimpan ke Database).
7. Setelah selesai, pengguna diarahkan otomatis ke **Halaman Detail Rapat** (Tab `Notulen`).

#### Alur 2: Ekspor Dokumen Resmi (`.docx` & PDF)
1. Di Halaman Detail Rapat (Tab `Notulen`), pengguna memeriksa hasil susunan AI (Kop, Keputusan, Tabel Tindak Lanjut).
2. Jika menekan **`Unduh .docx`**, frontend meminta GAS men-generate file Google Docs berbasis template kop instansi lalu mengonversinya menjadi tautan unduhan `.docx` (atau men-generate `.docx` langsung di sisi klien menggunakan library `docx`).
3. Jika menekan **`Cetak / PDF`**, browser membuka tampilan cetak terformat (`@media print` A4 berkop surat) atau mengunduh PDF langsung dari GAS.

#### Alur 3: Penghapusan Rapat
1. Di Halaman Detail Rapat, pengguna menekan tombol **`Hapus Rapat`**.
2. Muncul konfirmasi **SweetAlert2 kompak** berikon peringatan.
3. Jika dikonfirmasi, React mengirim `POST action=deleteMeeting` (dengan token sesi) ke GAS. Backend memverifikasi kepemilikan data (`user_id`), menghapus baris terkait di Google Sheets & file audio di Google Drive, menampilkan toast sukses, lalu kembali ke Dashboard.

---

## 3. Desain Sistem & Antarmuka (UI/UX & Komponen React)

### Prinsip Tata Letak & Responsivitas
* **Mobile-First Strict:** Gaya dasar dirancang untuk layar mobile terlebih dahulu (breakpoint `min-width`), menggunakan satuan `rem`/`em`, dan target sentuh tombol minimal `48x48px` (`min-h-[3rem] min-w-[3rem]`).
* **Fluid Flexbox Grid:** Kartu daftar rapat, metrik potongan audio, dan grup tombol menggunakan Flexbox adaptif (`display: flex; flex-wrap: wrap;` dengan `flex: 1 1 [optimal-width]`) agar membungkus otomatis tanpa ketergantungan media query berlebihan.

### Skema Warna & Tipografi
* **Mode Terang (Dashboard & Detail Rapat):**
  * Latar belakang: `#F8FAFC` (Slate 50), Kartu: `#FFFFFF`, Border: `#E2E8F0`.
  * Warna Primer (CTA): `#2563EB` (Royal Blue — tombol `Unduh .docx` & `Selesai & susun notulen`).
  * Warna Aksen AI: Latar `#EFF6FF`, teks `#2563EB` (badge `✦ Disusun AI`).
  * Warna Destruktif: Latar `#FEF2F2`, teks `#DC2626` (tombol `Hapus Rapat`).
* **Mode Gelap (Khusus Layar Perekaman):**
  * Latar belakang: `#0F172A` (Slate 900) hingga `#1E293B` (Slate 800) untuk kontras tinggi dan hemat daya OLED.
  * Timer: Font *monospace* (`JetBrains Mono` / `tabular-nums`) ukuran besar (`text-4xl`).
  * Indikator `REC`: Titik merah berdenyut (`#EF4444` + `animate-pulse`).
* **Tipografi:** `Inter` / `Plus Jakarta Sans` untuk antarmuka UI; `Times New Roman` / `Serif` khusus pratinjau dokumen notulen resmi.

### Struktur Pemecahan Komponen React (Vite)

```text
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx            # Header mobile-first, tombol back, menu profil
│   │   └── BottomNav.jsx         # Navigasi bawah untuk layar HP (Rapat, Kop Surat, Akun)
│   ├── meeting/
│   │   ├── MeetingCard.jsx       # Kartu ringkasan rapat untuk mobile (pengganti tabel lebar)
│   │   ├── MeetingFormModal.jsx  # Modal buat/edit metadata & peserta rapat
│   │   ├── AudioRecorder.jsx     # Layar rekam dark mode, timer, canvas waveform, chunk counter
│   │   ├── MeetingTabs.jsx       # Navigasi 4 tab (Notulen, Transkrip, Rekaman, Detail)
│   │   ├── MinutesPreview.jsx    # Pratinjau dokumen berkop, keputusan, & tabel tindak lanjut
│   │   └── ActionItemTable.jsx   # Tabel tindak lanjut responsif (tabel di desktop, card di mobile)
│   └── common/
│       ├── LoadingOverlay.jsx    # Overlay & skeleton loader khusus latensi GAS (1.5–4 detik)
│       └── EmptyState.jsx        # Ilustrasi saat belum ada rapat
├── pages/
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── RecordPage.jsx
│   ├── MeetingDetailPage.jsx
│   └── SettingsKopPage.jsx
├── services/
│   ├── api.js                    # Komunikasi fetch ke Web App GAS (handle CORS & timeout)
│   └── indexedDb.js              # Penyimpanan lokal potongan audio (anti-hilang)
└── utils/
    └── swal.js                   # Wrapper SweetAlert2 ukuran kompak (mobile-friendly)
```

### Penanganan Indikator Loading (Latensi GAS)
1. **Fetch Data Daftar/Detail:** Gunakan **Skeleton Loader** pada `MeetingCard` dan `MinutesPreview` agar tata letak tidak melompat (*CLS rendah*).
2. **Aksi Simpan/Hapus:** Gunakan state `isSubmitting` pada tombol (nonaktifkan tombol + spinner kecil) untuk mencegah *double-submit*.
3. **Proses AI Penyusunan Notulen:** Gunakan **SweetAlert2 Loading Modal** dengan pembaruan teks status bertahap (*"Mengunggah potongan audio..."* → *"Mentranskripsi percakapan..."* → *"Menyusun notulen resmi..."*).

### Peta Pemicu SweetAlert2 Ukuran Kompak
Semua `alert()` dan `confirm()` bawaan browser diganti dengan instance `SwalCompact` (`width: '19.5rem'`, `padding: '1rem'`, `font-size: '0.875rem'`):
* **Konfirmasi Akhiri Rekaman:** *"Rapat selesai? Rekaman HH:MM:SS akan ditranskrip lalu disusun jadi notulen."* (`Selesai & susun notulen` | `Lanjut merekam`).
* **Konfirmasi Hapus Rapat:** Peringatan permanen saat menekan `Hapus Rapat`.
* **Notifikasi Toast (Pojok Atas):** Berhasil menyimpan kop instansi, berhasil mengunduh `.docx`, gagal koneksi/mikrofon ditolak, dan error validasi form.
* **Konfirmasi Keluar Saat Merekam:** Mencegah pengguna tidak sengaja menekan tombol Back saat rekaman berlangsung.

---

## 4. Perancangan Database Google Sheets

Satu file Google Spreadsheet bertindak sebagai database relasional dengan **5 Tab (Sheet)**. Semua Primary Key menggunakan **UUIDv4** (`Utilities.getUuid()`) agar tidak dapat ditebak (*anti-IDOR*) dan aman dari bentrokan penulisan paralel.

### 1. Sheet: `Users` `[Asumsi Logika]`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `user_id` | UUIDv4 (PK) | ID unik pengguna |
| B | `email` | String | Email unik untuk login |
| C | `password_hash` | String | Hash kata sandi + salt |
| D | `full_name` | String | Nama lengkap & gelar |
| E | `role` | String | `ADMIN` / `USER` |
| F | `license_status` | String | `ACTIVE` / `REVOKED` |
| G | `session_token` | String | Token sesi aktif berbatas waktu |
| H | `created_at` | ISO DateTime | Waktu pendaftaran |

### 2. Sheet: `Instansi_Kop`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `kop_id` | UUIDv4 (PK) | ID unik kop surat |
| B | `user_id` | UUIDv4 (FK) | Relasi ke `Users.user_id` |
| C | `header_line_1` | String | Contoh: `PEMERINTAH KABUPATEN SEJAHTERA` |
| D | `header_line_2` | String | Contoh: `DINAS PENDIDIKAN` |
| E | `institution_name` | String | Contoh: `SMP NEGERI 3 SEJAHTERA` |
| F | `address` | String | Contoh: `Jl. Pelajar No. 3, Kota Sejahtera` |
| G | `phone` | String | Contoh: `Telp. (0000) 551 203` |
| H | `logo_drive_url` | String | ID/URL file logo instansi di Google Drive |

### 3. Sheet: `Meetings` (Tabel Inti)
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `meeting_id` | UUIDv4 (PK) | ID unik rapat |
| B | `user_id` | UUIDv4 (FK) | Relasi ke `Users.user_id` (wajib dicek di setiap endpoint) |
| C | `kop_id` | UUIDv4 (FK) | Relasi ke `Instansi_Kop.kop_id` |
| D | `title` | String | Contoh: `Rapat Dewan Guru Persiapan Penilaian Akhir Semester` |
| E | `doc_type_title` | String | Contoh: `NOTULEN RAPAT DEWAN GURU` |
| F | `doc_number` | String | Contoh: `421.3/046/NOT/XI/2026` |
| G | `meeting_date` | String | Format `YYYY-MM-DD` |
| H | `time_range` | String | Contoh: `13.00 – 16.00 WIB` |
| I | `location` | String | Contoh: `Ruang Guru SMP Negeri 3 Sejahtera` |
| J | `duration_sec` | Number | Durasi rekaman dalam detik |
| K | `participant_count` | Number | Jumlah peserta |
| L | `audio_drive_id` | String | ID file audio di Google Drive |
| M | `docx_drive_id` | String | ID file hasil ekspor `.docx` / Google Docs di Drive |
| N | `transcript_text` | Long String | Teks transkrip (atau `DRIVE_FILE:<id>` jika > 40.000 karakter) |
| O | `summary_json` | JSON String | Struktur pembukaan, agenda, & poin **IV. Keputusan** |
| P | `status` | String | `RECORDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| Q | `is_ai_generated` | Boolean | `TRUE` (memicu badge `✦ Disusun AI`) |
| R | `created_at` | ISO DateTime | Timestamp pembuatan |

*(Catatan Batas Sel Google Sheets: Batas maksimal 1 sel adalah 50.000 karakter. `[Asumsi Logika]` Jika transkrip > 40.000 karakter, simpan teks penuh sebagai file `.txt` di Google Drive dan simpan pointer `DRIVE_FILE:<file_id>` di kolom `transcript_text`.)*

### 4. Sheet: `Participants` (Daftar Hadir)
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `participant_id` | UUIDv4 (PK) | ID unik baris kehadiran |
| B | `meeting_id` | UUIDv4 (FK) | Relasi ke `Meetings.meeting_id` |
| C | `user_id` | UUIDv4 (FK) | Pemilik record untuk verifikasi RBAC |
| D | `name` | String | Nama peserta + gelar |
| E | `position` | String | Jabatan/Mapel |
| F | `attendance_status` | String | `HADIR` / `IZIN` / `TIDAK HADIR` |

### 5. Sheet: `Action_Items` (Tabel V. Tindak Lanjut)
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `action_id` | UUIDv4 (PK) | ID unik tindak lanjut |
| B | `meeting_id` | UUIDv4 (FK) | Relasi ke `Meetings.meeting_id` |
| C | `user_id` | UUIDv4 (FK) | Pemilik record untuk verifikasi RBAC |
| D | `order_no` | Number | Nomor urut (`1`, `2`, `3`, ...) |
| E | `description` | String | Kolom `Uraian` |
| F | `pic_name` | String | Kolom `Penanggung Jawab` |
| G | `deadline` | String | Kolom `Batas Waktu` |
| H | `status` | String | `PENDING` / `DONE` `[Asumsi Logika]` |

### Diagram Relasi Antar-Sheet
* `Users (1)` ↔ `(N) Instansi_Kop` (via `user_id`)
* `Users (1)` ↔ `(N) Meetings` (via `user_id`)
* `Instansi_Kop (1)` ↔ `(N) Meetings` (via `kop_id`)
* `Meetings (1)` ↔ `(N) Participants` (via `meeting_id` — *Cascade Delete* via GAS)
* `Meetings (1)` ↔ `(N) Action_Items` (via `meeting_id` — *Cascade Delete* via GAS)

---

## 5. Arsitektur API Google Apps Script (`Code.gs`) & Integrasi React

### Struktur Endpoint & Action
Routing menggunakan satu URL Web App (`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`) dengan parameter `action` dan validasi token sesi pada setiap permintaan terproteksi:

* **`doGet(e)` — Operasi Baca (Read-Only):**
  * `?action=getMeetings&token=<session_token>` → Mengambil daftar rapat milik `authenticatedUserId`.
  * `?action=getMeetingDetail&meetingId=<uuid>&token=<session_token>` → Mengambil detail rapat hanya jika `meeting.user_id === authenticatedUserId`.
  * `?action=getKopList&token=<session_token>` → Mengambil daftar kop instansi milik `authenticatedUserId`.
* **`doPost(e)` — Operasi Tulis & Pemrosesan AI (Write/Mutation):**
  * `action: "login"` → Verifikasi kredensial & mengembalikan `session_token`.
  * `action: "processMeetingAudio"` → Validasi sesi, simpan audio (Base64) ke Drive, panggil Gemini API untuk transkripsi & notulen JSON, simpan ke `Meetings` & `Action_Items` dengan `user_id` terautentikasi.
  * `action: "exportDocx"` → Validasi kepemilikan `meeting_id`, salin Template Google Docs, isi placeholder, kembalikan URL ekspor `.docx`.
  * `action: "deleteMeeting"` → Validasi kepemilikan `meeting_id`, hapus baris di `Meetings`, `Participants`, `Action_Items`, serta file Drive terkait.

### Mekanisme Penanganan CORS (Vite React ↔ GAS)
Google Apps Script tidak mendukung *custom headers* pada `OPTIONS` (*preflight*).
1. Deploy GAS sebagai Web App dengan akses **"Anyone"**.
2. Di React (`api.js`), semua request `POST` wajib memakai header `Content-Type: text/plain;charset=utf-8` (*Simple Request* sehingga browser tidak mengirim *preflight* `OPTIONS`) dan mengirim JSON string di dalam `body`.
3. Gunakan `redirect: 'follow'` pada `fetch()` untuk mengikuti *HTTP 302 Redirect* dari GAS ke `script.googleusercontent.com`.
4. Di GAS (`doPost(e)`), parse payload dengan `JSON.parse(e.postData.contents)` dan kembalikan `ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON)`.

### Integrasi Pihak Ketiga & Keamanan
1. **Google Gemini API (`gemini-2.5-flash` via `UrlFetchApp` di GAS):** Transkripsi audio multimodal + ekstraksi JSON terstruktur dalam satu panggil. API Key disimpan aman di `PropertiesService.getScriptProperties()` (tidak pernah ditaruh di kode frontend).
2. **Google Drive API (`DriveApp`):** Penyimpanan audio rekaman, logo kop, transkrip panjang, dan hasil `.docx`.
3. **Google Docs API (`DocumentApp`):** Generate dokumen resmi berkop surat dan ekspor `.docx`/`.pdf`.
4. **Web Audio API & MediaRecorder API:** Perekaman audio *chunked* dan visualisasi *waveform* di browser.
5. **Checklist Keamanan:** `.env` dimasukkan ke `.gitignore`, validasi tipe & ukuran unggahan audio, sanitasi formula injection Google Sheets (mencegah string diawali `=`, `+`, `-`, `@`), serta pesan error generik agar detail internal server tidak bocor.

---

## 6. Langkah Implementasi Bertahap (Roadmap & Starter Code)

### Roadmap Pengerjaan
1. **Fase 1 — Setup Database & Drive (Hari 1):** Buat Google Spreadsheet dengan 5 tab sesuai Bagian 4, buat folder Drive `Notulis_Storage`, dan simpan `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, serta `GEMINI_API_KEY` di *Script Properties* GAS.
2. **Fase 2 — Backend Google Apps Script (Hari 2–3):** Tempelkan `Code.gs`, uji fungsi dengan data dummy, lalu **Deploy → New Deployment → Web App** (`Execute as: Me`, `Who has access: Anyone`).
3. **Fase 3 — Inisialisasi Proyek Vite + React (Hari 3):**
   ```bash
   npm create vite@latest notulis-app -- --template react
   cd notulis-app
   npm install tailwindcss @tailwindcss/vite sweetalert2 lucide-react
   ```
   Simpan URL Web App di `.env` (pastikan `.env` ada di `.gitignore`) sebagai `VITE_GAS_API_URL`.
4. **Fase 4 — Pembangunan Fitur Inti & UI Mobile-First (Hari 4–7):** Implementasi `swal.js`, `api.js`, `RecordPage.jsx`, `MeetingDetailPage.jsx`, dan ekspor `.docx`.
5. **Fase 5 — Pengujian End-to-End & Deployment (Hari 8):** Deploy frontend ke Vercel/Netlify (wajib HTTPS agar izin mikrofon aktif di HP Android/iOS).

---

### Starter Code Lengkap Fitur Inti

#### 1) Backend Google Apps Script (`Code.gs`)
Dilengkapi `LockService`, sanitasi input anti-formula injection, UUIDv4, dan validasi kepemilikan data (**Object-Level RBAC**).

```javascript
/**
 * Notulis Serverless Backend (Google Apps Script)
 * Script Properties wajib diisi:
 * - SPREADSHEET_ID  : ID Google Sheets Database
 * - DRIVE_FOLDER_ID : ID Folder Google Drive penyimpanan audio
 * - GEMINI_API_KEY  : API Key Google Gemini
 */

const PROPS = PropertiesService.getScriptProperties();
const MAX_AUDIO_BASE64_LEN = 25 * 1024 * 1024; // Batas aman ~18MB audio

function getSheet(name) {
  const ss = SpreadsheetApp.openById(PROPS.getProperty('SPREADSHEET_ID'));
  return ss.getSheetByName(name);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// Sanitasi teks agar aman dari Spreadsheet Formula Injection
function sanitizeCell(val) {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

// Validasi token sesi -> mengembalikan user_id terautentikasi
function authenticateToken(token) {
  if (!token || typeof token !== 'string') return null;
  const rows = getSheet('Users').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][6] === token && rows[i][5] === 'ACTIVE') {
      return { userId: rows[i][0], role: rows[i][4] };
    }
  }
  return null;
}

// ==================== ROUTER GET ====================
function doGet(e) {
  try {
    const auth = authenticateToken(e.parameter.token);
    if (!auth) {
      return jsonResponse({ success: false, code: 401, message: 'Akses tidak diizinkan.' });
    }

    const action = e.parameter.action;
    if (action === 'getMeetingDetail') {
      return jsonResponse(handleGetMeetingDetail(e.parameter.meetingId, auth.userId));
    }
    return jsonResponse({ success: false, code: 400, message: 'Permintaan tidak valid.' });
  } catch (err) {
    return jsonResponse({ success: false, code: 500, message: 'Terjadi kesalahan sistem.' });
  }
}

// ==================== ROUTER POST ====================
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const body = JSON.parse(e.postData.contents);
    const auth = authenticateToken(body.token);
    if (!auth) {
      return jsonResponse({ success: false, code: 401, message: 'Akses tidak diizinkan.' });
    }

    const action = body.action;
    if (action === 'processMeetingAudio') {
      return jsonResponse(handleProcessMeetingAudio(body, auth.userId));
    }
    if (action === 'deleteMeeting') {
      return jsonResponse(handleDeleteMeeting(body.meetingId, auth.userId));
    }

    return jsonResponse({ success: false, code: 400, message: 'Permintaan tidak valid.' });
  } catch (err) {
    return jsonResponse({ success: false, code: 500, message: 'Terjadi kesalahan sistem.' });
  } finally {
    lock.releaseLock();
  }
}

// ==================== CORE: SIMPAN AUDIO & SUSUN NOTULEN AI ====================
function handleProcessMeetingAudio(data, authenticatedUserId) {
  const {
    kopId = '',
    title,
    docTypeTitle = 'NOTULEN RAPAT',
    docNumber = '-',
    location,
    durationSec,
    participantCount = 0,
    audioBase64,
    mimeType = 'audio/webm'
  } = data;

  // Validasi input ketat
  if (!title || !location || !audioBase64) {
    return { success: false, code: 400, message: 'Data rapat atau audio tidak lengkap.' };
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LEN) {
    return { success: false, code: 413, message: 'Ukuran file audio melebihi batas.' };
  }
  const allowedMimes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];
  if (!allowedMimes.includes(mimeType)) {
    return { success: false, code: 415, message: 'Format audio tidak didukung.' };
  }

  const meetingId = Utilities.getUuid();
  const now = new Date();
  const meetingDate = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');

  // 1. Simpan file audio ke Google Drive
  const folder = DriveApp.getFolderById(PROPS.getProperty('DRIVE_FOLDER_ID'));
  const decodedBytes = Utilities.base64Decode(audioBase64);
  const blob = Utilities.newBlob(decodedBytes, mimeType, `${meetingId}.webm`);
  const audioFile = folder.createFile(blob);
  const audioDriveId = audioFile.getId();

  // 2. Panggil Gemini API untuk Transkripsi & Penyusunan Notulen JSON
  const aiResult = callGeminiForMinutes(audioBase64, mimeType, title, location);

  // 3. Simpan baris utama ke Sheet "Meetings" (terikat ke authenticatedUserId)
  const meetingsSheet = getSheet('Meetings');
  const summaryPayload = JSON.stringify({
    pembahasan: aiResult.pembahasan || '',
    keputusan: aiResult.keputusan || []
  });

  meetingsSheet.appendRow([
    meetingId,
    authenticatedUserId,
    sanitizeCell(kopId),
    sanitizeCell(title),
    sanitizeCell(docTypeTitle),
    sanitizeCell(docNumber),
    meetingDate,
    sanitizeCell(aiResult.time_range || Utilities.formatDate(now, 'Asia/Jakarta', 'HH:mm') + ' WIB'),
    sanitizeCell(location),
    Number(durationSec) || 0,
    Number(participantCount) || 0,
    audioDriveId,
    '',
    sanitizeCell((aiResult.transkrip || '').slice(0, 40000)),
    summaryPayload,
    'COMPLETED',
    true,
    now.toISOString()
  ]);

  // 4. Simpan Tabel Tindak Lanjut ke Sheet "Action_Items"
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

  return {
    success: true,
    message: 'Notulen berhasil disusun oleh AI.',
    data: { meetingId, audioDriveId, notulen: aiResult }
  };
}

// ==================== HELPER GEMINI API ====================
function callGeminiForMinutes(audioBase64, mimeType, title, location) {
  const apiKey = PROPS.getProperty('GEMINI_API_KEY');
  const url = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$){apiKey}`;

  const promptText = `Anda adalah notulis profesional instansi di Indonesia.
Dengarkan rekaman rapat berjudul "${title}" di "${location}".
Kembalikan HANYA JSON valid tanpa markdown dengan struktur:
{
  "transkrip": "transkrip lengkap bahasa Indonesia",
  "pembahasan": "ringkasan pembahasan rapat",
  "keputusan": ["poin keputusan 1", "poin keputusan 2"],
  "tindak_lanjut": [
    {"uraian": "tugas", "penanggung_jawab": "nama/jabatan", "batas_waktu": "tanggal/tenggat"}
  ]
}`;

  const payload = {
    contents: [{
      parts: [
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: audioBase64 } }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(rawText);
}

// ==================== OBJECT-LEVEL RBAC: GET DETAIL & DELETE ====================
function handleGetMeetingDetail(meetingId, authenticatedUserId) {
  if (!meetingId) return { success: false, code: 404, message: 'Data tidak ditemukan.' };

  const rows = getSheet('Meetings').getDataRange().getValues();
  const headers = rows[0];
  // Verifikasi eksplisit: meeting_id DAN user_id harus cocok
  const match = rows.slice(1).find(r => r[0] === meetingId && r[1] === authenticatedUserId);
  if (!match) {
    // Error generik 404 agar tidak membocorkan keberadaan UUID milik user lain
    return { success: false, code: 404, message: 'Data tidak ditemukan.' };
  }

  const meeting = {};
  headers.forEach((h, i) => (meeting[h] = match[i]));

  const actionRows = getSheet('Action_Items').getDataRange().getValues();
  const actions = actionRows.slice(1)
    .filter(r => r[1] === meetingId && r[2] === authenticatedUserId)
    .map(r => ({
      action_id: r[0],
      order_no: r[3],
      description: r[4],
      pic_name: r[5],
      deadline: r[6],
      status: r[7]
    }));

  return { success: true, data: { ...meeting, action_items: actions } };
}

function handleDeleteMeeting(meetingId, authenticatedUserId) {
  if (!meetingId) return { success: false, code: 404, message: 'Data tidak ditemukan.' };

  const sheet = getSheet('Meetings');
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    // Verifikasi eksplisit kepemilikan data sebelum hapus
    if (rows[i][0] === meetingId && rows[i][1] === authenticatedUserId) {
      sheet.deleteRow(i + 1);
      deleteChildRows('Action_Items', meetingId, authenticatedUserId);
      deleteChildRows('Participants', meetingId, authenticatedUserId);
      return { success: true, message: 'Rapat berhasil dihapus.' };
    }
  }
  return { success: false, code: 404, message: 'Data tidak ditemukan.' };
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
```

---

#### 2) Wrapper SweetAlert2 Kompak (`src/utils/swal.js`) & Service API (`src/services/api.js`)

**`src/utils/swal.js`**
```javascript
import Swal from 'sweetalert2';

// SweetAlert2 ukuran kompak & mobile-friendly (touch target minimal 48px)
export const SwalCompact = Swal.mixin({
  width: '19.5rem',
  padding: '1rem',
  buttonsStyling: false,
  customClass: {
    popup: 'rounded-2xl text-sm shadow-xl',
    title: 'text-base font-bold text-slate-900 mb-1',
    htmlContainer: 'text-xs text-slate-600 leading-relaxed',
    actions: 'flex flex-col gap-2 w-full mt-4',
    confirmButton:
      'w-full min-h-[3rem] px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition',
    cancelButton:
      'w-full min-h-[3rem] px-4 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition',
  },
});

export const ToastCompact = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  width: '18.5rem',
  customClass: {
    popup: 'rounded-xl text-xs py-2.5 px-3 shadow-md',
  },
});
```

**`src/services/api.js`**
```javascript
const GAS_URL = import.meta.env.VITE_GAS_API_URL;

function getSessionToken() {
  return sessionStorage.getItem('notulis_token') || '';
}

/**
 * Mengirim POST ke Google Apps Script tanpa memicu CORS preflight (OPTIONS)
 * menggunakan Content-Type: text/plain;charset=utf-8
 */
export async function postToGAS(action, payload = {}) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action,
      token: getSessionToken(),
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error('Gagal terhubung ke server.');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Permintaan tidak dapat diproses.');
  }
  return result;
}

export async function getFromGAS(action, params = {}) {
  const query = new URLSearchParams({
    action,
    token: getSessionToken(),
    ...params,
  }).toString();

  const response = await fetch(`${GAS_URL}?${query}`, {
    method: 'GET',
    redirect: 'follow',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Gagal memuat data.');
  }
  return result;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

---

#### 3) Komponen Halaman Perekaman React (`src/pages/RecordPage.jsx`)
Mobile-first, menggunakan fluid Flexbox (`flex flex-wrap`), satuan `rem`, target sentuh minimal `48x48px`, serta integrasi **SweetAlert2 kompak**.

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Square, Mic } from 'lucide-react';
import { SwalCompact, ToastCompact } from '../utils/swal';
import { postToGAS, blobToBase64 } from '../services/api';

export default function RecordPage({
  meetingMeta = {
    title: 'Rapat Dewan Guru Persiapan Penilaian Akhir Semester',
    location: 'Ruang Guru SMP Negeri 3 Sejahtera',
    participantCount: 6,
  },
  onComplete,
  onBack,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [chunkStats, setChunkStats] = useState({ recorded: 0, saved: 0, synced: 0 });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const formatTime = (sec) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          setChunkStats((prev) => ({
            ...prev,
            recorded: prev.recorded + 1,
            saved: prev.saved + 1,
          }));
        }
      };

      recorder.start(10000); // Simpan potongan per 10 detik
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } catch {
      ToastCompact.fire({
        icon: 'error',
        title: 'Izin mikrofon ditolak atau tidak tersedia.',
      });
    }
  };

  const handleStopPrompt = async () => {
    const durationText = formatTime(elapsedSec);

    const confirm = await SwalCompact.fire({
      title: 'Rapat selesai?',
      html: `Rekaman <b>${durationText}</b> akan ditranskrip lalu disusun jadi notulen. Semua potongan sudah tersimpan di HP ini.`,
      showCancelButton: true,
      confirmButtonText: 'Selesai & susun notulen',
      cancelButtonText: 'Lanjut merekam',
    });

    if (!confirm.isConfirmed) return;

    clearInterval(timerRef.current);
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => processAudioToServer();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    } else {
      processAudioToServer();
    }
  };

  const processAudioToServer = async () => {
    SwalCompact.fire({
      title: 'Menyusun Notulen...',
      html: 'Mengunggah audio & memproses dengan AI.<br/>Mohon tunggu ±1–2 menit.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => SwalCompact.showLoading(),
    });

    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const audioBase64 = await blobToBase64(audioBlob);

      const res = await postToGAS('processMeetingAudio', {
        title: meetingMeta.title,
        location: meetingMeta.location,
        participantCount: meetingMeta.participantCount,
        durationSec: elapsedSec,
        audioBase64,
        mimeType: 'audio/webm',
      });

      SwalCompact.close();
      await ToastCompact.fire({
        icon: 'success',
        title: 'Notulen AI berhasil dibuat!',
      });

      if (onComplete) onComplete(res.data.meetingId);
    } catch (error) {
      SwalCompact.fire({
        icon: 'error',
        title: 'Gagal Menyusun Notulen',
        text: error.message || 'Periksa koneksi internet Anda dan coba lagi.',
        confirmButtonText: 'Tutup',
      });
    }
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-2 pt-2">
        <button
          onClick={onBack}
          className="min-w-[3rem] min-h-[3rem] -ml-2 flex items-center justify-center text-slate-400 hover:text-white"
          aria-label="Kembali"
        >
          <ChevronLeft className="w-6 h-6"/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{meetingMeta.title}</h1>
          <p className="text-xs text-slate-400 truncate">
            {meetingMeta.location} · {meetingMeta.participantCount} peserta
          </p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-red-400 tracking-wider">REC</span>
          </div>
        )}
      </header>

      {/* Center Timer & Waveform */}
      <main className="flex flex-col items-center my-auto py-8">
        <div className="font-mono text-5xl font-bold tracking-wider tabular-nums mb-8">
          {formatTime(elapsedSec)}
        </div>

        {/* Visual Waveform */}
        <div className="w-full h-24 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-center gap-1 px-4 overflow-hidden">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                isRecording ? 'bg-slate-400 animate-pulse' : 'bg-slate-700'
              }`}
              style={{
                height: isRecording ? `${20 + ((i * 19) % 60)}%` : '15%',
              }}
            />
          ))}
        </div>

        {/* Fluid Flexbox Counter Boxes */}
        <div className="flex flex-wrap gap-2.5 w-full mt-5">
          {[
            { label: 'Potongan', val: chunkStats.recorded },
            { label: 'Tersimpan', val: chunkStats.saved },
            { label: 'Diproses', val: chunkStats.synced },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex-1 basis-[5.5rem] bg-slate-900 border border-slate-800 rounded-xl py-2.5 text-center"
            >
              <div className="text-base font-bold text-slate-200">{item.val}</div>
              <div className="text-[0.625rem] text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Controls (Touch target >= 48x48px) */}
      <footer className="pb-6 flex justify-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-16 h-16 min-w-[3rem] min-h-[3rem] rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition"
            aria-label="Mulai Rekam"
          >
            <Mic className="w-7 h-7 text-white"/>
          </button>
        ) : (
          <button
            onClick={handleStopPrompt}
            className="w-16 h-16 min-w-[3rem] min-h-[3rem] rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-95 transition"
            aria-label="Akhiri Rapat"
          >
            <Square className="w-6 h-6 text-white fill-white"/>
          </button>
        )}
      </footer>
    </div>
  );
}
```