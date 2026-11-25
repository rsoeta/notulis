/**
 * Registrasi Service Worker PWA secara aman dan adaptif terhadap BASE_URL.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const rawBase = import.meta.env.BASE_URL || '/';
      const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      const scopeUrl = new URL(normalizedBase, window.location.origin);
      const swUrl = new URL('sw.js', scopeUrl);

      const registration = await navigator.serviceWorker.register(swUrl.href, {
        scope: scopeUrl.pathname,
      });

      registration.addEventListener('updatefound', () => {
        const nextWorker = registration.installing;
        if (!nextWorker) return;
        nextWorker.addEventListener('statechange', () => {
          if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
            nextWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[PWA] Registrasi Service Worker dilewati/gagal:', err);
      }
    }
  });
}
