import { useState } from 'react';

// 跟 src/hooks/useConfig.ts 的 normalizeMediaUrl 同邏輯，
// 但只處理 image。Drive 分享連結 / 純檔案 ID / 直連 URL 都吃。
function toImageUrl(raw: string): string {
  if (!raw) return '';
  const t = raw.trim();
  if (/^[\w-]{20,}$/.test(t)) {
    return `https://drive.google.com/thumbnail?id=${t}&sz=w400`;
  }
  const m1 = t.match(/\/file\/d\/([\w-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w400`;
  const m2 = t.match(/[?&]id=([\w-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w400`;
  return t;
}

type Props = {
  src: string;
  name: string;
  size?: 'sm' | 'md';
};

export function Avatar({ src, name, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false);
  const cls = size === 'sm' ? 'bk-avatar-sm' : 'bk-avatar';
  const initial = name.slice(0, 1) || '？';

  if (!src || failed) {
    return <span className={`${cls} bk-avatar-fallback`}>{initial}</span>;
  }
  return (
    <img
      className={cls}
      src={toImageUrl(src)}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
