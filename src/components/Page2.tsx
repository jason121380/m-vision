import type { AppConfig, FormState } from '../types';

type Props = {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  config: AppConfig;
};

const optClass = (sel: boolean) => `opt${sel ? ' sel' : ''}`;
const popClass = (sel: boolean) => `popt${sel ? ' sel' : ''}`;

export function Page2({ state, update, config }: Props) {
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  const videoPhotographers = config.photographers.filter((p) => p.type === 'video');
  const photoPhotographers = config.photographers.filter((p) => p.type === 'photo');

  return (
    <div className="page active">
      <div className="pnum">02</div>

      <div className="stitle">
        <div className="stitle-zh">加 選 項 目</div>
      </div>
      <div className="card" style={{ maxWidth: 320, margin: '0 auto' }}>
        {config.addons.map((a) => (
          <div
            key={a.key}
            className={optClass(state.addonKey === a.key)}
            onClick={() => update({ addonKey: a.key })}
          >
            <div className="rc">
              <div className="rd" />
            </div>
            <div className="opt-t" style={{ fontSize: a.label.length > 8 ? 13 : 14 }}>{a.label}</div>
            {a.price > 0 && <div className="opt-p">{a.price.toLocaleString('zh-TW')}</div>}
          </div>
        ))}
      </div>

      {(isV || isP) && (
        <div className="g2" style={{ marginTop: 20 }}>
          {isV && (
            <div>
              <div className="col-h" style={{ marginBottom: 8 }}>
                <div className="col-h-zh" style={{ fontSize: 13 }}>指定動態錄影師</div>
              </div>
              <div className="pcard">
                {videoPhotographers.map((p) => {
                  const isSpecial = p.key === 'none' || p.key === 'any';
                  return (
                    <div
                      key={p.key}
                      className={popClass(state.vpKey === p.key)}
                      onClick={() => update({ vpKey: p.key })}
                    >
                      {isSpecial ? (
                        <div
                          className="src"
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: '50%',
                            border: '1.5px solid rgba(255,255,255,.5)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div className="srd" />
                        </div>
                      ) : (
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                          {p.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="pinfo">
                        <div className="pname" style={{ fontSize: 12 }}>
                          {isSpecial ? `${p.price === 0 ? '0元 — ' : ''}${p.name}` : p.name}
                        </div>
                        {!isSpecial && (
                          <div className="prole">
                            {p.role} {p.price.toLocaleString('zh-TW')}元
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {isP && (
            <div>
              <div className="col-h" style={{ marginBottom: 8 }}>
                <div className="col-h-zh" style={{ fontSize: 13 }}>指定平面攝影師</div>
              </div>
              <div className="pcard">
                {photoPhotographers.map((p) => {
                  const isSpecial = p.key === 'none' || p.key === 'any';
                  return (
                    <div
                      key={p.key}
                      className={popClass(state.ppKey === p.key)}
                      onClick={() => update({ ppKey: p.key })}
                    >
                      {isSpecial ? (
                        <div
                          className="src"
                          style={{
                            width: 17,
                            height: 17,
                            borderRadius: '50%',
                            border: '1.5px solid rgba(255,255,255,.5)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div className="srd" />
                        </div>
                      ) : (
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                          {p.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="pinfo">
                        <div className="pname" style={{ fontSize: 12 }}>
                          {isSpecial ? `${p.price === 0 ? '0元 — ' : ''}${p.name}` : p.name}
                        </div>
                        {!isSpecial && (
                          <div className="prole">
                            {p.role} {p.price.toLocaleString('zh-TW')}元
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="note">如勾選不指定，則輪班安排老師檔期</div>
      <div className="sp" />
    </div>
  );
}
