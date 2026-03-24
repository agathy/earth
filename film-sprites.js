/**
 * film-sprites.js — 女性电影海报叠加层
 * 原理：用 Three.js 相机矩阵将每部电影的 3D 球面坐标投影到 2D 屏幕，
 *       用 CSS div 渲染海报卡片，无需访问 THREE 类。
 */
(function () {
  'use strict';

  const GLOBE_RADIUS = 300;
  const DEG = Math.PI / 180;

  // ── 从 femaleDirectorsMovies 动态生成电影列表 ────────────────────────────
  const COUNTRY_COLORS = {
    '中国': '#e8341c', '中国香港': '#c0392b', '中国台湾': '#e74c3c',
    '美国': '#2980b9', '英国': '#8e44ad', '法国': '#27ae60', '德国': '#f39c12',
    '意大利': '#16a085', '西班牙': '#d35400', '韩国': '#1abc9c', '日本': '#e74c3c',
    '印度': '#f39c12', '泰国': '#27ae60', '瑞典': '#2c3e50', '丹麦': '#7f8c8d',
    '挪威': '#34495e', '波兰': '#c0392b', '捷克': '#2980b9', '匈牙利': '#8e44ad',
    '罗马尼亚': '#16a085', '新西兰': '#7f8c8d', '澳大利亚': '#f39c12',
    '比利时': '#e67e22', '黎巴嫩': '#27ae60',
  };
  function getColor(countries) {
    for (var i = 0; i < (countries || []).length; i++) {
      for (var k in COUNTRY_COLORS) {
        if (countries[i].indexOf(k) >= 0) return COUNTRY_COLORS[k];
      }
    }
    return '#95a5a6';
  }

  const MOVIES = (window.femaleDirectorsMovies || []).map(function (m, i) {
    return {
      id: i + 1,
      title: m.name,
      director: m.director || '',
      year: m.year || 0,
      rating: parseFloat(m.rating) || 0,
      lat: m._jlat != null ? m._jlat : m.latitude,
      lon: m._jlon != null ? m._jlon : m.longitude,
      color: getColor(m.countries_regions),
    };
  });

  // ── 球面坐标 → 3D 局部坐标 ─────────────────────────────────────────────
  function latLonToLocal(lat, lon, r) {
    const e = lat * DEG, i = lon * DEG;
    // 与 Language Explorer Jn() 相同：x=R·cos(lat)·cos(lon), y=R·cos(lat)·sin(lon), z=R·sin(lat)
    return [
      r * Math.cos(e) * Math.cos(i),
      r * Math.cos(e) * Math.sin(i),
      r * Math.sin(e)
    ];
  }

  // ── 矩阵乘法：4x4(列优先) × vec4 ─────────────────────────────────────
  function mulMat4Vec4(m, x, y, z, w) {
    return [
      m[0]*x + m[4]*y + m[8]*z  + m[12]*w,
      m[1]*x + m[5]*y + m[9]*z  + m[13]*w,
      m[2]*x + m[6]*y + m[10]*z + m[14]*w,
      m[3]*x + m[7]*y + m[11]*z + m[15]*w,
    ];
  }

  // ── 3D → 2D 屏幕投影 ─────────────────────────────────────────────────
  function project(localPos, rootGroup, camera, canvasRect) {
    // Step1: local → world（rootGroup.matrixWorld）
    const wm = rootGroup.matrixWorld.elements;
    let [wx, wy, wz, ww] = mulMat4Vec4(wm, localPos[0], localPos[1], localPos[2], 1);
    // Step2: world → view（camera.matrixWorldInverse）
    const vm = camera.matrixWorldInverse.elements;
    let [ex, ey, ez, ew] = mulMat4Vec4(vm, wx, wy, wz, ww);
    // Step3: view → clip（camera.projectionMatrix）
    const pm = camera.projectionMatrix.elements;
    let [cx, cy, cz, cw] = mulMat4Vec4(pm, ex, ey, ez, ew);
    if (cw === 0) return null;
    // NDC
    const ndcX = cx / cw, ndcY = cy / cw, ndcZ = cz / cw;
    // 点在视锥体外或在相机背后
    if (ndcZ > 1.0 || cw < 0) return null;
    // 屏幕坐标
    return {
      x: (ndcX + 1) / 2 * canvasRect.width,
      y: (1 - ndcY) / 2 * canvasRect.height,
      depth: ndcZ  // 0=近, 1=远，用于控制大小和透明度
    };
  }

  // ── 创建 CSS 海报卡片 ─────────────────────────────────────────────────
  function createPosterCard(movie) {
    const card = document.createElement('div');
    card.className = 'film-poster';
    card.dataset.id = movie.id;
    card.innerHTML = `
      <div class="fp-accent" style="background:${movie.color}"></div>
      <div class="fp-body">
        <div class="fp-title">${movie.title}</div>
        <div class="fp-meta">${movie.director}</div>
        <div class="fp-year">${movie.year}</div>
      </div>
      <div class="fp-rating">${movie.rating}</div>
    `;
    return card;
  }

  // ── 注入样式 ───────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #film-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 10;
        overflow: hidden;
      }
      .film-poster {
        position: absolute;
        width: 54px;
        background: rgba(8,12,28,0.88);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 4px;
        overflow: hidden;
        transform: translate(-50%, -50%);
        transition: opacity 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
      }
      .fp-accent {
        height: 3px;
        width: 100%;
      }
      .fp-body {
        padding: 3px 4px 4px;
      }
      .fp-title {
        font-family: sans-serif;
        font-size: 8px;
        font-weight: bold;
        color: #fff;
        line-height: 1.2;
        max-height: 2.4em;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fp-meta {
        font-family: sans-serif;
        font-size: 6.5px;
        color: rgba(255,255,255,0.55);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp-year {
        font-size: 6px;
        color: rgba(255,255,255,0.35);
        margin-top: 1px;
      }
      .fp-rating {
        position: absolute;
        top: 3px;
        right: 3px;
        font-size: 7px;
        font-weight: bold;
        color: #f1c40f;
        font-family: sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  // ── 主初始化 ─────────────────────────────────────────────────────────
  function init() {
    const { scene, camera, renderer, getRoot } = window._rleGlobe;
    const canvas = renderer.domElement;

    injectStyles();

    // 创建叠加容器
    const overlay = document.createElement('div');
    overlay.id = 'film-overlay';
    document.body.appendChild(overlay);

    // 预计算每部电影的本地坐标
    const movieLocalPositions = MOVIES.map(m => ({
      movie: m,
      local: latLonToLocal(m.lat, m.lon, GLOBE_RADIUS + 12),
      el: createPosterCard(m)
    }));
    movieLocalPositions.forEach(({ el }) => overlay.appendChild(el));

    // ── 点击过滤：只允许点击有电影点位的区域 ─────────────────────────────
    canvas.addEventListener('click', function (e) {
      const rootGroup = getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 找到屏幕上最近的电影粒子距离
      let minDist = Infinity;
      for (const entry of movieLocalPositions) {
        const sc = project(entry.local, rootGroup, camera, rect);
        if (!sc) continue;
        const dx = clickX - sc.x;
        const dy = clickY - sc.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }

      // 超过 80px 则阻止 Language Explorer 的点击事件（它用冒泡，capture 先于它）
      if (minDist > 80) {
        e.stopImmediatePropagation();
        canvas.style.cursor = 'default';
      }
    }, true); // capture 阶段

    // 鼠标移动：距离有点位的区域 80px 内时变为 pointer 光标
    canvas.addEventListener('mousemove', function (e) {
      const rootGroup = getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let minDist = Infinity;
      for (const entry of movieLocalPositions) {
        const sc = project(entry.local, rootGroup, camera, rect);
        if (!sc) continue;
        const dx = mx - sc.x;
        const dy = my - sc.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      canvas.style.cursor = minDist <= 80 ? 'pointer' : 'default';
    });

    // 动画循环：每帧更新海报位置
    function tick() {
      requestAnimationFrame(tick);
      const rootGroup = getRoot();
      // 确保矩阵已更新
      if (!rootGroup || !rootGroup.matrixWorld) return;

      const rect = canvas.getBoundingClientRect();

      movieLocalPositions.forEach(({ local, el, movie }) => {
        const sc = project(local, rootGroup, camera, rect);
        if (!sc) {
          el.style.opacity = '0';
          return;
        }
        // 深度影响透明度和缩放
        const depthFade = 1 - sc.depth * 0.5;
        const scale = 0.6 + depthFade * 0.6;
        el.style.opacity = (depthFade * 0.9).toFixed(2);
        el.style.left = (rect.left + sc.x) + 'px';
        el.style.top  = (rect.top  + sc.y) + 'px';
        el.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
        el.style.zIndex = Math.round(depthFade * 100);
      });
    }
    tick();
    console.log('[film-sprites] CSS overlay running for', MOVIES.length, 'movies');
  }

  // ── 等待 _rleGlobe 就绪 ───────────────────────────────────────────────
  function waitAndInit(tries = 0) {
    if (window._rleGlobe?.scene && window._rleGlobe?.getRoot) {
      // 再等一帧确保 rootGroup 已加入 scene
      setTimeout(init, 500);
    } else if (tries < 300) {
      setTimeout(() => waitAndInit(tries + 1), 100);
    }
  }
  waitAndInit();
})();
