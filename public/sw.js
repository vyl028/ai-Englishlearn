/* eslint-disable no-restricted-globals */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `lexicapture-static-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('lexicapture-static-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isCacheableStaticAsset(url) {
  const p = url.pathname;
  if (p.startsWith('/api/')) return false;
  if (p.startsWith('/_next/static/')) return true;
  if (p.startsWith('/fonts/')) return true;
  if (p === '/manifest.json') return true;
  if (p === '/icon-192x192.png' || p === '/icon-512x512.png') return true;
  return /\.(?:png|jpg|jpeg|webp|svg|css|js|woff2?|ttf)$/.test(p);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) {
    cache.put(request, resp.clone());
  }
  return resp;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok && request.method === 'GET') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isCacheableStaticAsset(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // For HTML navigation and everything else, prefer fresh content but fall back to cache/offline response.
  event.respondWith(networkFirst(req));
});

