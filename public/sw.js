// Service Worker — إصلاح جذري للشاشة البيضاء (v3)
// استراتيجيات:
//   - التنقّل (index.html): network-first بلا كاشٍ للنسخة الرئيسية (لا تحفظ HTML قديمًا)
//   - config.js:           network أولًا دائمًا (الأصوال الحسّاسة تتحدث دون rebuild)
//   - /assets/*:           cache-first (الاسم مُبصم ويتغير كل بناء)
//   - الباقي:              network-first مع رجوع للكاش
// لا نخزّن طلبات من نطاق خارجي ولا من Supabase إطلاقًا.
const VERSION = 'v3';
const CACHE = `himaya-${VERSION}`;
// أصول ثابتة فقط — ممنوع index.html أو ./ أو config.js هنا حتى لا يُخزَّن HTML قديم
const PRECACHE = ['./logo.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // تجاهل أي طلب من نطاق مختلف (لا نعترض CDN/Supabase/غيرها)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // لا نخزّن استجابة من الـ API أو المصادقة إطلاقًا
  if (req.method !== 'GET') return;
  if (/supabase\.co/.test(req.url)) return;

  // التنقّل / المستند: network-first بلا كاشٍ — نحفظ فقط نسخة offline للعمل دون اتصال
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./offline.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./offline.html')),
    );
    return;
  }

  // config.js: الشبكة أولًا دائمًا (يتغيّر دون إعادة بناء) مع رجوع للكاش
  if (url.pathname.endsWith('/config.js')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // /assets/*: cache-first (الاسم مُبصم — آمن للتخزين طويلًا)
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
    return;
  }

  // الباقي (أيقونات، manifest، إلخ): network-first مع رجوع للكاش
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req)),
  );
});
