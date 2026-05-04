import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  toDataURL: () => string;
  isEmpty: () => boolean;
};

type Props = { onChange?: (dataUrl: string) => void };

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad({ onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setup = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = 'rgba(200,190,255,0.9)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    setup();

    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const t = 'touches' in e ? e.touches[0] : (e as MouseEvent);
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    const down = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault();
      drawingRef.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return;
      if ('touches' in e) e.preventDefault();
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      dirtyRef.current = true;
    };
    const up = () => {
      if (drawingRef.current && dirtyRef.current) {
        onChange?.(canvas.toDataURL('image/png'));
      }
      drawingRef.current = false;
    };

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', up);
    canvas.addEventListener('mouseleave', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);

    const onResize = () => setup();
    window.addEventListener('resize', onResize);

    return () => {
      canvas.removeEventListener('mousedown', down);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', up);
      canvas.removeEventListener('mouseleave', up);
      canvas.removeEventListener('touchstart', down);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', up);
      window.removeEventListener('resize', onResize);
    };
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dirtyRef.current = false;
        onChange?.('');
      },
      toDataURL: () => (canvasRef.current ? canvasRef.current.toDataURL('image/png') : ''),
      isEmpty: () => !dirtyRef.current,
    }),
    [onChange],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 160,
        display: 'block',
        background: 'rgba(255,255,255,.04)',
        border: '1.5px solid rgba(255,255,255,.18)',
        borderRadius: 14,
        touchAction: 'none',
        cursor: 'crosshair',
      }}
    />
  );
});
