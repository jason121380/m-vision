import { useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  getPushStatus,
  isPushSupported,
  type PushKind,
  type PushStatus,
} from '../lib/push';

type Props = {
  kind: PushKind;
  className?: string;
};

// 兩種風格：admin 用 .admin-btn、攝影師用 .bk-btn。className 由父層帶進來
export function PushToggle({ kind, className }: Props) {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }
    getPushStatus().then(setStatus);
  }, []);

  // 訊息自動消
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 6000);
    return () => window.clearTimeout(t);
  }, [msg]);

  if (status === 'unsupported') {
    // iOS 沒加到主畫面前 PushManager 不存在；不顯示按鈕，避免誤導
    return null;
  }

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    if (status === 'subscribed') {
      await disablePush(kind);
      setStatus('idle');
      setMsg('已關閉通知');
    } else {
      const res = await enablePush(kind);
      if (res.ok) {
        setStatus('subscribed');
        setMsg('已開啟通知');
      } else {
        setMsg(res.error);
      }
    }
    setBusy(false);
  };

  const label =
    busy ? '處理中…' :
    status === 'subscribed' ? '🔔 通知已開' :
    status === 'denied' ? '🔕 通知被封鎖' :
    '🔔 開啟通知';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={busy || status === 'denied'}
        title={status === 'denied' ? '請到系統設定 → 通知 → 允許' : ''}
      >
        {label}
      </button>
      {msg && <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{msg}</span>}
    </span>
  );
}
