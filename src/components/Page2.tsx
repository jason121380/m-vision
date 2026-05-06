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

  // 隱藏「無選（key=none）」那一列；保留「不指定（輪班）」
  const videoPhotographers = config.photographers.filter((p) => p.type === 'video' && p.key !== 'none');
  const photoPhotographers = config.photographers.filter((p) => p.type === 'photo' && p.key !== 'none');

  const renderPhotographer = (p: (typeof videoPhotographers)[number], selected: boolean, onSelect: () => void) => {
    const isAny = p.key === 'any';
    return (
      <div
        key={p.key}
        className={popClass(selected)}
        onClick={onSelect}
      >
        {isAny ? (
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
          <div className="avatar" style={{ width: 38, height: 38, fontSize: 11, overflow: 'hidden' }}>
            {p.photo ? (
              <img
                src={p.photo}
                alt={p.name}
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              p.name.slice(0, 1)
            )}
          </div>
        )}
        <div className="pinfo">
          <div className="pname" style={{ fontSize: 12 }}>
            {isAny ? `0元 — ${p.name}` : p.name}
          </div>
          {!isAny && (
            <div className="prole">
              {p.role} {p.price.toLocaleString('zh-TW')}元
            </div>
          )}
          {!isAny && p.desc && <div className="pdesc">{p.desc}</div>}
          {!isAny && p.portfolio && (
            <a
              className="pportfolio"
              href={p.portfolio}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              查看作品集 ↗
            </a>
          )}
        </div>
      </div>
    );
  };

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

      {isV && (
        <div style={{ marginTop: 20 }}>
          <div className="col-h" style={{ marginBottom: 8 }}>
            <div className="col-h-zh" style={{ fontSize: 13 }}>指定動態錄影師</div>
          </div>
          <div className="pcard">
            {videoPhotographers.map((p) =>
              renderPhotographer(p, state.vpKey === p.key, () => update({ vpKey: p.key })),
            )}
          </div>
        </div>
      )}
      {isP && (
        <div style={{ marginTop: 20 }}>
          <div className="col-h" style={{ marginBottom: 8 }}>
            <div className="col-h-zh" style={{ fontSize: 13 }}>指定平面攝影師</div>
          </div>
          <div className="pcard">
            {photoPhotographers.map((p) =>
              renderPhotographer(p, state.ppKey === p.key, () => update({ ppKey: p.key })),
            )}
          </div>
        </div>
      )}
      <div className="note">如勾選不指定，則輪班安排老師檔期</div>
      <div className="sp" />
    </div>
  );
}
