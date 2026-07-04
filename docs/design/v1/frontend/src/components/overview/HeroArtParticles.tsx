import { useEffect, useRef } from 'react';
import { HERO_ART_POWDER_COLORS } from '@/constants/heroArtColors';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  rotation: number;
  spin: number;
}

const MAX_PARTICLES = 120;
const SPAWN_INTERVAL_MS = 90;

function pickColor(letterIndex: number): string {
  const palette = HERO_ART_POWDER_COLORS[letterIndex % HERO_ART_POWDER_COLORS.length] ?? ['#ffffff'];
  return palette[Math.floor(Math.random() * palette.length)] ?? '#ffffff';
}

function spawnParticle(rect: DOMRect, containerRect: DOMRect, letterIndex: number): Particle {
  const x = rect.left - containerRect.left + Math.random() * rect.width;
  const y = rect.top - containerRect.top + Math.random() * rect.height * 0.65;
  const maxLife = 2.2 + Math.random() * 2.4;

  return {
    x,
    y,
    vx: (Math.random() - 0.35) * 0.55,
    vy: 0.25 + Math.random() * 0.65,
    size: 1.4 + Math.random() * 2.8,
    life: maxLife,
    maxLife,
    color: pickColor(letterIndex),
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.06,
  };
}

/**
 * Hero 艺术字粉末粒子：从各字母飘落对应色粉末，持续生成并渐隐。
 */
export function HeroArtParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const artRoot = canvas.closest('.overview-hero-art');
    const wrap = canvas.closest('.overview-hero-wrap');
    if (!artRoot || !wrap) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let lastTs = 0;

    const spawnBatch = () => {
      const glyphs = artRoot.querySelectorAll<HTMLElement>('.overview-hero-art-char-glyph');
      const containerRect = wrap.getBoundingClientRect();
      const pool = particlesRef.current;

      glyphs.forEach((glyph, index) => {
        const rect = glyph.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        const count = 1 + (Math.random() > 0.55 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          if (pool.length >= MAX_PARTICLES) pool.shift();
          pool.push(spawnParticle(rect, containerRect, index));
        }
      });
    };

    const tick = (ts: number) => {
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
      lastTs = ts;

      spawnTimerRef.current += dt * 1000;
      if (spawnTimerRef.current >= SPAWN_INTERVAL_MS) {
        spawnTimerRef.current = 0;
        spawnBatch();
      }

      const { width, height } = wrap.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      const pool = particlesRef.current;
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          pool.splice(i, 1);
          continue;
        }

        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += 0.012;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        const t = p.life / p.maxLife;
        const alpha = t * t * 0.85;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    spawnBatch();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      particlesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="overview-hero-particles"
      aria-hidden
    />
  );
}
