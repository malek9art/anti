import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('عنصر #root غير موجود');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// يعلن أن واجهة React أكملت الإقلاع — حارس الإقلاع في index.html يعتمد عليه
window.__HIMAYA_BOOTED__ = true;
// الإقلاع نجح: أعد ضبط حارس التعافي التلقائي حتى يعمل عند أعطال مستقبلية (بلا حلقة)
try {
  sessionStorage.removeItem('himaya:auto-recover');
} catch {
  /* تجاهل */
}

if (import.meta.env.PROD) {
  registerServiceWorker();
}
