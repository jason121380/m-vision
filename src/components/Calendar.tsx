import { useMemo, useState } from 'react';
import type { AppConfig } from '../types';
import { dayFullyBlocked, ymd } from '../lib/bookings';

type Props = {
  config: AppConfig;
  year: string;
  month: string;
  day: string;
  onPick: (year: string, month: string, day: string) => void;
};

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const todayKey = () => {
  const t = new Date();
  return ymd(String(t.getFullYear()), String(t.getMonth() + 1), String(t.getDate()));
};

export function Calendar({ config, year, month, day, onPick }: Props) {
  const initialDate = useMemo(() => {
    if (year && month) return new Date(Number(year), Number(month) - 1, 1);
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, [year, month]);

  const [view, setView] = useState(initialDate);
  const today = todayKey();
  const selected = ymd(year, month, day);

  const viewYear = view.getFullYear();
  const viewMonth = view.getMonth(); // 0-indexed
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => setView(new Date(viewYear, viewMonth - 1, 1));
  const goNext = () => setView(new Date(viewYear, viewMonth + 1, 1));

  const monthLimitMin = (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  })();
  const canGoPrev = view.getTime() > monthLimitMin.getTime();

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className={`cal-nav${canGoPrev ? '' : ' dis'}`}
          onClick={canGoPrev ? goPrev : undefined}
          aria-label="上個月"
        >
          ‹
        </button>
        <div className="cal-title">
          <span className="cal-year">{viewYear}</span>
          <span className="cal-month">{viewMonth + 1} 月</span>
        </div>
        <button type="button" className="cal-nav" onClick={goNext} aria-label="下個月">
          ›
        </button>
      </div>
      <div className="cal-week">
        {WEEK.map((w) => (
          <div key={w} className="cal-w">{w}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-cell empty" />;
          const key = ymd(String(viewYear), String(viewMonth + 1), String(d));
          const isPast = key < today;
          const isToday = key === today;
          const isSel = key === selected;
          const isBlocked = dayFullyBlocked(config, key);
          const disabled = isPast || isBlocked;
          let cls = 'cal-cell';
          if (disabled) cls += ' dis';
          if (isToday) cls += ' today';
          if (isSel) cls += ' sel';
          if (isBlocked) cls += ' blocked';
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={disabled}
              onClick={() => onPick(String(viewYear), String(viewMonth + 1), String(d))}
            >
              <span>{d}</span>
              {isBlocked && <span className="cal-x">×</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
