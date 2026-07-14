const CACHE_NAME = 'synthmaster-v5-cache';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './presets.js',
  './audioAnalyzer.js',
  './wavEncoder.js',
  './audioEngine.js',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 웹 오디오 분석 및 다운로드 등의 Blob 생성과 크로스 도메인 CDN 리소스 에러 방지
  if (e.request.url.startsWith('chrome-extension') || e.request.method !== 'GET') {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        return networkResponse;
      });
    }).catch(() => {
      // 캐시나 네트워크에 없는 경우에 대한 대비책
    })
  );
});
