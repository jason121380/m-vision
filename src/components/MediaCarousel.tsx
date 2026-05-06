import { useEffect, useRef, useState } from 'react';
import type { MediaRow } from '../types';

const IMAGE_DURATION_MS = 5000;
const IFRAME_VIDEO_DURATION_MS = 25000;

type Props = { items: MediaRow[] };

const isIframeUrl = (url: string) =>
  url.includes('/preview') ||
  url.includes('youtube.com/embed') ||
  url.includes('youtube-nocookie.com/embed');

export function MediaCarousel({ items }: Props) {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const cur = items[idx];
    if (cur.type === 'image') {
      const t = window.setTimeout(() => setIdx((i) => (i + 1) % items.length), IMAGE_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    if (cur.type === 'video' && isIframeUrl(cur.url)) {
      // YouTube / Drive iframe 拿不到 onEnded，用固定計時器推進
      const t = window.setTimeout(() => setIdx((i) => (i + 1) % items.length), IFRAME_VIDEO_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    return;
  }, [idx, items]);

  if (items.length === 0) return null;
  const cur = items[idx];
  const advance = () => setIdx((i) => (i + 1) % items.length);

  const isIframeVideo = cur.type === 'video' && isIframeUrl(cur.url);

  return (
    <div className="carousel">
      {cur.type === 'image' ? (
        <img
          key={cur.url}
          src={cur.url}
          alt={cur.alt}
          referrerPolicy="no-referrer"
          onError={advance}
        />
      ) : isIframeVideo ? (
        <iframe
          key={cur.url}
          src={cur.url}
          title={cur.alt}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <video
          key={cur.url}
          ref={videoRef}
          src={cur.url}
          poster={cur.poster || undefined}
          autoPlay
          muted
          playsInline
          loop={items.length === 1}
          onEnded={advance}
          onError={advance}
        />
      )}

      {items.length > 1 && (
        <div className="carousel-dots">
          {items.map((_, i) => (
            <span key={i} className={`carousel-dot${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
