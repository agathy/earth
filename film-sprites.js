/**
 * film-sprites.js — 女性电影海报叠加层（含封面图）
 * 平时：小圆形海报缩略图跟随球面点位
 * Hover：展开完整海报卡片
 */
(function () {
  'use strict';

  const GLOBE_RADIUS = 300;
  const DEG = Math.PI / 180;

  // ── 从链接提取海报路径 ────────────────────────────────────────────────
  function getPosterPath(link) {
    if (!link) return null;
    var m = link.match(/douban\.com\/subject\/(\d+)/);
    if (m) return './assets/movie-posters/' + m[1] + '.jpg';
    m = link.match(/imdb\.com\/title\/(tt\w+)/);
    if (m) return './assets/movie-posters/' + m[1] + '.jpg';
    return null;
  }

  // ── 国家颜色 ──────────────────────────────────────────────────────────
  const COUNTRY_COLORS = {
    '中国': '#e8341c', '中国香港': '#c0392b', '中国台湾': '#e74c3c',
    '美国': '#2980b9', '英国': '#8e44ad', '法国': '#27ae60', '德国': '#f39c12',
    '意大利': '#16a085', '西班牙': '#d35400', '韩国': '#1abc9c', '日本': '#e74c3c',
    '印度': '#f39c12', '澳大利亚': '#f39c12', '比利时': '#e67e22', '黎巴嫩': '#27ae60',
    '丹麦': '#7f8c8d', '挪威': '#34495e', '波兰': '#c0392b', '捷克': '#2980b9',
    '新西兰': '#7f8c8d', '阿根廷': '#3498db', '突尼斯': '#e74c3c', '肯尼亚': '#27ae60',
    '加拿大': '#e74c3c', '爱尔兰': '#27ae60', '奥地利': '#c0392b',
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
      poster: getPosterPath(m.link),
    };
  });

  // ── 球面坐标 → 3D 局部坐标 ───────────────────────────────────────────
  function latLonToLocal(lat, lon, r) {
    const e = lat * DEG, i = lon * DEG;
    return [
      r * Math.cos(e) * Math.cos(i),
      r * Math.cos(e) * Math.sin(i),
      r * Math.sin(e)
    ];
  }

  // ── 矩阵乘法 ─────────────────────────────────────────────────────────
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
    const wm = rootGroup.matrixWorld.elements;
    let [wx, wy, wz, ww] = mulMat4Vec4(wm, localPos[0], localPos[1], localPos[2], 1);
    const vm = camera.matrixWorldInverse.elements;
    let [ex, ey, ez, ew] = mulMat4Vec4(vm, wx, wy, wz, ww);
    const pm = camera.projectionMatrix.elements;
    let [cx, cy, cz, cw] = mulMat4Vec4(pm, ex, ey, ez, ew);
    if (cw === 0) return null;
    const ndcX = cx / cw, ndcY = cy / cw, ndcZ = cz / cw;
    if (ndcZ > 1.0 || cw < 0) return null;
    return {
      x: (ndcX + 1) / 2 * canvasRect.width,
      y: (1 - ndcY) / 2 * canvasRect.height,
      depth: ndcZ
    };
  }

  // ── 创建海报元素 ───────────────────────────────────────────────────────
  function createPosterEl(movie) {
    const wrap = document.createElement('div');
    wrap.className = 'fp-wrap';
    wrap.dataset.id = movie.id;

    // 缩略图（始终可见）
    const thumb = document.createElement('div');
    thumb.className = 'fp-thumb';
    thumb.style.borderColor = movie.color;

    if (movie.poster) {
      const img = document.createElement('img');
      img.src = movie.poster;
      img.alt = movie.title;
      img.draggable = false;
      thumb.appendChild(img);
    } else {
      // 无海报：显示首字
      thumb.textContent = movie.title.charAt(0);
      thumb.style.background = movie.color;
      thumb.style.color = '#fff';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';
      thumb.style.fontSize = '14px';
      thumb.style.fontWeight = 'bold';
    }

    // 展开卡片（hover 时显示）
    const card = document.createElement('div');
    card.className = 'fp-card';

    if (movie.poster) {
      const bigImg = document.createElement('img');
      bigImg.src = movie.poster;
      bigImg.alt = movie.title;
      bigImg.className = 'fp-big-img';
      bigImg.draggable = false;
      card.appendChild(bigImg);
    }

    const info = document.createElement('div');
    info.className = 'fp-info';
    info.innerHTML =
      '<div class="fp-title">' + movie.title + '</div>' +
      '<div class="fp-director">' + movie.director + '</div>' +
      '<div class="fp-foot">' +
        '<span class="fp-year">' + movie.year + '</span>' +
        (movie.rating ? '<span class="fp-rating">★ ' + movie.rating.toFixed(1) + '</span>' : '') +
      '</div>';
    card.appendChild(info);

    wrap.appendChild(thumb);
    wrap.appendChild(card);
    return wrap;
  }

  // ── 样式注入 ──────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #film-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 10006;
        overflow: hidden;
      }

      /* 每个电影点的容器 */
      .fp-wrap {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        cursor: pointer;
      }

      /* 缩略图（圆形海报） */
      .fp-thumb {
        width: 36px;
        height: 50px;
        border-radius: 4px;
        border: 2px solid #fff;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        background: #1a1a2e;
      }
      .fp-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        pointer-events: none;
      }

      /* hover 时缩略图放大 */
      .fp-wrap:hover .fp-thumb {
        transform: scale(1.15);
        box-shadow: 0 4px 16px rgba(0,0,0,0.8);
      }

      /* 展开卡片（hover 显示） */
      .fp-card {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        width: 110px;
        background: rgba(8,12,28,0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        pointer-events: none;
        opacity: 0;
        transform: translateX(-50%) translateY(4px);
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .fp-wrap:hover .fp-card {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* 卡片内的大图 */
      .fp-big-img {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        display: block;
      }

      /* 卡片文字区 */
      .fp-info {
        padding: 5px 6px 6px;
      }
      .fp-title {
        font-family: 'Noto Sans SC', sans-serif;
        font-size: 9.5px;
        font-weight: bold;
        color: #fff;
        line-height: 1.3;
        margin-bottom: 2px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .fp-director {
        font-family: sans-serif;
        font-size: 7.5px;
        color: rgba(255,255,255,0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }
      .fp-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .fp-year {
        font-size: 7px;
        color: rgba(255,255,255,0.35);
      }
      .fp-rating {
        font-size: 8px;
        font-weight: bold;
        color: #f1c40f;
      }
    `;
    document.head.appendChild(style);
  }

  // ── 主初始化 ──────────────────────────────────────────────────────────
  function init() {
    const { scene, camera, renderer, getRoot } = window._rleGlobe;
    const canvas = renderer.domElement;

    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'film-overlay';
    document.body.appendChild(overlay);

    // 预计算每部电影的本地坐标，创建海报元素
    const entries = MOVIES.map(m => ({
      movie: m,
      local: latLonToLocal(m.lat, m.lon, GLOBE_RADIUS + 12),
      el: createPosterEl(m)
    }));
    entries.forEach(({ el }) => overlay.appendChild(el));

    // ── 点击过滤：只允许点击有电影点位的区域 ───────────────────────────
    canvas.addEventListener('click', function (e) {
      const rootGroup = getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
      let minDist = Infinity;
      for (const entry of entries) {
        const sc = project(entry.local, rootGroup, camera, rect);
        if (!sc) continue;
        const d = Math.hypot(clickX - sc.x, clickY - sc.y);
        if (d < minDist) minDist = d;
      }
      if (minDist > 80) {
        e.stopImmediatePropagation();
        canvas.style.cursor = 'default';
      }
    }, true);

    // ── 光标样式 ─────────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', function (e) {
      const rootGroup = getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let minDist = Infinity;
      for (const entry of entries) {
        const sc = project(entry.local, rootGroup, camera, rect);
        if (!sc) continue;
        const d = Math.hypot(mx - sc.x, my - sc.y);
        if (d < minDist) minDist = d;
      }
      canvas.style.cursor = minDist <= 80 ? 'pointer' : 'default';
    });

    // ── 每帧更新位置 ──────────────────────────────────────────────────────
    function tick() {
      requestAnimationFrame(tick);
      const rootGroup = getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;
      const rect = canvas.getBoundingClientRect();

      entries.forEach(({ local, el }) => {
        const sc = project(local, rootGroup, camera, rect);
        if (!sc) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }
        // 深度影响透明度与缩放（背面淡出）
        const depthFade = 1 - sc.depth * 0.5;
        const scale = 0.55 + depthFade * 0.6;

        el.style.opacity = (depthFade * 0.95).toFixed(2);
        el.style.pointerEvents = depthFade > 0.5 ? 'auto' : 'none';
        el.style.left = (rect.left + sc.x) + 'px';
        el.style.top  = (rect.top  + sc.y) + 'px';
        el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        el.style.zIndex = Math.round(depthFade * 100);
      });
    }
    tick();
    console.log('[film-sprites] poster overlay ready for', MOVIES.length, 'movies');
  }

  // ── 等待 _rleGlobe 就绪 ──────────────────────────────────────────────
  function waitAndInit(tries) {
    tries = tries || 0;
    if (window._rleGlobe && window._rleGlobe.scene && window._rleGlobe.getRoot) {
      setTimeout(init, 500);
    } else if (tries < 300) {
      setTimeout(function () { waitAndInit(tries + 1); }, 100);
    }
  }
  waitAndInit();
})();
