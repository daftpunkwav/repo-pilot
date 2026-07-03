/* ==========================================================================
   particles-bg.js · RepoPilot 高级质感粒子背景系统
   基于 p5.js · 鼠标交互式粒子 + 流场 + 连线
   性能优化：DPR-aware，闲置暂停
   ========================================================================== */

(function () {
  'use strict';

  // 仅在支持 backdrop-filter 的现代浏览器启用（玻璃视觉依赖）
  if (!('backdropFilter' in document.body.style) && !('webkitBackdropFilter' in document.body.style)) {
    // 降级方案：纯静态渐变背景
    document.body.style.background = 'linear-gradient(135deg, #e8f2ff 0%, #f7f7fa 50%, #e9f9ee 100%)';
    return;
  }

  // 防止重复加载
  if (window.__RP_PARTICLES__) return;
  window.__RP_PARTICLES__ = true;

  // 加载 p5.js (从 CDN, 失败则降级)
  function loadP5() {
    return new Promise((resolve, reject) => {
      if (window.p5) return resolve(window.p5);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js';
      s.onload = () => resolve(window.p5);
      s.onerror = () => reject(new Error('p5.js load failed'));
      document.head.appendChild(s);
    });
  }

  // 算法哲学：Hyperreal Turbulence（超真实湍流）
  // ----------------------------------------------------------------
  // 思想：让粒子既"受控"又"自由"。通过 Perlin 流场引导方向，
  //       通过鼠标引力创造局部风暴。粒子具备"年龄"与"寿命"，
  //       形成涌现的星云式轨迹。视觉上呈现"高级 Apple 质感"：
  //       颗粒细腻、连线克制、色彩与背景液态 blob 协调。
  // ----------------------------------------------------------------

  loadP5().then((p5lib) => {
    const sketch = (p) => {
      // ---------- 配置（用户可调） ----------
      const CONFIG = {
        particleCount: 90,        // 粒子数量（性能友好）
        particleSize: 1.4,         // 基础尺寸
        noiseScale: 0.0015,        // Perlin 噪声尺度
        noiseStrength: 1.4,        // 流场强度
        maxSpeed: 1.3,             // 最大速度
        mouseRadius: 200,          // 鼠标影响半径
        mouseForce: 0.6,           // 鼠标推力
        linkDistance: 110,         // 连线最大距离
        linkOpacity: 0.18,         // 连线透明度
        bgFadeAlpha: 0.0001,       // 背景拖尾 alpha（0=无拖尾）
        colors: {
          particle: 'rgba(0, 122, 255, 0.6)',
          particleBright: 'rgba(94, 92, 230, 0.9)',
          link: '0, 122, 255',     // rgb 字符串
          linkSecondary: '94, 92, 230'
        }
      };

      let particles = [];
      let mouse = { x: -9999, y: -9999, active: false };
      let lastInteraction = Date.now();
      let isVisible = true;

      // ---------- 粒子类 ----------
      class Particle {
        constructor() {
          this.pos = p.createVector(p.random(p.width), p.random(p.height));
          this.vel = p.createVector(0, 0);
          this.acc = p.createVector(0, 0);
          this.baseSize = p.random(CONFIG.particleSize * 0.6, CONFIG.particleSize * 1.6);
          this.size = this.baseSize;
          this.life = p.random(150, 400);
          this.maxLife = this.life;
          this.seed = p.random(1000);
          // 用颜色略微变化，体现"高级质感"
          this.hueShift = p.random(-20, 20);
        }

        applyForce(f) {
          this.acc.add(f);
        }

        // 流场跟随 Perlin 噪声
        followFlow() {
          const angle = p.noise(
            this.pos.x * CONFIG.noiseScale,
            this.pos.y * CONFIG.noiseScale,
            this.seed
          ) * p.TWO_PI * 2.5;
          const force = p.createVector(Math.cos(angle), Math.sin(angle));
          force.mult(CONFIG.noiseStrength);
          this.applyForce(force);
        }

        // 鼠标交互（推力 + 吸引）
        interactWithMouse() {
          if (!mouse.active) return;
          const dir = p.createVector(this.pos.x - mouse.x, this.pos.y - mouse.y);
          const dist = dir.mag();
          if (dist < CONFIG.mouseRadius && dist > 0) {
            dir.normalize();
            // 在内圈吸引，外圈排斥，制造湍流感
            const t = 1 - dist / CONFIG.mouseRadius;
            const force = (dist < CONFIG.mouseRadius * 0.4 ? 0.4 : -0.3) * t;
            dir.mult(force * CONFIG.mouseForce);
            this.applyForce(dir);
          }
        }

        update() {
          this.vel.add(this.acc);
          this.vel.limit(CONFIG.maxSpeed);
          this.pos.add(this.vel);
          this.acc.mult(0);

          // 边界回弹（带柔和过渡）
          const margin = 50;
          if (this.pos.x < -margin) this.pos.x = p.width + margin;
          if (this.pos.x > p.width + margin) this.pos.x = -margin;
          if (this.pos.y < -margin) this.pos.y = p.height + margin;
          if (this.pos.y > p.height + margin) this.pos.y = -margin;

          this.life--;
          if (this.life <= 0) this.respawn();
        }

        respawn() {
          this.pos.set(p.random(p.width), p.random(p.height));
          this.vel.set(0, 0);
          this.life = p.random(150, 400);
          this.maxLife = this.life;
          this.seed = p.random(1000);
        }

        draw() {
          const alpha = Math.min(1, this.life / 60) * Math.min(1, this.maxLife / 60);
          const r = this.baseSize;
          // 渐变填充（中心亮，边缘淡）
          const grad = p.drawingContext.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, r * 4);
          grad.addColorStop(0, `rgba(${CONFIG.colors.link}, ${0.7 * alpha})`);
          grad.addColorStop(0.5, `rgba(${CONFIG.colors.link}, ${0.18 * alpha})`);
          grad.addColorStop(1, `rgba(${CONFIG.colors.link}, 0)`);
          p.drawingContext.fillStyle = grad;
          p.drawingContext.beginPath();
          p.drawingContext.arc(this.pos.x, this.pos.y, r * 4, 0, Math.PI * 2);
          p.drawingContext.fill();

          // 中心高光点
          p.drawingContext.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
          p.drawingContext.beginPath();
          p.drawingContext.arc(this.pos.x, this.pos.y, r * 0.5, 0, Math.PI * 2);
          p.drawingContext.fill();
        }
      }

      // ---------- p5 lifecycle ----------
      p.setup = function () {
        const stage = document.querySelector('.particle-stage') || document.body;
        const canvas = p.createCanvas(stage.offsetWidth || window.innerWidth, stage.offsetHeight || window.innerHeight);
        canvas.parent(stage);
        canvas.elt.style.position = 'fixed';
        canvas.elt.style.inset = '0';
        canvas.elt.style.zIndex = '0';
        canvas.elt.style.pointerEvents = 'none';
        canvas.elt.style.opacity = '0.85';
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));

        for (let i = 0; i < CONFIG.particleCount; i++) {
          particles.push(new Particle());
        }

        window.addEventListener('mousemove', (e) => {
          mouse.x = e.clientX;
          mouse.y = e.clientY;
          mouse.active = true;
          lastInteraction = Date.now();
        });
        window.addEventListener('mouseleave', () => { mouse.active = false; mouse.x = -9999; });
        window.addEventListener('touchmove', (e) => {
          if (e.touches[0]) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouse.active = true;
            lastInteraction = Date.now();
          }
        });

        // 可见性暂停（节流）
        document.addEventListener('visibilitychange', () => {
          isVisible = !document.hidden;
          if (isVisible) p.loop();
        });

        // 闲置后降低强度
        setInterval(() => {
          if (Date.now() - lastInteraction > 8000) mouse.active = false;
        }, 1000);

        p.noStroke();
      };

      p.draw = function () {
        // 极轻拖尾（保留微弱残影，强化"液态"感）
        p.drawingContext.fillStyle = `rgba(247, 247, 250, ${CONFIG.bgFadeAlpha})`;
        p.drawingContext.fillRect(0, 0, p.width, p.height);

        // 更新 + 绘制连线（按距离衰减）
        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          a.followFlow();
          a.interactWithMouse();
          a.update();
          // 只对附近粒子连线，避免 O(n²)
          for (let j = i + 1; j < particles.length; j++) {
            const b = particles[j];
            const dx = a.pos.x - b.pos.x;
            const dy = a.pos.y - b.pos.y;
            const d2 = dx * dx + dy * dy;
            const maxD = CONFIG.linkDistance;
            if (d2 < maxD * maxD) {
              const d = Math.sqrt(d2);
              const opacity = (1 - d / maxD) * CONFIG.linkOpacity;
              p.drawingContext.strokeStyle = `rgba(${CONFIG.colors.link}, ${opacity})`;
              p.drawingContext.lineWidth = 0.6;
              p.drawingContext.beginPath();
              p.drawingContext.moveTo(a.pos.x, a.pos.y);
              p.drawingContext.lineTo(b.pos.x, b.pos.y);
              p.drawingContext.stroke();
            }
          }
          a.draw();
        }

        // 鼠标光晕（额外视觉强化）
        if (mouse.active) {
          const grad = p.drawingContext.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
          grad.addColorStop(0, 'rgba(0, 122, 255, 0.06)');
          grad.addColorStop(1, 'rgba(0, 122, 255, 0)');
          p.drawingContext.fillStyle = grad;
          p.drawingContext.beginPath();
          p.drawingContext.arc(mouse.x, mouse.y, 80, 0, Math.PI * 2);
          p.drawingContext.fill();
        }
      };

      p.windowResized = function () {
        const stage = document.querySelector('.particle-stage') || document.body;
        p.resizeCanvas(stage.offsetWidth || window.innerWidth, stage.offsetHeight || window.innerHeight);
      };
    };

    new p5lib(sketch);
  }).catch(() => {
    // 降级：纯渐变背景
    document.body.style.background = 'radial-gradient(ellipse at top left, var(--fluid-c1), transparent 50%), radial-gradient(ellipse at bottom right, var(--fluid-c2), transparent 50%), var(--bg-200)';
  });
})();