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
  const onChangeRef = useRef(onChange);

  // Keep latest onChange in a ref so the setup effect below can stay stable
  // (re-running setup() resets the canvas and would erase the user's signature).
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      ctx.strokeStyle = '#1a1a1a';
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
        onChangeRef.current?.(canvas.toDataURL('image/png'));
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
  }, []);

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
        onChangeRef.current?.('');
      },
      toDataURL: () => (canvasRef.current ? canvasRef.current.toDataURL('image/png') : ''),
      isEmpty: () => !dirtyRef.current,
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 180,
        display: 'block',
        background: '#fff',
        border: '1.5px solid rgba(0,0,0,.2)',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        touchAction: 'none',
        cursor: 'crosshair',
      }}
    />
  );
});
