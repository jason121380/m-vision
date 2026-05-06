import { useCallback, useState } from 'react';
import './App.css';
import { StarsBackground } from './components/StarsBackground';
import { Steps } from './components/Steps';
import { Page1 } from './components/Page1';
import { Page2 } from './components/Page2';
import { Page3 } from './components/Page3';
import { Page4 } from './components/Page4';
import { PrintableContract } from './components/PrintableContract';
import { MediaCarousel } from './components/MediaCarousel';
import { useConfig } from './hooks/useConfig';
import { initialState, type FormState } from './types';
import { submitToSheet } from './lib/submission';
import type { PdfResult } from './lib/pdf';

const TOTAL_PAGES = 4;

type ModalState =
  | { type: 'none' }
  | { type: 'submitting' }
  | { type: 'success'; pdf?: PdfResult }
  | { type: 'error'; message: string; pdf?: PdfResult }
  | { type: 'validation'; messages: string[] };

function validatePage(page: number, state: FormState): string[] {
  const errors: string[] = [];
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  if (page === 1) {
    if (!state.year || !state.month || !state.day) errors.push('請填寫活動日期（年月日）');
    if (!state.svc) errors.push('請選擇服務選項');
    if (isV && !state.vcKey) errors.push('請選擇錄影機位');
    if (isP && !state.pcKey) errors.push('請選擇拍照機位');
    if (isV && !state.vcerKey) errors.push('請選擇錄影儀式');
    if (isP && !state.pcerKey) errors.push('請選擇拍照儀式');
  } else if (page === 2) {
    if (isV && !state.vpKey) errors.push('請選擇動態錄影師');
    if (isP && !state.ppKey) errors.push('請選擇平面攝影師');
  } else if (page === 3) {
    if (!state.groom) errors.push('請填寫先生姓名');
    if (!state.bride) errors.push('請填寫太太姓名');
    if (!state.phone) errors.push('請填寫手機號碼');
    if (!state.wt) errors.push('請選擇宴客時間');
    if (!state.restaurant) errors.push('請填寫餐廳地址');
  } else if (page === 4) {
    if (!state.signature) errors.push('請完成甲方簽名');
  }
  return errors;
}

function openPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  // 先嘗試在新分頁開啟（LINE 等 WebView 會跳系統瀏覽器）
  const w = window.open(url, '_blank');
  if (!w) {
    // 被擋的話 fallback 用 anchor 觸發下載
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

export function App() {
  const { config, loaded } = useConfig();
  const [state, setState] = useState<FormState>(initialState);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const update = useCallback((patch: Partial<FormState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setPage(1);
    setModal({ type: 'none' });
    window.scrollTo(0, 0);
  }, []);

  const onNext = useCallback(async () => {
    const errors = validatePage(page, state);
    if (errors.length > 0) {
      setModal({ type: 'validation', messages: errors });
      return;
    }
    if (page < TOTAL_PAGES) {
      setPage(page + 1);
      window.scrollTo(0, 0);
      return;
    }
    setModal({ type: 'submitting' });
    const res = await submitToSheet(state, config);
    if (res.ok) {
      setModal({ type: 'success', pdf: res.pdf });
    } else {
      setModal({ type: 'error', message: res.error ?? '提交失敗', pdf: res.pdf });
    }
  }, [page, state, config]);

  const onBack = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
      window.scrollTo(0, 0);
    }
  }, [page]);

  const onOpenPdf = useCallback(() => {
    if (modal.type !== 'success' && modal.type !== 'error') return;
    if (!modal.pdf) return;
    openPdf(modal.pdf.blob, modal.pdf.filename);
  }, [modal]);

  if (!loaded) {
    return (
      <>
        <StarsBackground />
        <div className="loading">載入中…</div>
      </>
    );
  }

  return (
    <>
      <StarsBackground />
      <div className="app">
        <div className="brand">
          <img
            src={config.settings.logo || '/logo.png'}
            alt={config.settings.company_name ?? 'M 視覺影像記錄公司'}
            className="brand-logo"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.endsWith('/logo.png')) return;
              img.src = '/logo.png';
            }}
          />
        </div>
        <Steps current={page} total={TOTAL_PAGES} />

        {page === 1 && config.media.length > 0 && (
          <div className="carousel-wrap">
            <MediaCarousel items={config.media} />
          </div>
        )}

        <div className="pages">
          {page === 1 && <Page1 state={state} update={update} config={config} />}
          {page === 2 && <Page2 state={state} update={update} config={config} />}
          {page === 3 && <Page3 state={state} update={update} config={config} />}
          {page === 4 && <Page4 state={state} update={update} config={config} />}
        </div>

        <div className="bnav">
          <button className={`btn-nav${page === 1 ? ' hidden' : ''}`} onClick={onBack}>
            上一頁
          </button>
          <div />
          <button
            className="btn-nav primary"
            onClick={onNext}
            disabled={modal.type === 'submitting'}
          >
            {page === TOTAL_PAGES ? (modal.type === 'submitting' ? '送出中…' : '完 成') : '下一頁'}
          </button>
        </div>
      </div>

      <PrintableContract state={state} config={config} />

      {modal.type === 'validation' && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-emoji">⚠️</div>
            <div className="modal-title">尚未完成</div>
            <div className="modal-body" style={{ textAlign: 'left' }}>
              {modal.messages.map((m, i) => (
                <div key={i} style={{ padding: '4px 0' }}>• {m}</div>
              ))}
            </div>
            <button className="modal-btn" onClick={() => setModal({ type: 'none' })}>
              我知道了
            </button>
          </div>
        </div>
      )}

      {modal.type === 'success' && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-emoji">✅</div>
            <div className="modal-title">預約完成</div>
            <div className="modal-body">
              感謝您的選擇
              <br />
              {config.settings.company_name ?? 'M 視覺影像記錄公司'}
              <br />
              將盡快與您聯繫確認
            </div>
            {modal.pdf && (
              <button
                className="modal-btn"
                onClick={onOpenPdf}
                style={{ marginBottom: 8, background: 'rgba(255,255,255,.12)' }}
              >
                開啟契約 PDF
              </button>
            )}
            <button className="modal-btn" onClick={reset}>
              確 認
            </button>
          </div>
        </div>
      )}

      {modal.type === 'error' && (
        <div className="modal">
          <div className="modal-box">
            <div className="modal-emoji">⚠️</div>
            <div className="modal-title">提交失敗</div>
            <div className="modal-body">{modal.message}</div>
            <button className="modal-btn" onClick={() => setModal({ type: 'none' })}>
              關閉
            </button>
          </div>
        </div>
      )}
    </>
  );
}
