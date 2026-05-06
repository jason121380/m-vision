import type { AppConfig, FormState } from '../types';

type Props = {
  state: FormState;
  config: AppConfig;
};

// 印給 PDF 用的契約版面：白底黑字、固定寬度、無捲動。
// 永遠掛在 DOM 但用 left:-9999px 藏起來，html2canvas 抓得到。
export function PrintableContract({ state, config }: Props) {
  const s = config.settings;
  const deposit = Number(s.deposit ?? 3000);
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  const videoBase = isV ? config.services.find((x) => x.key === 'video')?.price ?? 0 : 0;
  const photoBase = isP ? config.services.find((x) => x.key === 'photo')?.price ?? 0 : 0;
  const vc = config.cameras.find((c) => c.type === 'video' && c.key === state.vcKey);
  const pc = config.cameras.find((c) => c.type === 'photo' && c.key === state.pcKey);
  const vcer = config.ceremonies.find((c) => c.type === 'video' && c.key === state.vcerKey);
  const pcer = config.ceremonies.find((c) => c.type === 'photo' && c.key === state.pcerKey);
  const addon = config.addons.find((a) => a.key === state.addonKey);
  const vp = config.photographers.find((p) => p.type === 'video' && p.key === state.vpKey);
  const pp = config.photographers.find((p) => p.type === 'photo' && p.key === state.ppKey);

  const total =
    videoBase + photoBase + (vc?.price ?? 0) + (pc?.price ?? 0) +
    (vcer?.price ?? 0) + (pcer?.price ?? 0) + (addon?.price ?? 0) +
    (vp?.price ?? 0) + (pp?.price ?? 0);
  const balance = total > 0 ? total - deposit : 0;

  const names = [state.groom, state.bride].filter(Boolean).join(' & ') || '—';
  const date = state.year && state.month && state.day ? `${state.year}年${state.month}月${state.day}日` : '—';

  const resolveAddr = (mode: string, addr: string): string => {
    if (mode === 'none') return '';
    if (mode === 'hotel') return state.hotel;
    if (mode === 'rest') return state.restaurant;
    return addr;
  };

  const wt = state.wt === 'lunch' ? '午宴' : state.wt === 'dinner' ? '晚宴' : '';
  const svcLabel = config.services.find((x) => x.key === state.svc)?.label ?? '—';

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' };
  const sectionStyle: React.CSSProperties = { padding: '12px 0', borderBottom: '1px solid #ddd' };
  const headerStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#222' };

  return (
    <div
      id="printable-contract"
      style={{
        position: 'absolute',
        left: -9999,
        top: 0,
        width: 720,
        padding: 40,
        background: '#fff',
        color: '#222',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Helvetica Neue', sans-serif",
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.2em' }}>攝 影 服 務 契 約（婚 禮 適 用）</div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>統一編號：{s.tax_id}</div>
      </div>

      <div style={sectionStyle}>
        <div style={headerStyle}>客戶資料</div>
        <div style={rowStyle}><span>先生姓名</span><span>{state.groom || '—'}</span></div>
        <div style={rowStyle}><span>太太姓名</span><span>{state.bride || '—'}</span></div>
        <div style={rowStyle}><span>手機號碼</span><span>{state.phone || '—'}</span></div>
        <div style={rowStyle}><span>婚宴日期</span><span>{date}</span></div>
        <div style={rowStyle}><span>宴客時間</span><span>{wt || '—'}</span></div>
        <div style={rowStyle}><span>餐廳地址</span><span>{state.restaurant || '—'}</span></div>
        {state.hotelMode === 'addr' && state.hotel && (
          <div style={rowStyle}><span>飯店地址</span><span>{state.hotel}</span></div>
        )}
        {state.wzMode !== 'none' && (
          <div style={rowStyle}><span>文定儀式</span><span>{resolveAddr(state.wzMode, state.wz)}</span></div>
        )}
        {state.yqMode !== 'none' && (
          <div style={rowStyle}><span>迎娶儀式</span><span>{resolveAddr(state.yqMode, state.yq)}</span></div>
        )}
        {state.zhMode !== 'none' && (
          <div style={rowStyle}><span>證婚儀式</span><span>{resolveAddr(state.zhMode, state.zh)}</span></div>
        )}
        {state.makeup && (
          <div style={rowStyle}><span>新秘開妝</span><span>{state.makeup}</span></div>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={headerStyle}>費用明細</div>
        <div style={rowStyle}><span>服務選項</span><span>{svcLabel}</span></div>
        {isV && (
          <div style={rowStyle}>
            <span>錄影（純宴客）</span>
            <span>{videoBase.toLocaleString('zh-TW')} 元</span>
          </div>
        )}
        {isV && vc && (
          <div style={rowStyle}><span>錄影機位（{vc.label}）</span><span>{vc.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {isV && vcer && (
          <div style={rowStyle}><span>錄影儀式（{vcer.label}）</span><span>{vcer.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {isP && (
          <div style={rowStyle}>
            <span>拍照（純宴客）</span>
            <span>{photoBase.toLocaleString('zh-TW')} 元</span>
          </div>
        )}
        {isP && pc && (
          <div style={rowStyle}><span>拍照機位（{pc.label}）</span><span>{pc.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {isP && pcer && (
          <div style={rowStyle}><span>拍照儀式（{pcer.label}）</span><span>{pcer.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {addon && addon.price > 0 && (
          <div style={rowStyle}><span>加選（{addon.label}）</span><span>{addon.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {isV && vp && vp.price > 0 && (
          <div style={rowStyle}><span>指定錄影師（{vp.name}）</span><span>{vp.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        {isP && pp && pp.price > 0 && (
          <div style={rowStyle}><span>指定攝影師（{pp.name}）</span><span>{pp.price.toLocaleString('zh-TW')} 元</span></div>
        )}
        <div style={{ ...rowStyle, fontWeight: 700, borderTop: '1px solid #ccc', marginTop: 6, paddingTop: 8 }}>
          <span>合計</span><span>{total.toLocaleString('zh-TW')} 元</span>
        </div>
        <div style={{ ...rowStyle, color: '#666' }}>
          <span>訂金</span><span>{deposit.toLocaleString('zh-TW')} 元</span>
        </div>
        <div style={{ ...rowStyle, color: '#666' }}>
          <span>尾款</span><span>{balance > 0 ? `${balance.toLocaleString('zh-TW')} 元` : '尚未計算'}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={headerStyle}>契約條款</div>
        <div style={{ fontSize: 11 }}>
          <p style={{ marginBottom: 6 }}><b>1.</b> 雙方於簽立本契約時，甲方應給付乙方 <b>{deposit.toLocaleString('zh-TW')}元</b>，做為訂金。</p>
          <p style={{ marginBottom: 6 }}><b>2.</b> 其餘尾款（{balance > 0 ? balance.toLocaleString('zh-TW') : '尚未計算'} 元）部分，甲方應於乙方拍攝工作結束時給付乙方，當日拍攝毛片檔案上傳雲端提供給甲方下載留存。</p>
          <p style={{ marginBottom: 6 }}><b>3-1.</b> 乙方為進行拍攝工作所支出之住宿費、道具製作費、場地租借費等費用（此合約免使用場地住宿）。</p>
          <p style={{ marginBottom: 6 }}><b>3-2.</b> 乙方於拍攝完畢後，需要九~十週進行剪輯作業，若甲方要求於拍攝隔週或指定時間取件，乙方得加收 3,000 元趕工費。</p>
          <p style={{ marginBottom: 6 }}><b>3-3.</b> 乙方就其拍攝之內容會以電子檔 1080 HD 高畫質隨身碟交予甲方。</p>
          <p style={{ marginBottom: 6 }}><b>3-4.</b> 乙方將成品交付甲方後，若甲方要求重新修改剪輯者，可提供 2 次修改，第 3 次起酌收 3,000 元（適用於動態攝影）。</p>
          <p style={{ marginBottom: 6 }}><b>3-5.</b> 影片（隨身碟）交到客戶手中七日內若無瑕疵、損壞、不能播放等問題，將一概不負責。</p>
          <p style={{ marginBottom: 6, marginTop: 10 }}><b>4. 契約之解除</b></p>
          <p style={{ marginBottom: 6 }}><b>4-1.</b> 乙方若非不可抗力因素無法履行合約，若無法履行則賠償甲方拍攝總費用 ×1.5 倍。</p>
          <p style={{ marginBottom: 6 }}><b>4-2.</b> 甲方若因不可抗力因素無法履行合約，甲方須提出書面或相關證明，乙方則需退還訂金。</p>
          <p style={{ marginBottom: 6 }}><b>4-3.</b> 若甲方非不可抗力因素於拍攝日前一天無故取消，甲方須賠償乙方總費用 30% 做為檔期損失。</p>
          <p style={{ marginBottom: 6 }}><b>4-4.</b> 當日拍攝檔案完全損毀導致甲方無紀錄影片，乙方須退還總價 + 總價 50%。</p>
          <p style={{ marginBottom: 6 }}><b>5-1.</b> 本契約未盡之事宜，依中華民國之法律補充之。</p>
          <p style={{ marginBottom: 6 }}><b>5-2.</b> 若因本契約發生爭議，雙方約定以{s.court}為第一審之管轄法院。</p>
          <p style={{ marginBottom: 6 }}><b>6-1.</b> 本契約由乙方電子回簽，由甲、乙雙方各執乙份為憑。</p>
        </div>
      </div>

      {isV && (
        <div style={sectionStyle}>
          <div style={headerStyle}>動態錄影服務內容</div>
          <p style={{ fontSize: 11, marginBottom: 4 }}>1. 錄影 MV 4–6 min — 微電影式唯美告白風格，搭配音樂及攝影師轉場運鏡整體感覺。</p>
          <p style={{ fontSize: 11 }}>2. 完成品 40–50 min 剪輯版 — 從早上化妝、訂婚奉茶、迎娶闖關拜別到宴客進場敬酒送客全紀錄，加上現場音效及背景音樂。</p>
        </div>
      )}

      {isP && (
        <div style={sectionStyle}>
          <div style={headerStyle}>平面拍攝服務內容</div>
          <p style={{ fontSize: 11, marginBottom: 4 }}>1. 使用軟件：PHASE ONE、Photoshop、PIX CAKE</p>
          <p style={{ fontSize: 11, marginBottom: 4 }}>2. 儀式、證婚、婚宴等視活動內容畫面捕捉，可安排時間拍攝類婚紗。</p>
          <p style={{ fontSize: 11, marginBottom: 4 }}>3. 精選 400–700 張 JPG（調色、濾鏡、曝光、飽和等調整）。</p>
          <p style={{ fontSize: 11, marginBottom: 4 }}>4. 照片修圖工作天 6–8 週。</p>
          <p style={{ fontSize: 11 }}>5. 紀念隨身碟 1 枚，7-11 店到店取件。</p>
        </div>
      )}

      <div style={{ ...sectionStyle, background: '#f4f0ff' }}>
        <div style={headerStyle}>立契約人</div>
        <p style={{ fontSize: 11, marginBottom: 8 }}>
          甲方：<b>{names}</b><br />
          電話：{state.phone || '—'}<br />
          地址：（免填）
        </p>
        <p style={{ fontSize: 11 }}>
          乙方：{s.owner_name}<br />
          地址：{s.address}<br />
          統一編號：{s.tax_id}　負責人：{s.owner_legal}<br />
          匯款：{s.bank}　帳號 {s.account}<br />
          訂金 {deposit.toLocaleString('zh-TW')} 元（匯款請備註中文姓名）
        </p>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>甲方簽名</div>
          {state.signature ? (
            <img src={state.signature} alt="signature" style={{ width: 240, height: 100, objectFit: 'contain', border: '1px solid #ddd', background: '#fff' }} />
          ) : (
            <div style={{ width: 240, height: 100, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 11 }}>未簽名</div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#444' }}>
          簽署日期：{date}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 9, color: '#888', borderTop: '1px solid #eee', paddingTop: 10 }}>
        主機：SONY FX3 Cinema Line × 2　全紀錄：Sony A74 × 2　輔助：DJI Osmo POCKET3 / INSTA360<br />
        平面：Sony A7M4　空拍：DJI mini Pro4 / mini3（視空航法規）<br />
        穩定：DJI RS4 pro / RS3 pro / RS3 mini　收音：HOLLYLAND / RODE / Sony ECM-b10<br />
        剪輯：Premiere / Audition　修圖：Phase One / Photoshop / Pic Cake<br />
        ※ 原 LE YING IMAGE（樂映影像）於 114/04/01 起更名為 M 視覺 Vision
      </div>
    </div>
  );
}
