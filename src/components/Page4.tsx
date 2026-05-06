import { useRef } from 'react';
import type { AppConfig, FormState } from '../types';
import { Summary } from './Summary';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { buildSummary, computeTotal, fmtMoney } from '../lib/pricing';

type Props = {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  config: AppConfig;
};

export function Page4({ state, update, config }: Props) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const summary = buildSummary(state, config).filter((r) => r.amt === null || r.amt > 0);
  const total = computeTotal(state, config);
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  const s = config.settings;
  const deposit = Number(s.deposit ?? 3000);
  const balance = total > 0 ? total - deposit : 0;
  const names = [state.groom, state.bride].filter(Boolean).join(' & ') || '—';

  return (
    <div className="page active">
      <div className="fg" style={{ marginBottom: 6 }}>
        <div className="flbl">客戶確認</div>
        <div className="card">
          <div className="sitem">
            <div className="slbl">先生姓名</div>
            <div className="sval">{state.groom || '—'}</div>
          </div>
          <div className="sitem">
            <div className="slbl">太太姓名</div>
            <div className="sval">{state.bride || '—'}</div>
          </div>
          <div className="sitem">
            <div className="slbl">手機號碼</div>
            <div className="sval">{state.phone || '—'}</div>
          </div>
        </div>
      </div>

      <div className="fg" style={{ marginTop: 14 }}>
        <div className="flbl">費用明細</div>
        <Summary rows={summary} />
        <div className="total-bar">
          <div className="total-lbl">合計</div>
          <div className="total-amt">{fmtMoney(total)}</div>
        </div>
      </div>

      <div className="fg" style={{ marginTop: 14 }}>
        <div className="flbl">攝影服務契約</div>
        <div className="contract">
          <div className="ct-title">攝 影 服 務 契 約（婚 禮 適 用）</div>
          <div className="ct-sub">統一編號：{s.tax_id}</div>

          <div className="ct-sec">
            <b>1.</b> 雙方於簽立本契約時，甲方應給付乙方 <b>{deposit.toLocaleString('zh-TW')}元</b>，做為訂金。
            <br />
            <b>2.</b> 其餘尾款（
            <span className="ct-fill">{balance > 0 ? balance.toLocaleString('zh-TW') : '尚未計算'}</span>{' '}
            元）部分，甲方應於乙方拍攝工作結束時給付乙方，當日拍攝毛片檔案上傳雲端提供給甲方下載留存。
            <br />
            <b>3-1.</b> 乙方為進行拍攝工作所支出之住宿費、道具製作費、場地租借費等費用（此合約免使用場地住宿）。
            <br />
            <b>3-2.</b> 乙方於拍攝完畢後，需要九~十週進行剪輯作業，若甲方要求於拍攝隔週或指定時間取件，乙方得加收 3,000 元趕工費。
            <br />
            <b>3-3.</b> 乙方就其拍攝之內容會以電子檔 1080 HD 高畫質隨身碟交予甲方。
            <br />
            <b>3-4.</b> 乙方將成品交付甲方後，若甲方要求重新修改剪輯者，可提供 2 次修改，第 3 次起酌收 3,000 元（適用於動態攝影）。
            <br />
            <b>3-5.</b> 影片（隨身碟）交到客戶手中七日內若無瑕疵、損壞、不能播放等問題，將一概不負責。
          </div>

          <div className="ct-sec">
            <b>4. 契約之解除</b>
            <br />
            <b>4-1.</b> 乙方若非不可抗力因素無法履行合約，若無法履行則賠償甲方拍攝總費用 ×1.5 倍。
            <br />
            <b>4-2.</b> 甲方若因不可抗力因素無法履行合約，甲方須提出書面或相關證明，乙方則需退還訂金。
            <br />
            <b>4-3.</b> 若甲方非不可抗力因素於拍攝日前一天無故取消，甲方須賠償乙方總費用 30% 做為檔期損失。
            <br />
            <b>4-4.</b> 當日拍攝檔案完全損毀導致甲方無紀錄影片，乙方須退還總價 + 總價 50%。
            <br />
            <b>5-1.</b> 本契約未盡之事宜，依中華民國之法律補充之。
            <br />
            <b>5-2.</b> 若因本契約發生爭議，雙方約定以{s.court}為第一審之管轄法院。
            <br />
            <b>6-1.</b> 本契約由乙方電子回簽，由甲、乙雙方各執乙份為憑。
          </div>

          {isV && (
            <div className="ct-sec">
              <b>動態錄影服務內容</b>
              <br />
              1. 錄影 MV 4–6 min — 微電影式唯美告白風格，搭配音樂及攝影師轉場運鏡整體感覺。
              <br />
              2. 完成品 40–50 min 剪輯版 — 從早上化妝、訂婚奉茶、迎娶闖關拜別到宴客進場敬酒送客全紀錄，加上現場音效及背景音樂。
            </div>
          )}

          {isP && (
            <div className="ct-sec">
              <b>平面拍攝服務內容</b>
              <br />
              1. 使用軟件：PHASE ONE、Photoshop、PIX CAKE
              <br />
              2. 儀式、證婚、婚宴等視活動內容畫面捕捉，可安排時間拍攝類婚紗。
              <br />
              3. 精選 400–700 張 JPG（調色、濾鏡、曝光、飽和等調整）。
              <br />
              4. 照片修圖工作天 6–8 週。
              <br />
              5. 紀念隨身碟 1 枚，7-11 店到店取件。
            </div>
          )}

          <div className="ct-sec party">
            <b>立契約人</b>
            <br />
            甲方：<span className="ct-fill">{names}</span>
            <br />
            電話：<span className="ct-fill">{state.phone || '—'}</span>
            <br />
            地址：（免填）
            <br />
            <br />
            乙方：{s.owner_name}
            <br />
            地址：{s.address}
            <br />
            統一編號：{s.tax_id}　負責人：{s.owner_legal}
            <br />
            匯款：{s.bank}　帳號 {s.account}
            <br />
            訂金 {deposit.toLocaleString('zh-TW')} 元（匯款請備註中文姓名）
          </div>

          <div className="ct-sec" style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)' }}>
            主機：SONY FX3 Cinema Line × 2　全紀錄：Sony A74 × 2　輔助：DJI Osmo POCKET3 / INSTA360
            <br />
            平面：Sony A7M4　空拍：DJI mini Pro4 / mini3（視空航法規）
            <br />
            穩定：DJI RS4 pro / RS3 pro / RS3 mini　收音：HOLLYLAND / RODE / Sony ECM-b10
            <br />
            剪輯：Premiere / Audition　修圖：Phase One / Photoshop / Pic Cake
            <br />
            <span style={{ opacity: 0.6 }}>※ 原 LE YING IMAGE（樂映影像）於 114/04/01 起更名為 M 視覺 Vision</span>
          </div>

          <div className="ct-sig">
            甲方簽署日期：
            <input
              className="sig-input y"
              type="number"
              placeholder="____"
              value={state.year}
              onChange={(e) => update({ year: e.target.value })}
            />
            年
            <input
              className="sig-input md"
              type="number"
              placeholder="__"
              value={state.month}
              onChange={(e) => update({ month: e.target.value })}
            />
            月
            <input
              className="sig-input md"
              type="number"
              placeholder="__"
              value={state.day}
              onChange={(e) => update({ day: e.target.value })}
            />
            日
          </div>
        </div>
      </div>

      <div className="fg" style={{ marginTop: 12 }}>
        <div className="flbl">甲 方 簽 名</div>
        <SignaturePad ref={sigRef} onChange={(d) => update({ signature: d })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="sig-clear" onClick={() => sigRef.current?.clear()}>
            清除重簽
          </button>
        </div>
      </div>
      <div className="sp" />
    </div>
  );
}
