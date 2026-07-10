import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  rot: number; vr: number;
  color: string;
  life: number;
}

const COLORS = ['#2d6a4f', '#52b788', '#d4a373', '#e9c46a', '#f4a261', '#e76f51', '#457b9d'];

/**
 * Lightweight dependency-free confetti burst. Re-fires every time `trigger`
 * changes value (e.g. an incrementing counter). Renders a fixed, click-through
 * full-screen canvas only while particles are alive.
 */
const Confetti: React.FC<{ trigger: number; count?: number }> = ({ trigger, count = 90 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    // Don't fire on initial mount (trigger starts at 0).
    if (firstRun.current) { firstRun.current = false; return; }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Spawn a fresh burst from the top-center.
    const originX = w / 2;
    const originY = h * 0.22;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 4 + Math.random() * 7;
      particlesRef.current.push({
        x: originX + (Math.random() - 0.5) * 80,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
      });
    }

    const gravity = 0.18;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      const ps = particlesRef.current;
      for (const p of ps) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.008;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      particlesRef.current = ps.filter(p => p.life > 0 && p.y < h + 40);
      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };

    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [trigger, count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[200] pointer-events-none"
      aria-hidden="true"
    />
  );
};

export default Confetti;
