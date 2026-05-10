import { useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  getPushStatus,
  isBadgeSupported,
  isPushSupported,
  setBadgeManual,
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
  const [showTest, setShowTest] = useState(false);

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
      setShowTest(false);
      setMsg('已關閉通知');
    } else {
      const res = await enablePush(kind);
      if (res.ok) {
        setStatus('subscribed');
        setShowTest(true);
        setMsg('已開啟通知');
      } else {
        setMsg(res.error);
      }
    }
    setBusy(false);
  };

  const onTestBadge = async () => {
    if (!isBadgeSupported()) {
      setMsg('裝置不支援 App Badge（紅點）— iOS 需 16.4+ 且已加入主畫面');
      return;
    }
    const res = await setBadgeManual(1);
    if (res.ok) {
      setMsg('已點亮紅點 → 切到主畫面看 icon，回到 app 會自動清掉');
    } else {
      setMsg('紅點測試失敗：' + res.reason);
    }
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
      {(status === 'subscribed' || showTest) && (
        <button
          type="button"
          className={className}
          onClick={onTestBadge}
          title="把 PWA icon 上的紅點點亮一次（驗證裝置支援度）"
        >
          測試紅點
        </button>
      )}
      {msg && <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{msg}</span>}
    </span>
  );
}
