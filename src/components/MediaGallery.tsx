import { useEffect, useState } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';

export interface MediaItem {
  id: string;
  media_type: string;
  caption?: string | null;
  description?: string | null;
  created_at: string;
}

interface Props {
  items: MediaItem[];
  /** دالة إصدار رابط موقّع للتحميل (media-download-url أو evidence-download-url) */
  downloadFn: string;
  /** بناء حِزم دالة التحميل من معرّف الوسيط */
  downloadBody: (id: string) => Record<string, unknown>;
  onError?: (msg: string) => void;
}

/** عرض شبكة وسائط بالحصول على روابط موقّعة قصيرة العمر لكل عنصر */
export function MediaGallery({ items, downloadFn, downloadBody, onError }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => i.id).join(',');

  useEffect(() => {
    let alive = true;
    setUrls({});
    for (const it of items) {
      callFunction<{ url: string }>(downloadFn, downloadBody(it.id))
        .then((r) => { if (alive) setUrls((u) => ({ ...u, [it.id]: r.url })); })
        .catch((e) => { if (alive) onError?.(errorMessage(e)); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!items.length) return null;

  return (
    <div className="media-grid">
      {items.map((it) => (
        <figure key={it.id} className="media-item">
          {it.media_type === 'image' && urls[it.id] ? (
            <a href={urls[it.id]} target="_blank" rel="noreferrer" title="فتح الصورة">
              <img src={urls[it.id]} alt={it.caption ?? it.description ?? 'وسائط'} loading="lazy" />
            </a>
          ) : urls[it.id] ? (
            <a href={urls[it.id]} target="_blank" rel="noreferrer" className="media-item__file">
              <span>📄</span>
            </a>
          ) : (
            <div className="media-item__loading" aria-hidden="true">…</div>
          )}
          <figcaption>
            <span>{it.caption ?? it.description ?? (it.media_type === 'image' ? 'صورة' : 'ملف')}</span>
            <small>{formatDate(it.created_at)}</small>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
