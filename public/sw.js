/**
 * Notulis Service Worker — Aman, Scope-Aware, & Anti-Cache untuk Data Sensitif
 */
const CACHE_VERSION = 'v1.0.1';
const STATIC_CACHE = `notulis-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `notulis-runtime-${CACHE_VERSION}`;
const NETWORK_TIMEOUT_MS = 5000;

const BASE_SCOPE = self.registration.scope;
const toScopedUrl = (relPath) => new URL(relPath, BASE_SCOPE).href;

const OFFLINE_URL = toScopedUrl('./offline.html');
const PRECACHE_URLS = [
  toScopedUrl('./'),
  OFFLINE_URL,
  toScopedUrl('./manifest.webmanifest'),
  toScopedUrl('./favicon.svg'),
  toScopedUrl('./icons/icon-192x192.png'),
  toScopedUrl('./icons/icon-512x512.png'),
  toScopedUrl('./icons/icon-maskable-192x192.png'),
  toScopedUrl('./icons/icon-maskable-512x512.png'),
  toScopedUrl('./icons/apple-touch-icon.png'),
];

const SENSITIVE_PATH_PATTERN = /(\/login|\/logout|\/auth|\/oauth|\/api\/|\/admin|\/dashboard)/i;
const SENSITIVE_QUERY_KEYS = ['token', 'apikey', 'api_key', 'action', 'auth', 'code', 'state'];
const VITE_DEV_INTERNAL_PATTERN = /^\/(@vite|@fs|@id|@react-refresh|node_modules|src)\b/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' }))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const validCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !validCaches.has(key))
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function hasSensitiveParamsOrHeaders(request, url) {
  if (SENSITIVE_PATH_PATTERN.test(url.pathname)) return true;

  for (const key of SENSITIVE_QUERY_KEYS) {
    if (url.searchParams.has(key)) return true;
  }

  if (
    request.headers.has('Authorization') ||
    request.headers.has('X-CSRF-Token') ||
    request.headers.has('X-XSRF-TOKEN')
  ) {
    return true;
  }

  return false;
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== 'basic') return false;

  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
    return false;
  }

  if (response.headers.has('Set-Cookie')) {
    return false;
  }

  return true;
}

function isStaticAssetRequest(request, url) {
  const dest = request.destination;
  if (dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font' || dest === 'manifest') {
    return true;
  }
  return /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|webmanifest)$/i.test(url.pathname);
}

async function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

async function networkFirstNavigation(request) {
  try {
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (isCacheableResponse(networkResponse)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cachedPage =
      (await caches.match(request)) ||
      (await caches.match(toScopedUrl('./'))) ||
      (await caches.match(OFFLINE_URL));
    return (
      cachedPage ||
      new Response('Perangkat sedang offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
  if (isCacheableResponse(networkResponse)) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone()).catch(() => {});
  }
  return networkResponse;
}

async function networkFirstSafeGet(request) {
  try {
    const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (isCacheableResponse(networkResponse)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Jaringan tidak tersedia.');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Jangan pernah cache/intersep non-GET (POST, PUT, PATCH, DELETE, dll.)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 2. Hanya tangani HTTP/HTTPS same-origin (lewati GAS cross-origin, Gemini, Drive, ekstensi)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  // 3. Lewati endpoint internal Vite dev server agar HMR tetap berjalan mulus
  if (VITE_DEV_INTERNAL_PATTERN.test(url.pathname)) return;

  // 4. Keamanan: Jangan pernah cache endpoint sensitif, auth, atau request bertoken
  if (hasSensitiveParamsOrHeaders(request, url)) return;

  // 5. Navigasi halaman -> Network First (timeout 5s) + fallback cache / offline.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 6. Aset statis -> Cache First dengan cache versioning
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // 7. Permintaan GET same-origin aman lainnya -> Network First
  event.respondWith(networkFirstSafeGet(request));
});
