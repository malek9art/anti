const CACHE = 'himaya-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './logo.png', './config.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // لا نخزّن أي استجابة من الـ API أو المصادقة إطلاقًا
  if (req.method !== 'GET' || /supabase\.co/.test(req.url)) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok && res.type === 'basic') caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
