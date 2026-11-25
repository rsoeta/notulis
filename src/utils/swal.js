import Swal from 'sweetalert2';

/**
 * Instance SweetAlert2 ukuran kompak (320px) agar proporsional di smartphone
 * dengan target sentuh tombol >= 48px.
 */
export const SwalCompact = Swal.mixin({
  width: '320px',
  padding: '1rem',
  buttonsStyling: false,
  customClass: {
    popup: 'notulis-swal-popup bg-white text-slate-900 shadow-2xl border border-slate-200',
    title: 'text-[0.95rem] font-bold text-slate-900 leading-snug mb-1 px-1',
    htmlContainer: 'text-xs text-slate-600 leading-relaxed m-0 mt-1',
    actions: 'flex flex-col gap-2 w-full mt-4',
    confirmButton:
      'w-full min-h-[3rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-xs transition cursor-pointer',
    cancelButton:
      'w-full min-h-[3rem] px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer',
    denyButton:
      'w-full min-h-[3rem] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer',
  },
});

export const ToastCompact = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
  width: '300px',
  customClass: {
    popup: 'notulis-swal-toast bg-white text-slate-800 shadow-lg border border-slate-200',
    title: 'text-xs font-semibold text-slate-800',
  },
});

export function showToast(icon, title) {
  return ToastCompact.fire({ icon, title });
}

export function showErrorAlert(title, text) {
  return SwalCompact.fire({
    icon: 'error',
    title: title || 'Terjadi Kesalahan',
    text: text || 'Silakan coba beberapa saat lagi.',
    confirmButtonText: 'Tutup',
  });
}

export async function confirmDialog({
  title,
  html,
  text,
  icon = 'question',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  danger = false,
}) {
  const result = await SwalCompact.fire({
    icon,
    title,
    html,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: {
      popup: 'notulis-swal-popup bg-white text-slate-900 shadow-2xl border border-slate-200',
      title: 'text-[0.95rem] font-bold text-slate-900 leading-snug mb-1 px-1',
      htmlContainer: 'text-xs text-slate-600 leading-relaxed m-0 mt-1',
      actions: 'flex flex-col gap-2 w-full mt-4',
      confirmButton: danger
        ? 'w-full min-h-[3rem] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer'
        : 'w-full min-h-[3rem] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer',
      cancelButton:
        'w-full min-h-[3rem] px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer',
    },
  });
  return result.isConfirmed;
}

export function showLoadingModal(title, html) {
  return SwalCompact.fire({
    title: title || 'Memproses...',
    html: html || 'Mohon tunggu sebentar.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      SwalCompact.showLoading();
    },
  });
}

export function updateLoadingModal(title, html) {
  if (SwalCompact.isVisible()) {
    SwalCompact.update({ title, html });
  }
}

export function closeLoadingModal() {
  SwalCompact.close();
}
