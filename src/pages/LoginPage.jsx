import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, Mail, Mic, Sparkles, User } from 'lucide-react';
import { apiLogin, apiRegister, isDemoMode, saveSession } from '../services/api';
import { ButtonSpinner } from '../components/common/LoadingOverlay';
import AnimatedTitle from '../components/common/AnimatedTitle';
import TurnstileWidget from '../components/common/TurnstileWidget';
import { showErrorAlert, showToast } from '../utils/swal';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // login | register
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const turnstileRef = useRef(null);

  const demo = isDemoMode();

  const resetTurnstile = () => {
    setTurnstileToken('');
    turnstileRef.current?.reset();
  };

  const switchAuthMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetTurnstile();
  };

  const fillDemoUser = (role) => {
    switchAuthMode('login');
    if (role === 'ADMIN') {
      setEmail('admin@notulis.id');
      setPassword('Admin123!');
    } else {
      setEmail('sekretaris@smpn3sejahtera.sch.id');
      setPassword('Notulis123!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !turnstileToken) return;

    setIsSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await apiLogin(email, password, turnstileToken)
          : await apiRegister(fullName, email, password, turnstileToken);

      saveSession(res.data.token, res.data.user);
      showToast('success', `Selamat datang, ${res.data.user.fullName}`);
      onLoginSuccess(res.data.user);
    } catch (err) {
      resetTurnstile();
      showErrorAlert(mode === 'login' ? 'Gagal Masuk' : 'Gagal Mendaftar', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm mx-auto"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-600/25 mb-3"
          >
            <Mic className="w-6 h-6" />
          </motion.div>
          <AnimatedTitle
            as="h1"
            text="Notulis"
            className="text-xl font-extrabold text-slate-900 tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-1">
            Rekam rapat, transkrip AI & notulen `.docx` resmi dalam 2 menit
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          {/* Switcher with Sliding Pill */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => switchAuthMode('login')}
              className={`relative min-h-[2.5rem] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'login' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode === 'login' && (
                <motion.span
                  layoutId="authModePill"
                  transition={{ type: 'spring', stiffness: 440, damping: 32, mass: 0.8 }}
                  className="absolute inset-0 bg-white rounded-lg shadow-xs"
                />
              )}
              <span className="relative z-10">Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => switchAuthMode('register')}
              className={`relative min-h-[2.5rem] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'register' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode === 'register' && (
                <motion.span
                  layoutId="authModePill"
                  transition={{ type: 'spring', stiffness: 440, damping: 32, mass: 0.8 }}
                  className="absolute inset-0 bg-white rounded-lg shadow-xs"
                />
              )}
              <span className="relative z-10">Daftar Akun</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Siti Aminah, S.Pd."
                    className="w-full min-h-[2.875rem] pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@instansi.go.id"
                  className="w-full min-h-[2.875rem] pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full min-h-[2.875rem] pl-9 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Tampilkan sandi"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              theme="light"
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
            />

            <button
              type="submit"
              disabled={isSubmitting || !turnstileToken}
              className="w-full min-h-[3rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isSubmitting && <ButtonSpinner className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? 'Memproses...'
                  : !turnstileToken
                  ? 'Selesaikan Verifikasi Keamanan'
                  : mode === 'login'
                  ? 'Masuk ke Notulis'
                  : 'Buat Akun Baru'}
              </span>
            </button>
          </form>
        </div>

        {/* Mode Demo Helper */}
        {demo && (
          <div className="mt-4 bg-blue-50/90 border border-blue-200 rounded-2xl p-3.5 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-blue-800 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mode Demo Lokal Aktif</span>
            </div>
            <p className="text-[0.7rem] text-slate-600 leading-relaxed mb-2.5">
              <code>VITE_GAS_WEBAPP_URL</code> belum diisi, sehingga aplikasi berjalan dengan database lokal. Klik akun cepat di bawah:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemoUser('USER')}
                className="flex-1 min-h-[2.5rem] px-2.5 py-1.5 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-xl text-[0.7rem] font-semibold text-blue-700 transition cursor-pointer"
              >
                Akun Sekretaris
              </button>
              <button
                type="button"
                onClick={() => fillDemoUser('ADMIN')}
                className="flex-1 min-h-[2.5rem] px-2.5 py-1.5 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-xl text-[0.7rem] font-semibold text-slate-700 transition cursor-pointer"
              >
                Akun Admin
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
