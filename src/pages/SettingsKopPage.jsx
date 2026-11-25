import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  User,
  UserPlus,
} from 'lucide-react';
import {
  apiDeleteKop,
  apiGetKopList,
  apiGetUsers,
  apiManageUser,
  apiSaveGeminiApiKey,
  apiSaveKop,
  apiTestGeminiApiKey,
  isDemoMode,
} from '../services/api';
import { ButtonSpinner } from '../components/common/LoadingOverlay';
import AnimatedTitle from '../components/common/AnimatedTitle';
import KopLogo from '../components/common/KopLogo';
import { confirmDialog, showErrorAlert, showToast } from '../utils/swal';
import {
  CUSTOM_FONT_ID,
  CUSTOM_FONT_SUGGESTIONS,
  FONT_FAMILIES,
  FONT_SIZE_PRESETS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  clampFontSize,
  getActiveFontMeta,
  loadGoogleFontStylesheet,
  loadTypographyPrefs,
  resetTypographyPrefs,
  sanitizeGoogleFontName,
  saveTypographyPrefs,
} from '../utils/typography';

const PILL_SPRING = { type: 'spring', stiffness: 440, damping: 32, mass: 0.8 };

const EMPTY_KOP = {
  kop_id: '',
  header_line_1: '',
  header_line_2: '',
  institution_name: '',
  address: '',
  phone: '',
  logo_drive_url: '',
  logoBase64: '',
  logoMimeType: '',
  clearLogo: false,
};

export default function SettingsKopPage({
  user,
  initialSubTab = 'kop',
  kopList = [],
  onKopListChange,
  onUserUpdate,
  onSubTabChange,
  onLogout,
}) {
  const [subTab, setSubTab] = useState(initialSubTab);
  const [kopForm, setKopForm] = useState(() => kopList[0] || EMPTY_KOP);
  const [isSavingKop, setIsSavingKop] = useState(false);
  const [isDeletingKop, setIsDeletingKop] = useState(false);
  const hasUnsavedKopEditsRef = useRef(false);

  // Per-user Gemini API Key
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isSavingGeminiKey, setIsSavingGeminiKey] = useState(false);
  const [isTestingGeminiKey, setIsTestingGeminiKey] = useState(false);

  // Typography preferences
  const [typography, setTypography] = useState(() => loadTypographyPrefs());
  const [customFontInput, setCustomFontInput] = useState(
    () => loadTypographyPrefs().customFontName || ''
  );
  const [isLoadingCustomFont, setIsLoadingCustomFont] = useState(false);

  // Admin Users
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'USER',
  });

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (hasUnsavedKopEditsRef.current || kopList.length === 0) return;
    setKopForm((prev) => {
      const matched = prev.kop_id
        ? kopList.find((k) => k.kop_id === prev.kop_id)
        : kopList[0];
      if (!matched) return prev;
      return {
        ...EMPTY_KOP,
        ...matched,
        logoBase64: '',
        logoMimeType: '',
        clearLogo: false,
      };
    });
  }, [kopList]);

  useEffect(() => {
    if (subTab !== 'kop') return;
    let cancelled = false;

    apiGetKopList()
      .then((res) => {
        if (cancelled || !Array.isArray(res?.data)) return;
        const freshList = res.data;
        onKopListChange(freshList);
        if (!hasUnsavedKopEditsRef.current && freshList.length > 0) {
          setKopForm((prev) => {
            const matched = prev.kop_id
              ? freshList.find((k) => k.kop_id === prev.kop_id)
              : freshList[0];
            if (!matched) return prev;
            return {
              ...EMPTY_KOP,
              ...matched,
              logoBase64: '',
              logoMimeType: '',
              clearLogo: false,
            };
          });
        }
      })
      .catch(() => {
        // Tetap gunakan daftar kop dari App bila gagal menyegarkan
      });

    return () => {
      cancelled = true;
    };
  }, [subTab]);

  const loadAdminUsers = async () => {
    if (user?.role !== 'ADMIN') return;
    setIsLoadingUsers(true);
    try {
      const res = await apiGetUsers();
      setUsersList(res.data || []);
    } catch (err) {
      showErrorAlert('Gagal Memuat Pengguna', err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (subTab === 'admin' && user?.role === 'ADMIN') {
      loadAdminUsers();
    }
  }, [subTab, user?.role]);

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const renderAt = (maxSide, mimeType, quality) => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (mimeType === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return quality !== undefined
            ? canvas.toDataURL(mimeType, quality)
            : canvas.toDataURL(mimeType);
        };

        let chosenMime = 'image/png';
        let dataUrl = '';
        for (const side of [160, 128, 96]) {
          dataUrl = renderAt(side, 'image/png');
          if (dataUrl.length <= 38000) break;
        }
        if (dataUrl.length > 38000) {
          chosenMime = 'image/jpeg';
          dataUrl = renderAt(128, 'image/jpeg', 0.85);
        }

        const base64 = dataUrl.split(',')[1] || '';
        hasUnsavedKopEditsRef.current = true;
        setKopForm((prev) => ({
          ...prev,
          logo_drive_url: dataUrl,
          logoBase64: base64,
          logoMimeType: chosenMime,
          clearLogo: false,
        }));
      };
      img.onerror = () => {
        showToast('error', 'File gambar tidak dapat dibaca. Gunakan PNG/JPG.');
      };
      img.src = String(reader.result);
    };
    reader.onerror = () => {
      showToast('error', 'File gambar tidak dapat dibaca. Gunakan PNG/JPG.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearLogo = () => {
    hasUnsavedKopEditsRef.current = true;
    setKopForm((prev) => ({
      ...prev,
      logo_drive_url: '',
      logoBase64: '',
      logoMimeType: '',
      clearLogo: true,
    }));
  };

  const handleSaveKop = async (e) => {
    e.preventDefault();
    if (isSavingKop) return;
    if (!kopForm.institution_name.trim()) {
      showToast('warning', 'Nama unit/instansi wajib diisi.');
      return;
    }

    setIsSavingKop(true);
    try {
      const res = await apiSaveKop(kopForm);
      const saved = res.data;
      const exists = kopList.some((k) => k.kop_id === saved.kop_id);
      const nextList = exists
        ? kopList.map((k) => (k.kop_id === saved.kop_id ? saved : k))
        : [...kopList, saved];
      onKopListChange(nextList);
      hasUnsavedKopEditsRef.current = false;
      setKopForm({
        ...EMPTY_KOP,
        ...saved,
        logoBase64: '',
        logoMimeType: '',
        clearLogo: false,
      });
      showToast('success', 'Kop instansi berhasil disimpan!');
    } catch (err) {
      showErrorAlert('Gagal Menyimpan Kop', err.message);
    } finally {
      setIsSavingKop(false);
    }
  };

  const handleDeleteKop = async () => {
    if (!kopForm.kop_id || isDeletingKop) return;
    const confirmed = await confirmDialog({
      icon: 'warning',
      title: 'Hapus Kop Instansi?',
      text: `Kop "${kopForm.institution_name}" akan dihapus permanen.`,
      confirmText: 'Ya, Hapus',
      danger: true,
    });
    if (!confirmed) return;

    setIsDeletingKop(true);
    try {
      await apiDeleteKop(kopForm.kop_id);
      const nextList = kopList.filter((k) => k.kop_id !== kopForm.kop_id);
      onKopListChange(nextList);
      setKopForm(nextList[0] ? { ...EMPTY_KOP, ...nextList[0] } : EMPTY_KOP);
      showToast('success', 'Kop instansi dihapus.');
    } catch (err) {
      showErrorAlert('Gagal Menghapus Kop', err.message);
    } finally {
      setIsDeletingKop(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (isCreatingUser) return;
    setIsCreatingUser(true);
    try {
      await apiManageUser({ operation: 'create', ...newUserForm });
      setNewUserForm({ fullName: '', email: '', password: '', role: 'USER' });
      showToast('success', 'Pengguna baru berhasil ditambahkan.');
      await loadAdminUsers();
    } catch (err) {
      showErrorAlert('Gagal Menambah Pengguna', err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleLicense = async (targetUser) => {
    const nextStatus = targetUser.licenseStatus === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
    const confirmed = await confirmDialog({
      icon: 'warning',
      title: nextStatus === 'REVOKED' ? 'Nonaktifkan Lisensi?' : 'Aktifkan Kembali?',
      text: `Status akun ${targetUser.fullName} akan diubah menjadi ${nextStatus}.`,
      confirmText: 'Ya, Ubah',
      danger: nextStatus === 'REVOKED',
    });
    if (!confirmed) return;

    try {
      await apiManageUser({
        operation: 'updateStatus',
        targetUserId: targetUser.userId,
        licenseStatus: nextStatus,
      });
      showToast('success', `Lisensi diubah ke ${nextStatus}.`);
      await loadAdminUsers();
    } catch (err) {
      showErrorAlert('Gagal Mengubah Lisensi', err.message);
    }
  };

  const selectSubTab = (nextTab) => {
    setSubTab(nextTab);
    if (onSubTabChange) onSubTabChange(nextTab);
  };

  const handleSaveGeminiKey = async (e) => {
    e.preventDefault();
    if (isSavingGeminiKey) return;
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      showToast('warning', 'Masukkan GEMINI_API_KEY Anda terlebih dahulu.');
      return;
    }

    setIsSavingGeminiKey(true);
    try {
      const res = await apiSaveGeminiApiKey(trimmed);
      setGeminiKeyInput('');
      if (onUserUpdate && user) {
        onUserUpdate({
          ...user,
          hasCustomGeminiKey: res.data.hasCustomGeminiKey,
          geminiKeyMasked: res.data.geminiKeyMasked,
        });
      }
      showToast('success', 'GEMINI_API_KEY pribadi berhasil disimpan!');
    } catch (err) {
      showErrorAlert('Gagal Menyimpan API Key', err.message);
    } finally {
      setIsSavingGeminiKey(false);
    }
  };

  const handleTestGeminiKey = async () => {
    if (isTestingGeminiKey) return;
    setIsTestingGeminiKey(true);
    try {
      const res = await apiTestGeminiApiKey(geminiKeyInput.trim());
      showToast('success', res.message || 'Koneksi Gemini berhasil!');
    } catch (err) {
      showErrorAlert('Tes Koneksi Gemini Gagal', err.message);
    } finally {
      setIsTestingGeminiKey(false);
    }
  };

  const handleClearGeminiKey = async () => {
    if (isSavingGeminiKey) return;
    const confirmed = await confirmDialog({
      icon: 'warning',
      title: 'Hapus API Key Pribadi?',
      text: 'Akun Anda akan kembali memakai GEMINI_API_KEY default server (jika tersedia).',
      confirmText: 'Ya, Hapus',
      danger: true,
    });
    if (!confirmed) return;

    setIsSavingGeminiKey(true);
    try {
      const res = await apiSaveGeminiApiKey('');
      setGeminiKeyInput('');
      if (onUserUpdate && user) {
        onUserUpdate({
          ...user,
          hasCustomGeminiKey: res.data.hasCustomGeminiKey,
          geminiKeyMasked: res.data.geminiKeyMasked,
        });
      }
      showToast('info', 'API Key pribadi dihapus.');
    } catch (err) {
      showErrorAlert('Gagal Menghapus API Key', err.message);
    } finally {
      setIsSavingGeminiKey(false);
    }
  };

  const handleFontFamilyChange = (fontId) => {
    const updated = saveTypographyPrefs({ ...typography, fontId });
    setTypography(updated);
  };

  const handleApplyCustomGoogleFont = async (rawName) => {
    const cleanName = sanitizeGoogleFontName(rawName !== undefined ? rawName : customFontInput);
    if (!cleanName) {
      showToast('warning', 'Ketik nama font dari Google Fonts terlebih dahulu.');
      return;
    }

    setIsLoadingCustomFont(true);
    try {
      await loadGoogleFontStylesheet(cleanName);
      setCustomFontInput(cleanName);
      const updated = saveTypographyPrefs({
        ...typography,
        fontId: CUSTOM_FONT_ID,
        customFontName: cleanName,
      });
      setTypography(updated);
      showToast('success', `Font "${cleanName}" diterapkan!`);
    } catch (err) {
      showErrorAlert('Font Tidak Ditemukan', err.message);
    } finally {
      setIsLoadingCustomFont(false);
    }
  };

  const handleFontSizeChange = (nextSize) => {
    const updated = saveTypographyPrefs({
      ...typography,
      fontSize: clampFontSize(nextSize),
    });
    setTypography(updated);
  };

  const handleResetTypography = () => {
    const reset = resetTypographyPrefs();
    setTypography(reset);
    setCustomFontInput('');
    showToast('info', 'Pengaturan font dikembalikan ke default.');
  };

  const activeFontOpt = getActiveFontMeta(typography);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-28 lg:pb-12 space-y-4">
      <div>
        <AnimatedTitle
          as="h1"
          text="Pengaturan & Kop Surat"
          className="text-lg sm:text-xl font-extrabold text-slate-900"
        />
        <p className="text-xs text-slate-500">
          Atur identitas kop surat resmi instansi untuk hasil ekspor `.docx` & cetak PDF
        </p>
      </div>

      {/* Sub Tabs with Sliding Active Pill */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1 flex gap-1">
        <button
          type="button"
          onClick={() => selectSubTab('kop')}
          className={`relative flex-1 min-h-[2.75rem] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${subTab === 'kop' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          {subTab === 'kop' && (
            <motion.span
              layoutId="settingsSubTabPill"
              transition={PILL_SPRING}
              className="absolute inset-0 bg-blue-600 rounded-xl shadow-xs"
            />
          )}
          <Building2 className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Kop Instansi</span>
        </button>

        <button
          type="button"
          onClick={() => selectSubTab('profile')}
          className={`relative flex-1 min-h-[2.75rem] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${subTab === 'profile' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          {subTab === 'profile' && (
            <motion.span
              layoutId="settingsSubTabPill"
              transition={PILL_SPRING}
              className="absolute inset-0 bg-blue-600 rounded-xl shadow-xs"
            />
          )}
          <User className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Akun & Server</span>
        </button>

        {user?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => selectSubTab('admin')}
            className={`relative flex-1 min-h-[2.75rem] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${subTab === 'admin' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            {subTab === 'admin' && (
              <motion.span
                layoutId="settingsSubTabPill"
                transition={PILL_SPRING}
                className="absolute inset-0 bg-blue-600 rounded-xl shadow-xs"
              />
            )}
            <ShieldCheck className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Admin User</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* SUBTAB 1: KOP INSTANSI */}
        {subTab === 'kop' && (
          <motion.div
            key="kop"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* Selector Kop */}
            <div className="flex flex-wrap items-center gap-2">
              {kopList.map((k) => (
                <button
                  key={k.kop_id}
                  type="button"
                  onClick={() => {
                    hasUnsavedKopEditsRef.current = false;
                    setKopForm({ ...EMPTY_KOP, ...k });
                  }}
                  className={`min-h-[2.5rem] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${kopForm.kop_id === k.kop_id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {k.institution_name}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  hasUnsavedKopEditsRef.current = true;
                  setKopForm(EMPTY_KOP);
                }}
                className="min-h-[2.5rem] px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kop Baru</span>
              </button>
            </div>

            {/* Live Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Pratinjau Kop Surat Resmi
              </p>
              <div className="font-serif-doc pb-3 border-b-[3px] border-double border-slate-900 flex items-center gap-3">
                <KopLogo
                  src={kopForm.logo_drive_url}
                  alt="Logo Instansi"
                  className="w-14 h-14 object-contain shrink-0"
                  showErrorFallback
                />
                <div className="flex-1 text-center leading-tight">
                  <p className="text-xs font-bold uppercase">
                    {kopForm.header_line_1 || 'PEMERINTAH KABUPATEN SEJAHTERA'}
                  </p>
                  <p className="text-xs font-bold uppercase">
                    {kopForm.header_line_2 || 'DINAS PENDIDIKAN'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold uppercase mt-0.5">
                    {kopForm.institution_name || 'NAMA UNIT KERJA / SEKOLAH'}
                  </p>
                  <p className="text-[0.7rem] text-slate-700 mt-0.5">
                    {[kopForm.address || 'Jl. Alamat Instansi', kopForm.phone]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Form Editor */}
            <form
              onSubmit={handleSaveKop}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Baris 1 (Instansi Induk)
                  </label>
                  <input
                    type="text"
                    value={kopForm.header_line_1}
                    onChange={(e) => {
                      hasUnsavedKopEditsRef.current = true;
                      setKopForm({ ...kopForm, header_line_1: e.target.value });
                    }}
                    placeholder="PEMERINTAH KABUPATEN SEJAHTERA"
                    className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Baris 2 (Sub-Instansi / Dinas)
                  </label>
                  <input
                    type="text"
                    value={kopForm.header_line_2}
                    onChange={(e) => {
                      hasUnsavedKopEditsRef.current = true;
                      setKopForm({ ...kopForm, header_line_2: e.target.value });
                    }}
                    placeholder="DINAS PENDIDIKAN"
                    className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Unit / Lembaga <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={kopForm.institution_name}
                    onChange={(e) => {
                      hasUnsavedKopEditsRef.current = true;
                      setKopForm({ ...kopForm, institution_name: e.target.value });
                    }}
                    placeholder="SMP NEGERI 3 SEJAHTERA"
                    className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat</label>
                  <input
                    type="text"
                    value={kopForm.address}
                    onChange={(e) => {
                      hasUnsavedKopEditsRef.current = true;
                      setKopForm({ ...kopForm, address: e.target.value });
                    }}
                    placeholder="Jl. Pelajar No. 3, Kota Sejahtera"
                    className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Telepon</label>
                  <input
                    type="text"
                    value={kopForm.phone}
                    onChange={(e) => {
                      hasUnsavedKopEditsRef.current = true;
                      setKopForm({ ...kopForm, phone: e.target.value });
                    }}
                    placeholder="Telp. (0000) 551 203"
                    className="w-full min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Logo Instansi (Opsional · tampil di preview, PDF &amp; .docx)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 min-h-[2.75rem] px-3.5 py-2 bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer">
                      <ImageIcon className="w-4 h-4" />
                      <span>{kopForm.logo_drive_url ? 'Ganti Gambar Logo' : 'Pilih Gambar Logo (PNG/JPG)'}</span>
                      <input type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
                    </label>

                    {kopForm.logo_drive_url && (
                      <>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          Logo siap
                        </span>
                        <button
                          type="button"
                          onClick={handleClearLogo}
                          className="min-h-[2.75rem] px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition cursor-pointer"
                        >
                          Hapus Logo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSavingKop}
                  className="flex-1 sm:flex-initial min-h-[3rem] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingKop ? <ButtonSpinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{isSavingKop ? 'Menyimpan...' : 'Simpan Kop Instansi'}</span>
                </button>

                {kopForm.kop_id && (
                  <button
                    type="button"
                    disabled={isDeletingKop}
                    onClick={handleDeleteKop}
                    className="min-h-[3rem] px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        )}

        {/* SUBTAB 2: PROFILE & SERVER */}
        {subTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                {user?.fullName?.slice(0, 1) || 'U'}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{user?.fullName}</h2>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[0.65rem] font-bold">
                    {user?.role}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.65rem] font-bold">
                    {user?.licenseStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
              <p className="font-bold text-slate-800">Status Koneksi Backend</p>
              <p className="text-slate-600">
                {isDemoMode()
                  ? 'Mode Demo Lokal aktif (VITE_GAS_WEBAPP_URL belum dikonfigurasi di .env).'
                  : 'Terhubung langsung ke Google Apps Script Web App & Google Sheets.'}
              </p>
            </div>

            {/* GEMINI_API_KEY Pribadi (Self-Service per Akun) */}
            <form
              onSubmit={handleSaveGeminiKey}
              className="border-t border-slate-200 pt-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Kunci API Google Gemini (Pribadi)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Gunakan kuota API Key Gemini Anda sendiri agar bebas antrean pengguna lain
                    </p>
                  </div>
                </div>

                {user?.hasCustomGeminiKey ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    Aktif: {user.geminiKeyMasked || 'Tersimpan'}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                    Default Server
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="gemini-key-input" className="text-xs font-semibold text-slate-700">
                    GEMINI_API_KEY
                  </label>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <span>Buat key di Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="gemini-key-input"
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={
                      user?.hasCustomGeminiKey
                        ? `Tersimpan (${user.geminiKeyMasked}) — masukkan key baru untuk mengganti`
                        : 'Tempel GEMINI_API_KEY (awalan AQ. atau AIza...)'
                    }
                    className="w-full min-h-[2.875rem] pl-3 pr-11 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    aria-label="Tampilkan atau sembunyikan API Key"
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSavingGeminiKey || !geminiKeyInput.trim()}
                  className="flex-1 sm:flex-initial min-h-[2.75rem] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {isSavingGeminiKey ? <ButtonSpinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Simpan Key</span>
                </button>

                <button
                  type="button"
                  disabled={isTestingGeminiKey}
                  onClick={handleTestGeminiKey}
                  className="flex-1 sm:flex-initial min-h-[2.75rem] px-4 py-2 bg-slate-100 hover:bg-slate-200/80 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {isTestingGeminiKey ? <ButtonSpinner className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{isTestingGeminiKey ? 'Menguji...' : 'Uji Koneksi'}</span>
                </button>

                {user?.hasCustomGeminiKey && (
                  <button
                    type="button"
                    disabled={isSavingGeminiKey}
                    onClick={handleClearGeminiKey}
                    className="min-h-[2.75rem] px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Key</span>
                  </button>
                )}
              </div>
            </form>

            {/* Tampilan & Tipografi (Jenis, Custom Google Font, & Ukuran Font >= 12px) */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Tampilan &amp; Tipografi</h3>
                    <p className="text-xs text-slate-500">
                      Pilih preset atau ketik nama font Google Fonts (minimal {MIN_FONT_SIZE}px)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetTypography}
                  className="inline-flex items-center gap-1.5 min-h-[2.375rem] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Pilihan Jenis Font Preset */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Preset Font</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {FONT_FAMILIES.map((font) => {
                    const isSelected = typography.fontId === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => handleFontFamilyChange(font.id)}
                        style={{ fontFamily: font.stack }}
                        className={`text-left min-h-[3.25rem] px-3 py-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 text-blue-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs font-bold leading-snug">{font.label}</p>
                        <p className="text-xs text-slate-500 leading-snug">{font.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Google Font Input */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="custom-gfont-input" className="text-xs font-bold text-slate-800">
                    Custom Google Font
                  </label>
                  <a
                    href="https://fonts.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <span>Jelajahi Google Fonts</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    id="custom-gfont-input"
                    type="text"
                    value={customFontInput}
                    onChange={(e) => setCustomFontInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCustomGoogleFont();
                      }
                    }}
                    placeholder="Contoh: Outfit, DM Sans, Playfair Display"
                    className="flex-1 min-w-[11rem] min-h-[2.75rem] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={isLoadingCustomFont || !customFontInput.trim()}
                    onClick={() => handleApplyCustomGoogleFont()}
                    className="min-h-[2.75rem] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    {isLoadingCustomFont ? (
                      <ButtonSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoadingCustomFont ? 'Memuat...' : 'Terapkan'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500 mr-1">Saran cepat:</span>
                  {CUSTOM_FONT_SUGGESTIONS.map((name) => {
                    const isActiveCustom =
                      typography.fontId === CUSTOM_FONT_ID &&
                      typography.customFontName.toLowerCase() === name.toLowerCase();
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={isLoadingCustomFont}
                        onClick={() => handleApplyCustomGoogleFont(name)}
                        className={`min-h-[2rem] px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isActiveCustom
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pengaturan Ukuran Font (12px - 20px) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="font-size-slider" className="text-xs font-semibold text-slate-700">
                    Ukuran Font Dasar
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold tabular-nums">
                    {typography.fontSize}px
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={typography.fontSize <= MIN_FONT_SIZE}
                    onClick={() => handleFontSizeChange(typography.fontSize - 1)}
                    aria-label="Perkecil ukuran font"
                    className="min-w-[2.75rem] min-h-[2.75rem] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    id="font-size-slider"
                    type="range"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    step={1}
                    value={typography.fontSize}
                    onChange={(e) => handleFontSizeChange(e.target.value)}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />

                  <button
                    type="button"
                    disabled={typography.fontSize >= MAX_FONT_SIZE}
                    onClick={() => handleFontSizeChange(typography.fontSize + 1)}
                    aria-label="Perbesar ukuran font"
                    className="min-w-[2.75rem] min-h-[2.75rem] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Preset Ukuran Cepat */}
                <div className="flex flex-wrap gap-1.5">
                  {FONT_SIZE_PRESETS.map((size) => {
                    const active = typography.fontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleFontSizeChange(size)}
                        className={`min-h-[2.25rem] px-3 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer tabular-nums ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {size}px{size === MIN_FONT_SIZE ? ' (Min)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pratinjau Langsung */}
              <div
                style={{ fontFamily: activeFontOpt.stack }}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pratinjau Teks ({activeFontOpt.label} · {typography.fontSize}px)
                </p>
                <p
                  style={{ fontSize: `${typography.fontSize}px` }}
                  className="font-semibold text-slate-900 leading-snug"
                >
                  Notulen Rapat Dewan Guru Persiapan Semester
                </p>
                <p
                  style={{ fontSize: `${Math.max(MIN_FONT_SIZE, typography.fontSize - 2)}px` }}
                  className="text-slate-600 leading-relaxed"
                >
                  Perubahan jenis dan ukuran huruf langsung diterapkan ke seluruh antarmuka aplikasi.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto min-h-[3rem] px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          </motion.div>
        )}

        {/* SUBTAB 3: ADMIN USER MANAGEMENT */}
        {subTab === 'admin' && user?.role === 'ADMIN' && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-4"
          >
            <form
              onSubmit={handleCreateUser}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
            >
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Tambah Pengguna Lisensi Baru</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Nama lengkap & gelar"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="min-h-[2.75rem] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="min-h-[2.75rem] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  required
                />
                <input
                  type="password"
                  placeholder="Kata sandi (min. 6 karakter)"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="min-h-[2.75rem] px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  required
                />
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="min-h-[2.75rem] px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="USER">USER (Sekretaris / Notulis)</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="min-h-[2.875rem] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                {isCreatingUser && <ButtonSpinner className="w-4 h-4" />}
                <span>Tambah Pengguna</span>
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Daftar Pengguna Terdaftar</h3>
              {isLoadingUsers ? (
                <div className="py-4 flex items-center gap-2 text-xs text-slate-500">
                  <ButtonSpinner className="w-4 h-4 text-blue-600" />
                  <span>Memuat daftar pengguna...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {usersList.map((u) => (
                    <div
                      key={u.userId}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 border border-slate-200 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{u.fullName}</p>
                        <p className="text-[0.7rem] text-slate-500 truncate">
                          {u.email} · {u.role}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={u.userId === user.userId}
                        onClick={() => handleToggleLicense(u)}
                        className={`min-h-[2.25rem] px-3 py-1 rounded-xl text-[0.7rem] font-semibold transition cursor-pointer disabled:opacity-40 ${u.licenseStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                          }`}
                      >
                        {u.licenseStatus}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
