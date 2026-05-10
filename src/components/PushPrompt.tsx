import { useEffect, useState } from 'react';
import {
  enablePush,
  getPushStatus,
  tryAutoEnablePush,
  type PushKind,
  type PushStatus,
} from '../lib/push';

type Props = { kind: PushKind };

// 進到後台 / 攝影師頁面時顯示一張提示卡，使用者按下「開啟通知」才觸發 requestPermission
// （iOS Safari 必須有使用者手勢）。訂閱成功後永久消失；已訂閱 / 被封鎖 / 不支援 → 不顯示。
export function PushPrompt({ kind }: Props) {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      // 權限已給過、只是 SW 訂閱遺失 → 靜默補回去（多數情況使用者根本不會看到 banner）
      await tryAutoEnablePush(kind);
      if (!alive) return;
      const s = await getPushStatus();
      if (alive) setStatus(s);
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  if (status === 'loading' || status === 'subscribed' || status === 'unsupported' || status === 'denied') {
    return null;
  }

  const onEnable = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await enablePush(kind);
    setBusy(false);
    if (res.ok) setStatus('subscribed');
    else setError(res.error);
  };

  const msg = kind === 'admin' ? '建議開啟通知，第一時間收到客戶新預約' : '建議開啟通知，新檔期立刻通知你';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255, 196, 87, 0.12)',
        border: '1px solid rgba(255, 180, 80, 0.45)',
        borderRadius: 10,
        padding: '10px 14px',
        margin: '12px 0',
        fontSize: 13,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: 1, minWidth: 180 }}>🔔 {msg}</span>
      <button
        type="button"
        onClick={onEnable}
        disabled={busy}
        style={{
          padding: '6px 14px',
          background: 'rgba(110, 90, 200, 0.9)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: busy ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 500,
          opacity: busy ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
      >
        {busy ? '處理中…' : '開啟通知'}
      </button>
      {error && (
        <span style={{ color: '#c15757', fontSize: 12, flexBasis: '100%' }}>{error}</span>
      )}
    </div>
  );
}
