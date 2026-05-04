import { useEffect, useRef } from 'react';

export function StarsBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      ctx.clearRect(0, 0, c.width, c.height);
      const seed = 42;
      const rnd = (n: number) => {
        const x = Math.sin(n + seed) * 10000;
        return x - Math.floor(x);
      };
      for (let i = 0; i < 200; i++) {
        const x = rnd(i * 3) * c.width;
        const y = rnd(i * 3 + 1) * c.height;
        const r = rnd(i * 3 + 2) * 1.2 + 0.2;
        const a = rnd(i * 3 + 0.5) * 0.5 + 0.1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return (
    <>
      <canvas id="stars" ref={ref} />
      <div className="nebula" />
    </>
  );
}
