import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const DUMMY_TEST_SITE_KEY = '1x00000000000000000000AA';

let turnstileScriptPromise = null;

function loadTurnstileScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window tidak tersedia.'));
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile));
      existing.addEventListener('error', () => {
        turnstileScriptPromise = null;
        reject(new Error('Gagal memuat skrip Cloudflare Turnstile.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileScriptPromise = null;
        reject(new Error('Cloudflare Turnstile gagal diinisialisasi.'));
      }
    };
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error('Gagal memuat Cloudflare Turnstile. Periksa koneksi internet Anda.'));
    };
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

/**
 * Widget Cloudflare Turnstile dengan render eksplisit & dukungan reset().
 * Otomatis memakai dummy testing site key di mode development jika env belum diisi.
 */
const TurnstileWidget = forwardRef(function TurnstileWidget(
  { theme = 'light', size = 'flexible', onVerify, onExpire, onError },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [reloadNonce, setReloadNonce] = useState(0);

  callbacksRef.current = { onVerify, onExpire, onError };

  const siteKey =
    (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim() || DUMMY_TEST_SITE_KEY;

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // Abaikan jika widget sedang dibersihkan
        }
      }
    },
  }));

  useEffect(() => {
    let active = true;
    setStatus('loading');

    loadTurnstileScript()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;

        if (widgetIdRef.current !== null) {
          try {
            turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          language: 'id',
          callback: (token) => {
            callbacksRef.current.onVerify?.(token);
          },
          'expired-callback': () => {
            callbacksRef.current.onExpire?.();
          },
          'error-callback': () => {
            callbacksRef.current.onError?.();
          },
        });

        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
        callbacksRef.current.onError?.();
      });

    return () => {
      active = false;
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size, reloadNonce]);

  return (
    <div className="space-y-1.5">
      {status === 'loading' && (
        <div className="min-h-[4.0625rem] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-blue-600 animate-pulse" />
          <span>Memuat verifikasi keamanan...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="min-h-[4.0625rem] w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-800">
          <span>Verifikasi anti-bot gagal dimuat.</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-semibold text-[0.7rem] hover:bg-amber-100/60 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Ulangi</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={status === 'ready' ? 'min-h-[4.0625rem] w-full overflow-hidden' : 'hidden'}
      />
    </div>
  );
});

export default TurnstileWidget;
