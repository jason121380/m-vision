import type { AppConfig, FormState, ServiceKey } from '../types';

type Props = {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  config: AppConfig;
};

const optClass = (sel: boolean) => `opt${sel ? ' sel' : ''}`;
const sopClass = (sel: boolean) => `sopt${sel ? ' sel' : ''}`;

export function Page1({ state, update, config }: Props) {
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';
  const onlyP = isP && !isV;

  const videoCams = config.cameras.filter((c) => c.type === 'video');
  const photoCams = config.cameras.filter((c) => c.type === 'photo');
  const videoCers = config.ceremonies.filter((c) => c.type === 'video');
  const photoCers = config.ceremonies.filter((c) => c.type === 'photo');

  const videoPrice = config.services.find((s) => s.key === 'video')?.price ?? 0;
  const photoPrice = config.services.find((s) => s.key === 'photo')?.price ?? 0;

  return (
    <div className="page active">
      <div className="pnum">01</div>

      <div className="stitle">
        <div className="stitle-zh">活 動 日 期</div>
        <div className="stitle-en">Event Date</div>
      </div>
      <div className="date-row">
        <div>
          <label className="dlbl">年</label>
          <input
            className="dinput"
            type="number"
            value={state.year}
            placeholder="年份"
            onChange={(e) => update({ year: e.target.value })}
          />
        </div>
        <div>
          <label className="dlbl">月</label>
          <input
            className="dinput"
            type="number"
            value={state.month}
            placeholder="月"
            min={1}
            max={12}
            onChange={(e) => update({ month: e.target.value })}
          />
        </div>
        <div>
          <label className="dlbl">日</label>
          <input
            className="dinput"
            type="number"
            value={state.day}
            placeholder="日"
            min={1}
            max={31}
            onChange={(e) => update({ day: e.target.value })}
          />
        </div>
      </div>

      <div className="stitle" style={{ marginTop: 16 }}>
        <div className="stitle-zh">服 務 選 項</div>
        <div className="stitle-en">Services</div>
      </div>
      <div className="card" style={{ maxWidth: 260, margin: '0 auto' }}>
        {config.services.map((s) => (
          <div
            key={s.key}
            className={optClass(state.svc === s.key)}
            onClick={() => update({ svc: s.key as ServiceKey })}
          >
            <div className="rc">
              <div className="rd" />
            </div>
            <div className="opt-t">{s.label}</div>
          </div>
        ))}
      </div>

      {(isV || isP) && (
        <div className="g2" style={{ marginTop: 18 }}>
          {isV && (
            <div>
              <div className="col-h" style={{ marginBottom: 8 }}>
                <div className="col-h-zh">錄 影</div>
                <div className="col-h-en">Video recording</div>
              </div>
              <div className="card">
                <div className="opt sel" style={{ cursor: 'default' }}>
                  <div className="rc"><div className="rd" /></div>
                  <div className="opt-t" style={{ fontSize: 13 }}>純宴客</div>
                  <div className="opt-p">{videoPrice.toLocaleString('zh-TW')}</div>
                </div>
              </div>
            </div>
          )}
          {isP && (
            <div className={onlyP ? 'col-right' : ''}>
              <div className="col-h" style={{ marginBottom: 8 }}>
                <div className="col-h-zh">拍 照</div>
                <div className="col-h-en">Photography</div>
              </div>
              <div className="card">
                <div className="opt sel" style={{ cursor: 'default' }}>
                  <div className="rc"><div className="rd" /></div>
                  <div className="opt-t" style={{ fontSize: 13 }}>純宴客</div>
                  <div className="opt-p">{photoPrice.toLocaleString('zh-TW')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(isV || isP) && (
        <div style={{ marginTop: 18 }}>
          <div className="col-header">
            {isV && (
              <div className="col-h">
                <div className="col-h-zh">機 位 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Number of Cameras</div>
              </div>
            )}
            {isP && (
              <div className={`col-h${onlyP ? ' col-right' : ''}`}>
                <div className="col-h-zh">機 位 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Number of Cameras</div>
              </div>
            )}
          </div>
          <div className="g2">
            {isV && (
              <div className="card">
                {videoCams.map((c) => (
                  <div
                    key={c.key}
                    className={sopClass(state.vcKey === c.key)}
                    onClick={() => update({ vcKey: c.key })}
                  >
                    <div className="src">
                      <div className="srd" />
                    </div>
                    <div className="sopt-t">
                      {c.label} {c.price.toLocaleString('zh-TW')}元
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isP && (
              <div className={`card${onlyP ? ' col-right' : ''}`}>
                {photoCams.map((c) => (
                  <div
                    key={c.key}
                    className={sopClass(state.pcKey === c.key)}
                    onClick={() => update({ pcKey: c.key })}
                  >
                    <div className="src">
                      <div className="srd" />
                    </div>
                    <div className="sopt-t">
                      {c.label} {c.price.toLocaleString('zh-TW')}元
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(isV || isP) && (
        <div style={{ marginTop: 18 }}>
          <div className="col-header">
            {isV && (
              <div className="col-h">
                <div className="col-h-zh">儀 式 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Ceremony Options</div>
              </div>
            )}
            {isP && (
              <div className={`col-h${onlyP ? ' col-right' : ''}`}>
                <div className="col-h-zh">儀 式 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Ceremony Options</div>
              </div>
            )}
          </div>
          <div className="g2">
            {isV && (
              <div className="card">
                {videoCers.map((c) => (
                  <div
                    key={c.key}
                    className={sopClass(state.vcerKey === c.key)}
                    onClick={() => update({ vcerKey: c.key })}
                  >
                    <div className="src">
                      <div className="srd" />
                    </div>
                    <div className="sopt-t">{c.label} {c.price.toLocaleString('zh-TW')}元</div>
                  </div>
                ))}
              </div>
            )}
            {isP && (
              <div className={`card${onlyP ? ' col-right' : ''}`}>
                {photoCers.map((c) => (
                  <div
                    key={c.key}
                    className={sopClass(state.pcerKey === c.key)}
                    onClick={() => update({ pcerKey: c.key })}
                  >
                    <div className="src">
                      <div className="srd" />
                    </div>
                    <div className="sopt-t">{c.label} {c.price.toLocaleString('zh-TW')}元</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="sp" />
    </div>
  );
}
