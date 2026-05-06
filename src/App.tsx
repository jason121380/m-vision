import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './App.css';
import { Page1 } from './components/Page1';
import { Page2 } from './components/Page2';
import { Page3 } from './components/Page3';
import { Page4 } from './components/Page4';
import { PrintableContract } from './components/PrintableContract';
import { MediaCarousel } from './components/MediaCarousel';
import { Steps } from './components/Steps';
import { useConfig } from './hooks/useConfig';
import { initialState, type FormState } from './types';
import { submitToSheet } from './lib/submission';
import type { PdfResult } from './lib/pdf';

const TOTAL_PAGES = 4;

type ModalState =
  | { type: 'none' }
  | { type: 'submitting' }
  | { type: 'success'; pdf?: PdfResult; pdfUrl?: string }
  | { type: 'error'; message: string; pdf?: PdfResult; pdfUrl?: string }
  | { type: 'validation'; messages: string[] };

function validatePage(page: number, state: FormState): string[] {
  const errors: string[] = [];
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  if (page === 1) {
    if (!state.year || !state.month || !state.day) errors.push('請填寫活動日期（年月日）');
    if (!state.svc) errors.push('請選擇服務選項');
    if (isV && !state.vBanquet) errors.push('請選擇錄影 純宴客');
    if (isP && !state.pBanquet) errors.push('請選擇拍照 純宴客');
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

  const doScroll = useCallback(() => {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const onNext = useCallback(async () => {
    const errors = validatePage(page, state);
    if (errors.length > 0) {
      setModal({ type: 'validation', messages: errors });
      return;
    }
    if (page < TOTAL_PAGES) {
      doScroll();
      setPage(page + 1);
      return;
    }
    setModal({ type: 'submitting' });
    const res = await submitToSheet(state, config);
    if (res.ok) {
      setModal({ type: 'success', pdf: res.pdf, pdfUrl: res.pdfUrl });
    } else {
      setModal({ type: 'error', message: res.error ?? '提交失敗', pdf: res.pdf, pdfUrl: res.pdfUrl });
    }
  }, [page, state, config, doScroll]);

  const onBack = useCallback(() => {
    if (page > 1) {
      doScroll();
      setPage(page - 1);
    }
  }, [page, doScroll]);

  // 同步在 paint 前 reset，避免使用者看到舊位置一閃即逝
  useLayoutEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    doScroll();
  }, [page, doScroll]);

  // Paint 後再 watchdog 800ms，把任何企圖拉回 scroll 的元素全部壓回 0
  useEffect(() => {
    doScroll();
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (window.scrollY !== 0) doScroll();
      attempts++;
      if (attempts >= 16) window.clearInterval(interval);
    }, 50);
    return () => window.clearInterval(interval);
  }, [page, doScroll]);

  if (!loaded) {
    return <div className="loading">載入中…</div>;
  }

  return (
    <>
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

        {page === 1 && config.media.length > 0 && (
          <div className="carousel-wrap">
            <MediaCarousel items={config.media} />
          </div>
        )}

        <Steps current={page} total={TOTAL_PAGES} />

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

      {modal.type === 'submitting' && (
        <div className="modal">
          <div className="modal-box">
            <div className="spinner" />
            <div className="modal-title">處理中…</div>
            <div className="modal-body">正在產生契約 PDF<br />並上傳到雲端，請稍候</div>
          </div>
        </div>
      )}

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
