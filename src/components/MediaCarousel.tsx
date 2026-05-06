import { useEffect, useRef, useState } from 'react';
import type { MediaRow } from '../types';

const IMAGE_DURATION_MS = 5000;

type Props = { items: MediaRow[] };

export function MediaCarousel({ items }: Props) {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const cur = items[idx];
    if (cur.type === 'image') {
      const t = window.setTimeout(() => setIdx((i) => (i + 1) % items.length), IMAGE_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    return;
  }, [idx, items]);

  if (items.length === 0) return null;
  const cur = items[idx];
  const advance = () => setIdx((i) => (i + 1) % items.length);

  // Drive iframe preview 不能被 onEnded 控制，所以 video 走的是 <video> tag。
  // 若是 Drive 的 /preview iframe URL，當作 image 走（顯示 iframe）。
  const isIframeVideo = cur.type === 'video' && cur.url.includes('/preview');

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
          allow="autoplay"
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
