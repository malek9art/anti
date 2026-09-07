// أدوات PWA — تسجيل Service Worker محصّن ضد الكاش القديم (الشاشة البيضاء)
// الخطوات: استدعاء update دوري، إرسال SKIP_WAITING عند التحديث، وإعادة تحميل واحدة عند controllerchange.

let reloadedOnce = false;

/** إلغاء تسجيل كل Service Workers ومسح كل الكاشات — التعافي الجذري من الكاش القديم */
export async function purgeServiceWorkers(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* تجاهل */
    }
  }
  if (typeof caches !== 'undefined' && caches) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* تجاهل */
    }
  }
}

/** مسح الكاش ثم إعادة تحميل الصفحة بمعامل جديد لتفادي أي توجيه مخزّن قديم */
export async function recoverFromStaleCache(): Promise<void> {
  await purgeServiceWorkers();
  window.location.replace(`${window.location.pathname}?fresh=${Date.now()}`);
}

/**
 * تسجيل Service Worker محصّن:
 *  - يُستدعى update عند التحميل وكل ساعة
 *  - يرسل SKIP_WAITING عند العثور على نسخة جديدة مثبّتة
 *  - يُعيد التحميل مرة واحدة عند controllerchange
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // تحديث فوري عند التحميل ثم كل ساعة
        void reg.update().catch(() => undefined);
        window.setInterval(() => {
          void reg.update().catch(() => undefined);
        }, 60 * 60 * 1000);

        // عند العثور على نسخة جديدة → اطلب منها تخطّي الانتظار (SKIP_WAITING)
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });

        // إعادة التحميل مرة واحدة عند سيطرة نسخة جديدة (لضمان استخدام الأصول الحديثة)
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloadedOnce) return;
            reloadedOnce = true;
            window.location.reload();
          });
        }
      })
      .catch(() => undefined);
  });
}
