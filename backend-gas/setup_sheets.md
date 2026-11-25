# Panduan Setup Database Google Sheets & Deploy Backend GAS (`Code.gs`)

Dokumen ini menjelaskan langkah-langkah menyiapkan database **Google Sheets**, folder **Google Drive**, **Gemini API Key**, dan deployment **Google Apps Script Web App** agar terhubung dengan frontend React Vite **Notulis**.

---

## 1. Struktur Database Google Sheets (5 Tab)

Fungsi `setupInitialSheets()` di dalam `Code.gs` akan membuat dan menata 5 tab berikut secara otomatis:

### 1) Tab `Users`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `user_id` | UUIDv4 (PK) | ID unik pengguna |
| B | `email` | String | Email login (unik) |
| C | `password_hash` | String | Hash `SHA-256` + salt (`salt$hash`) |
| D | `full_name` | String | Nama lengkap & gelar |
| E | `role` | String | `ADMIN` atau `USER` |
| F | `license_status` | String | `ACTIVE` atau `REVOKED` |
| G | `session_token` | String | Token sesi aktif |
| H | `created_at` | ISO DateTime | Waktu pendaftaran |

### 2) Tab `Instansi_Kop`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `kop_id` | UUIDv4 (PK) | ID unik kop surat |
| B | `user_id` | UUIDv4 (FK) | Pemilik kop surat (`Users.user_id`) |
| C | `header_line_1` | String | Baris 1 kop (misal: `PEMERINTAH KABUPATEN SEJAHTERA`) |
| D | `header_line_2` | String | Baris 2 kop (misal: `DINAS PENDIDIKAN`) |
| E | `institution_name` | String | Nama unit/instansi (misal: `SMP NEGERI 3 SEJAHTERA`) |
| F | `address` | String | Alamat lengkap instansi |
| G | `phone` | String | Nomor telepon/kontak instansi |
| H | `logo_drive_url` | String | URL logo instansi di Google Drive |

### 3) Tab `Meetings`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `meeting_id` | UUIDv4 (PK) | ID unik rapat |
| B | `user_id` | UUIDv4 (FK) | Pemilik rapat (divalidasi oleh RBAC di setiap endpoint) |
| C | `kop_id` | UUIDv4 (FK) | Relasi ke `Instansi_Kop.kop_id` |
| D | `title` | String | Judul rapat |
| E | `doc_type_title` | String | Jenis notulen (misal: `NOTULEN RAPAT DEWAN GURU`) |
| F | `doc_number` | String | Nomor surat resmi |
| G | `meeting_date` | String | Tanggal rapat (`YYYY-MM-DD`) |
| H | `time_range` | String | Rentang waktu (`13.00 – 15.15 WIB`) |
| I | `location` | String | Ruang/lokasi rapat |
| J | `duration_sec` | Number | Durasi rekaman dalam detik |
| K | `participant_count` | Number | Jumlah peserta |
| L | `audio_drive_id` | String | ID file audio di Google Drive |
| M | `docx_drive_id` | String | ID file hasil ekspor `.docx` di Drive |
| N | `transcript_text` | Long String | Teks transkrip (atau `DRIVE_FILE:<id>` jika > 40.000 karakter) |
| O | `summary_json` | JSON String | `{ "pembahasan": "...", "keputusan": [...] }` |
| P | `status` | String | `RECORDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| Q | `is_ai_generated` | Boolean | `TRUE` memicu badge `✦ Disusun AI` |
| R | `created_at` | ISO DateTime | Timestamp pembuatan |

### 4) Tab `Participants`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `participant_id` | UUIDv4 (PK) | ID unik peserta |
| B | `meeting_id` | UUIDv4 (FK) | Relasi ke `Meetings.meeting_id` |
| C | `user_id` | UUIDv4 (FK) | Pemilik record untuk verifikasi RBAC |
| D | `name` | String | Nama peserta & gelar |
| E | `position` | String | Jabatan / unit / mapel |
| F | `attendance_status` | String | `HADIR` / `IZIN` / `TIDAK HADIR` |

### 5) Tab `Action_Items`
| Kolom | Header | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| A | `action_id` | UUIDv4 (PK) | ID unik tindak lanjut |
| B | `meeting_id` | UUIDv4 (FK) | Relasi ke `Meetings.meeting_id` |
| C | `user_id` | UUIDv4 (FK) | Pemilik record untuk verifikasi RBAC |
| D | `order_no` | Number | Nomor urut (`1`, `2`, `3`, ...) |
| E | `description` | String | Uraian tindak lanjut |
| F | `pic_name` | String | Penanggung jawab |
| G | `deadline` | String | Batas waktu / tenggat |
| H | `status` | String | `PENDING` / `DONE` |

---

## 2. Langkah Menyiapkan Google Drive & Google Sheets

1. Buka [Google Drive](https://drive.google.com) dan buat folder baru bernama **`Notulis_Storage`**.
2. Buka folder tersebut, lalu salin **Folder ID** dari URL browser (`https://drive.google.com/drive/folders/<DRIVE_FOLDER_ID>`).
3. Buat **Google Spreadsheet** baru bernama **`Notulis_Database`**.
4. Salin **Spreadsheet ID** dari URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).
5. Dapatkan **Gemini API Key** dari [Google AI Studio](https://aistudio.google.com/apikey).

---

## 3. Memasang `Code.gs` & Menjalankan `setupInitialSheets()`

1. Di Google Spreadsheet `Notulis_Database`, klik menu **Extensions → Apps Script**.
2. Hapus kode bawaan di `Code.gs`, lalu salin seluruh isi file `backend-gas/Code.gs` ke editor Apps Script dan simpan (`Ctrl + S`).
3. Tambahkan file script baru di editor Apps Script (ikon `+` → **Script**), beri nama `turnstile`, lalu salin seluruh isi file `backend-gas/turnstile.gs` dan simpan.
4. Buka **Project Settings** (ikon gerigi di sidebar kiri) → gulir ke **Script Properties** → klik **Add script property** untuk properti berikut:
   - `SPREADSHEET_ID` : `<ID Spreadsheet Anda>`
   - `DRIVE_FOLDER_ID` : `<ID Folder Notulis_Storage Anda>`
   - `GEMINI_API_KEY` : `<API Key Google Gemini Anda>`
   - `API_KEY` : `<Token rahasia pilihan Anda, harus sama dengan VITE_API_KEY di .env>`
   - `TURNSTILE_SECRET_KEY` : *(Opsional)* Secret Key Cloudflare Turnstile produksi (default memakai dummy testing key)
5. Kembali ke tab **Editor**, pilih fungsi **`setupInitialSheets`** pada dropdown toolbar atas, lalu klik **Run**.
6. Berikan izin akses Google Sheets, Google Drive, Google Docs, dan layanan eksternal saat diminta.
7. Periksa Google Spreadsheet Anda: 5 tab beserta akun awal (`admin@notulis.id` / `Admin123!` dan `sekretaris@smpn3sejahtera.sch.id` / `Notulis123!`) otomatis terbuat.

---

## 4. Deploy sebagai Web App (Anti-CORS Preflight)

1. Di editor Apps Script, klik tombol **Deploy → New deployment**.
2. Pada ikon gerigi **Select type**, pilih **Web app**.
3. Isi konfigurasi:
   - **Description:** `Notulis API v1`
   - **Execute as:** `Me` (akun Google Anda)
   - **Who has access:** `Anyone` *(wajib agar request dari frontend React berjalan tanpa error CORS/OAuth browser)*
4. Klik **Deploy**, lalu salin **Web app URL** (`https://script.google.com/macros/s/.../exec`).

---

## 5. Hubungkan dengan Frontend React (`.env`)

1. Buka file `.env` pada folder root proyek frontend:
   ```env
   VITE_GAS_WEBAPP_URL=https://script.google.com/macros/s/DEPLOYMENT_ID_ANDA/exec
   VITE_API_KEY=token-rahasia-sama-dengan-script-properties
   ```
2. Jika `VITE_GAS_WEBAPP_URL` dibiarkan kosong, aplikasi otomatis berjalan dalam **Mode Demo Lokal** (menggunakan `localStorage` + IndexedDB) sehingga seluruh UI dan alur kerja tetap dapat diuji coba secara penuh sebelum deploy GAS.
3. Restart dev server (`npm run dev`) atau rebuild (`npm run build`) setelah mengubah `.env`.
   > **Catatan Produksi:** Untuk mengaktifkan perekaman mikrofon di HP Android/iOS, frontend wajib diakses melalui **HTTPS** (misalnya Vercel, Netlify, atau Cloudflare Pages) atau `localhost`.

---

## 6. Update & Deploy Cepat via Terminal (`clasp`)

Setiap kali `Code.gs` atau `turnstile.gs` diubah, Anda tidak perlu salin-tempel manual ke browser:

1. **Setup satu kali:**
   - Aktifkan **Google Apps Script API** di <https://script.google.com/home/usersettings>.
   - Login Google di terminal: `npm run gas:login`
   - Salin **Script ID** dari Editor Apps Script (**Project Settings → IDs → Script ID**), lalu jalankan:
     ```bash
     npm run gas:init -- <SCRIPT_ID_ANDA>
     ```
2. **Push & Deploy versi baru (menggunakan Deployment ID dari `.env`):**
   ```bash
   npm run gas:deploy -- "Update Code.gs"
   ```
   Perintah ini otomatis menjalankan `clasp push --force` lalu `clasp deploy -i <DEPLOYMENT_ID> -d "..."` (setara dengan *Manage deployments → Edit → New version → Deploy*).

