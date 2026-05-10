import { useEffect } from 'react';
import type { AppConfig, FormState, ServiceKey } from '../types';
import { Calendar } from './Calendar';
import { camerasLeft, cameraCount, videoFull, photoFull, ymd } from '../lib/bookings';

type Props = {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  config: AppConfig;
};

const optClass = (sel: boolean) => `opt${sel ? ' sel' : ''}`;
const sopClass = (sel: boolean, dis = false) => `sopt${sel ? ' sel' : ''}${dis ? ' dis' : ''}`;

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

  const dateKey = ymd(state.year, state.month, state.day);
  const vCamsLeft = camerasLeft(config, dateKey, 'video');
  const pCamsLeft = camerasLeft(config, dateKey, 'photo');
  const vFull = videoFull(config, dateKey);
  const pFull = photoFull(config, dateKey);

  const isCameraBlocked = (type: 'video' | 'photo', label: string): boolean => {
    if (!dateKey) return false;
    const need = cameraCount(label);
    if (need === 0) return false;
    const left = type === 'video' ? vCamsLeft : pCamsLeft;
    return need > left;
  };

  const onSvcChange = (svc: ServiceKey) => {
    // 若選了一個當日已滿的服務，視為無效；validation 會擋下一頁，這裡仍允許切換
    update({ svc });
  };

  // 換日期時，把現在這一天已不再可選的選擇清掉。
  // 例如：先在 5 號選了 video + 純宴客 + 二機，再切到 11 號（11 號 video 已滿），
  // 不清除的話 svc/vBanquet/vcKey 會殘留，UI 看起來像「video 還是選著」但實際已滿。
  useEffect(() => {
    if (!dateKey) return;
    const patch: Partial<FormState> = {};

    const dropV = vFull && (state.svc === 'video' || state.svc === 'both' || state.vBanquet || state.vcKey || state.vcerKey || state.vpKey);
    const dropP = pFull && (state.svc === 'photo' || state.svc === 'both' || state.pBanquet || state.pcKey || state.pcerKey || state.ppKey);

    if (dropV) {
      if (state.svc === 'video') patch.svc = '';
      else if (state.svc === 'both') patch.svc = 'photo';
      patch.vBanquet = false;
      patch.vcKey = '';
      patch.vcerKey = '';
      patch.vpKey = '';
    }
    if (dropP) {
      if (state.svc === 'photo') patch.svc = '';
      else if (state.svc === 'both') patch.svc = patch.svc === 'photo' ? '' : 'video';
      patch.pBanquet = false;
      patch.pcKey = '';
      patch.pcerKey = '';
      patch.ppKey = '';
    }

    // 機位：若先前選的台數現在超出當日剩餘機位，也清掉
    if (!dropV && state.vcKey) {
      const vcLabel = videoCams.find((c) => c.key === state.vcKey)?.label ?? '';
      if (isCameraBlocked('video', vcLabel)) patch.vcKey = '';
    }
    if (!dropP && state.pcKey) {
      const pcLabel = photoCams.find((c) => c.key === state.pcKey)?.label ?? '';
      if (isCameraBlocked('photo', pcLabel)) patch.pcKey = '';
    }

    if (Object.keys(patch).length > 0) update(patch);
    // 只看 dateKey + 該日是否滿；其他 state 故意不放 deps 避免 loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, vFull, pFull]);

  return (
    <div className="page active">
      <div className="stitle">
        <div className="stitle-zh">活 動 日 期</div>
        <div className="stitle-en">Event Date</div>
      </div>
      <Calendar
        config={config}
        year={state.year}
        month={state.month}
        day={state.day}
        onPick={(y, m, d) => update({ year: y, month: m, day: d })}
      />

      <div className="stitle" style={{ marginTop: 16 }}>
        <div className="stitle-zh">服 務 選 項</div>
        <div className="stitle-en">Services</div>
      </div>
      <div className="card">
        {config.services.map((s) => {
          const blocked =
            (s.key === 'video' && vFull) ||
            (s.key === 'photo' && pFull) ||
            (s.key === 'both' && (vFull || pFull));
          const cls = `${optClass(state.svc === s.key)}${blocked ? ' dis' : ''}`;
          return (
            <div
              key={s.key}
              className={cls}
              onClick={blocked ? undefined : () => onSvcChange(s.key as ServiceKey)}
              aria-disabled={blocked}
            >
              <div className="rc">
                <div className="rd" />
              </div>
              <div className="opt-t">{s.label}{blocked && <span className="badge-full">當日已滿</span>}</div>
            </div>
          );
        })}
      </div>

      {(isV || isP) && (
        <div className="g2" style={{ marginTop: 18 }}>
          {isV && (
            <div>
              <div className="col-h" style={{ marginBottom: 8 }}>
                <div className="col-h-zh">錄 影 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Video recording</div>
              </div>
              <div className="card">
                <div
                  className={optClass(state.vBanquet)}
                  onClick={() => update({ vBanquet: !state.vBanquet })}
                >
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
                <div className="col-h-zh">拍 照 <span className="col-h-req">必選</span></div>
                <div className="col-h-en">Photography</div>
              </div>
              <div className="card">
                <div
                  className={optClass(state.pBanquet)}
                  onClick={() => update({ pBanquet: !state.pBanquet })}
                >
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
                {videoCams.map((c) => {
                  const blocked = isCameraBlocked('video', c.label);
                  return (
                    <div
                      key={c.key}
                      className={sopClass(state.vcKey === c.key, blocked)}
                      onClick={blocked ? undefined : () => update({ vcKey: c.key })}
                      aria-disabled={blocked}
                    >
                      <div className="src">
                        <div className="srd" />
                      </div>
                      <div className="sopt-t">
                        {c.label} {c.price.toLocaleString('zh-TW')}元
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {isP && (
              <div className={`card${onlyP ? ' col-right' : ''}`}>
                {photoCams.map((c) => {
                  const blocked = isCameraBlocked('photo', c.label);
                  return (
                    <div
                      key={c.key}
                      className={sopClass(state.pcKey === c.key, blocked)}
                      onClick={blocked ? undefined : () => update({ pcKey: c.key })}
                      aria-disabled={blocked}
                    >
                      <div className="src">
                        <div className="srd" />
                      </div>
                      <div className="sopt-t">
                        {c.label} {c.price.toLocaleString('zh-TW')}元
                      </div>
                    </div>
                  );
                })}
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
