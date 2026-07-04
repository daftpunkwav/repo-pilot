import { useEffect, useRef } from 'react';
import { HERO_ART_POWDER_COLORS } from '@/constants/heroArtColors';

interface LetterCenter {
  x: number;
  y: number;
}

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
  targetX: number;
  targetY: number;
  wanderPhase: number;
  wanderSpeed: number;
  driftX: number;
  driftY: number;
}

const MAX_PARTICLES = 220;
const SPAWN_INTERVAL_MS = 75;

function pickColor(letterIndex: number): string {
  const palette = HERO_ART_POWDER_COLORS[letterIndex % HERO_ART_POWDER_COLORS.length] ?? ['#ffffff'];
  return palette[Math.floor(Math.random() * palette.length)] ?? '#ffffff';
}

/** 偏向相邻或随机其他字母，便于粉末飘到附近字形 */
function pickTargetIndex(fromIndex: number, total: number): number {
  if (total <= 1) return fromIndex;
  if (Math.random() < 0.62) {
    const offset = Math.random() < 0.5 ? -1 : 1;
    return Math.min(total - 1, Math.max(0, fromIndex + offset));
  }
  let target = fromIndex;
  while (target === fromIndex) {
    target = Math.floor(Math.random() * total);
  }
  return target;
}

function spawnParticle(
  rect: DOMRect,
  containerRect: DOMRect,
  letterIndex: number,
  centers: LetterCenter[],
): Particle {
  const x = rect.left - containerRect.left + Math.random() * rect.width;
  const y = rect.top - containerRect.top + Math.random() * rect.height * 0.7;
  const maxLife = 6 + Math.random() * 5;

  const targetIndex = pickTargetIndex(letterIndex, centers.length);
  const target = centers[targetIndex] ?? centers[letterIndex] ?? { x, y };
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy) || 1;
  const travel = 0.1 + Math.random() * 0.16;

  return {
    x,
    y,
    vx: (dx / dist) * travel * 0.45 + (Math.random() - 0.5) * 0.12,
    vy: (dy / dist) * travel * 0.18 + 0.03 + Math.random() * 0.07,
    size: 1.1 + Math.random() * 1.6,
    life: maxLife,
    maxLife,
    color: pickColor(letterIndex),
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.025,
    targetX: target.x,
    targetY: target.y,
    wanderPhase: Math.random() * Math.PI * 2,
    wanderSpeed: 0.35 + Math.random() * 0.9,
    driftX: (Math.random() - 0.5) * 0.04,
    driftY: 0.015 + Math.random() * 0.035,
  };
}

function collectLetterCenters(
  glyphs: NodeListOf<HTMLElement>,
  containerRect: DOMRect,
): LetterCenter[] {
  return Array.from(glyphs).map((glyph) => {
    const rect = glyph.getBoundingClientRect();
    return {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height * 0.45,
    };
  });
}

/**
 * Hero 艺术字粉末粒子：从各字母飘落对应色粉末，飘向邻近字母并长时间渐隐。
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
      const centers = collectLetterCenters(glyphs, containerRect);
      const pool = particlesRef.current;

      glyphs.forEach((glyph, index) => {
        const rect = glyph.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        const count = 2 + (Math.random() > 0.4 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          if (pool.length >= MAX_PARTICLES) pool.shift();
          pool.push(spawnParticle(rect, containerRect, index, centers));
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

        const toTargetX = p.targetX - p.x;
        const toTargetY = p.targetY - p.y;
        const age = p.maxLife - p.life;
        const wobbleX = Math.sin(age * p.wanderSpeed + p.wanderPhase) * 0.045;
        const wobbleY = Math.cos(age * p.wanderSpeed * 0.73 + p.wanderPhase * 1.3) * 0.032;

        p.vx += toTargetX * 0.00032 + wobbleX + p.driftX + (Math.random() - 0.5) * 0.004;
        p.vy += toTargetY * 0.00022 + wobbleY + p.driftY + (Math.random() - 0.5) * 0.003;

        if (Math.random() < 0.012) {
          p.vx += (Math.random() - 0.5) * 0.08;
          p.vy += (Math.random() - 0.5) * 0.06;
          p.wanderPhase += (Math.random() - 0.5) * 0.8;
        }

        p.vx *= 0.9992;
        p.vy *= 0.9994;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        const lifeRatio = p.life / p.maxLife;
        const fadeStart = 0.28;
        const alpha = lifeRatio >= fadeStart ? 0.88 : (lifeRatio / fadeStart) * 0.88;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 2;
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
