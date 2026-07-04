/* ==========================================================================
   fluid-blob.js · RepoPilot 非线性流体特效
   SVG turbulence 滤镜 + 多个 blob 形状 + CSS keyframes 非线性缓动
   极轻量，60fps，性能友好
   ========================================================================== */

(function () {
  'use strict';
  if (window.__RP_FLUID__) return;
  window.__RP_FLUID__ = true;

  function init() {
    const stage = document.createElement('div');
    stage.className = 'fluid-stage';
    stage.setAttribute('aria-hidden', 'true');
    // SVG with turbulence + displacement（iOS 液态玻璃核心算法）
    stage.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <!-- 非线性湍流滤镜：高频基础 + 低频位移 = "流动感" -->
    <filter id="liquid" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="3" result="noise">
        <animate attributeName="baseFrequency"
          dur="22s"
          values="0.012 0.018; 0.018 0.012; 0.014 0.022; 0.012 0.018"
          repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" xChannelSelector="R" yChannelSelector="G">
        <animate attributeName="scale"
          dur="14s"
          values="80; 130; 60; 90; 80"
          repeatCount="indefinite"/>
      </feDisplacementMap>
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>

    <!-- 柔光滤镜：模糊混合，呈现"流体"质感 -->
    <filter id="soft">
      <feGaussianBlur stdDeviation="40"/>
    </filter>

    <!-- 4 个 blob 的渐变 -->
    <radialGradient id="g1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--fluid-c1)" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="var(--fluid-c1)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--fluid-c2)" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="var(--fluid-c2)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--fluid-c3)" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="var(--fluid-c3)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g4" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--fluid-c4)" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="var(--fluid-c4)" stop-opacity="0"/>
    </radialGradient>

    <!-- 高斯噪点纹理（细节） -->
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0"/>
    </filter>
  </defs>

  <!-- 底层：柔光 blob 群（慢速漂移） -->
  <g filter="url(#soft)" opacity="0.85">
    <ellipse cx="280" cy="220" rx="380" ry="320" fill="url(#g1)">
      <animate attributeName="cx" dur="28s" values="280; 420; 320; 200; 280" repeatCount="indefinite"/>
      <animate attributeName="cy" dur="32s" values="220; 180; 280; 240; 220" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="1180" cy="680" rx="420" ry="360" fill="url(#g2)">
      <animate attributeName="cx" dur="36s" values="1180; 1080; 1240; 1140; 1180" repeatCount="indefinite"/>
      <animate attributeName="cy" dur="30s" values="680; 720; 620; 700; 680" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="720" cy="500" rx="320" ry="280" fill="url(#g3)" opacity="0.6">
      <animate attributeName="cx" dur="40s" values="720; 820; 620; 720; 720" repeatCount="indefinite"/>
      <animate attributeName="cy" dur="34s" values="500; 440; 560; 480; 500" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="180" cy="780" rx="280" ry="240" fill="url(#g4)" opacity="0.7">
      <animate attributeName="cx" dur="38s" values="180; 280; 120; 200; 180" repeatCount="indefinite"/>
      <animate attributeName="cy" dur="42s" values="780; 720; 820; 760; 780" repeatCount="indefinite"/>
    </ellipse>
  </g>

  <!-- 顶层：液体湍流（应用 displacement filter） -->
  <g filter="url(#liquid)" opacity="0.55">
    <path d="M0,400 Q360,300 720,420 T1440,380 L1440,900 L0,900 Z" fill="url(#g1)">
      <animate attributeName="d"
        dur="20s"
        values="M0,400 Q360,300 720,420 T1440,380 L1440,900 L0,900 Z;
                M0,380 Q360,460 720,360 T1440,420 L1440,900 L0,900 Z;
                M0,440 Q360,360 720,440 T1440,360 L1440,900 L0,900 Z;
                M0,400 Q360,300 720,420 T1440,380 L1440,900 L0,900 Z"
        repeatCount="indefinite"/>
    </path>
    <path d="M0,600 Q480,540 960,620 T1440,580 L1440,900 L0,900 Z" fill="url(#g3)" opacity="0.5">
      <animate attributeName="d"
        dur="24s"
        values="M0,600 Q480,540 960,620 T1440,580 L1440,900 L0,900 Z;
                M0,620 Q480,700 960,580 T1440,640 L1440,900 L0,900 Z;
                M0,580 Q480,580 960,640 T1440,560 L1440,900 L0,900 Z;
                M0,600 Q480,540 960,620 T1440,580 L1440,900 L0,900 Z"
        repeatCount="indefinite"/>
    </path>
  </g>

  <!-- 噪点纹理（极轻覆盖） -->
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.4"/>
</svg>
`;
    document.body.prepend(stage);
  }

  // 等 DOM 就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();