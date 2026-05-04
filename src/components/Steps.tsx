type Props = { current: number; total: number };

export function Steps({ current, total }: Props) {
  return (
    <div className="steps">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const cls = idx < current ? 'dot done' : idx === current ? 'dot active' : 'dot';
        return <div key={idx} className={cls} />;
      })}
    </div>
  );
}
