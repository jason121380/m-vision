import { useCallback, useState } from 'react';
import './App.css';
import { StarsBackground } from './components/StarsBackground';
import { Steps } from './components/Steps';
import { Page1 } from './components/Page1';
import { Page2 } from './components/Page2';
import { Page3 } from './components/Page3';
import { Page4 } from './components/Page4';
import { PrintableContract } from './components/PrintableContract';
import { useConfig } from './hooks/useConfig';
import { initialState, type FormState } from './types';
import { submitToSheet } from './lib/submission';
import type { PdfResult } from './lib/pdf';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const TOTAL_PAGES = 4;

type ModalState =
  | { type: 'none' }
  | { type: 'submitting' }
  | { type: 'success'; pdf?: PdfResult }
  | { type: 'error'; message: string; pdf?: PdfResult };

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

  const onDownload = useCallback(() => {
    if (modal.type !== 'success' && modal.type !== 'error') return;
    if (!modal.pdf) return;
    triggerBlobDownload(modal.pdf.blob, modal.pdf.filename);
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
        <div className="brand">{config.settings.company_name ?? 'M 視覺影像記錄公司'}</div>
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
                onClick={onDownload}
                style={{ marginBottom: 8, background: 'rgba(255,255,255,.12)' }}
              >
                下載契約 PDF
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
