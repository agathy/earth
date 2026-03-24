/**
 * film-sprites.js v3 — 女性电影海报叠加层
 * 使用 THREE.js 原生 vec.project(camera) 投影 + dot积背面检测
 */
(function () {
  'use strict';

  const DEG = Math.PI / 180;
  const GLOBE_RADIUS = 300; // 与 U-63NcXm.min.js 中 GLOBE_RADIUS 一致

  // ── Jn() 坐标函数（与 DtqKTFO9 完全一致）──────────────────────────────
  // Jn(radius, lat, lon) → Vector3(cos(lat)cos(lon)*r, cos(lat)sin(lon)*r, sin(lat)*r)
  function latLonToLocal(lat, lon, r) {
    const e = lat * DEG, i = lon * DEG;
    return {
      x: r * Math.cos(e) * Math.cos(i),
      y: r * Math.cos(e) * Math.sin(i),
      z: r * Math.sin(e)
    };
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

  // ── 从链接提取海报路径 ────────────────────────────────────────────────
  function getPosterPath(link) {
    if (!link) return null;
    var m = link.match(/douban\.com\/subject\/(\d+)/);
    if (m) return './assets/movie-posters/' + m[1] + '.jpg';
    m = link.match(/imdb\.com\/title\/(tt\w+)/);
    if (m) return './assets/movie-posters/' + m[1] + '.jpg';
    return null;
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

  // ── 创建海报元素 ───────────────────────────────────────────────────────
  function createPosterEl(movie) {
    const wrap = document.createElement('div');
    wrap.className = 'fp-wrap';
    wrap.dataset.id = movie.id;

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
      thumb.textContent = movie.title.charAt(0);
      thumb.style.background = movie.color;
      thumb.style.color = '#fff';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';
      thumb.style.fontSize = '14px';
      thumb.style.fontWeight = 'bold';
    }

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
      .fp-wrap {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: auto;
        cursor: pointer;
        transition: opacity 0.1s;
      }
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
      .fp-wrap:hover .fp-thumb {
        transform: scale(1.15);
        box-shadow: 0 4px 16px rgba(0,0,0,0.8);
      }
      .fp-card {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%) translateY(4px);
        width: 110px;
        background: rgba(8,12,28,0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.18s ease, transform 0.18s ease;
      }
      .fp-wrap:hover .fp-card {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .fp-big-img {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
        display: block;
      }
      .fp-info { padding: 5px 6px 6px; }
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
        font-size: 7.5px;
        color: rgba(255,255,255,0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }
      .fp-foot { display: flex; justify-content: space-between; align-items: center; }
      .fp-year  { font-size: 7px; color: rgba(255,255,255,0.35); }
      .fp-rating { font-size: 8px; font-weight: bold; color: #f1c40f; }
    `;
    document.head.appendChild(style);
  }

  // ── 主初始化 ──────────────────────────────────────────────────────────
  function init() {
    const rle = window._rleGlobe;
    const camera = rle.camera;
    const renderer = rle.renderer;
    const canvas = renderer.domElement;

    console.log('[film-sprites] init, movies=', MOVIES.length, 'camera=', !!camera, 'canvas=', !!canvas);

    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'film-overlay';
    document.body.appendChild(overlay);

    // 预计算每部电影的局部坐标（在 rootGroup 的坐标系内，与 Jn() 相同）
    const entries = MOVIES.map(function (m) {
      return {
        movie: m,
        local: latLonToLocal(m.lat, m.lon, GLOBE_RADIUS + 5),
        el: createPosterEl(m)
      };
    });
    entries.forEach(function (e) { overlay.appendChild(e.el); });

    // 获取 THREE.Vector3 构造函数（从 camera.position 拿到）
    const V3 = camera.position && camera.position.constructor;
    if (!V3) {
      console.error('[film-sprites] cannot get THREE.Vector3 from camera.position');
      return;
    }

    // ── 每帧更新 ──────────────────────────────────────────────────────
    var firstTick = true;
    function tick() {
      requestAnimationFrame(tick);

      const rootGroup = rle.getRoot();
      if (!rootGroup || !rootGroup.matrixWorld) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // 相机世界坐标（用于背面检测）
      const camPos = camera.position;

      entries.forEach(function (entry) {
        const local = entry.local;
        const el = entry.el;

        // 1. 从 rootGroup 局部坐标 → 世界坐标
        const worldVec = new V3(local.x, local.y, local.z);
        worldVec.applyMatrix4(rootGroup.matrixWorld);

        // 2. 背面检测：点到相机的方向与点到球心的方向是否同向
        //    dot(worldVec, camPos) > 0 表示朝向相机（正面）
        const dot = worldVec.x * camPos.x + worldVec.y * camPos.y + worldVec.z * camPos.z;
        // 使用平滑边缘：在过渡区域（dot≈0）渐隐
        const fade = Math.min(1, Math.max(0, dot / (GLOBE_RADIUS * 400)));

        if (fade <= 0.02) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        // 3. 投影到 NDC（THREE.js 原生方法）
        const ndcVec = worldVec.clone();
        ndcVec.project(camera);

        // NDC 范围检查（超出视锥体）
        if (Math.abs(ndcVec.x) > 1.3 || Math.abs(ndcVec.y) > 1.3 || ndcVec.z > 1.0) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        // 4. NDC → 屏幕坐标（相对于 overlay 左上角 = viewport 左上角）
        const sx = (ndcVec.x + 1) / 2 * rect.width  + rect.left;
        const sy = (1 - ndcVec.y) / 2 * rect.height + rect.top;

        // 5. 应用
        const scale = 0.6 + fade * 0.5;
        el.style.opacity  = (fade * 0.92).toFixed(2);
        el.style.left     = sx.toFixed(1) + 'px';
        el.style.top      = sy.toFixed(1) + 'px';
        el.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
        el.style.zIndex   = Math.round(fade * 100);
        el.style.pointerEvents = fade > 0.4 ? 'auto' : 'none';
      });

      if (firstTick) {
        firstTick = false;
        const e0 = entries[0];
        const wv0 = new V3(e0.local.x, e0.local.y, e0.local.z);
        wv0.applyMatrix4(rootGroup.matrixWorld);
        const nv0 = wv0.clone(); nv0.project(camera);
        const dot0 = wv0.x*camPos.x + wv0.y*camPos.y + wv0.z*camPos.z;
        console.log('[film-sprites] first tick | rootGroup:', rootGroup.uuid,
          '\n  camPos:', camPos.x.toFixed(1), camPos.y.toFixed(1), camPos.z.toFixed(1),
          '\n  rect:', rect.width.toFixed(0), 'x', rect.height.toFixed(0),
          '\n  movie[0]:', e0.movie.title,
          '\n  local:', e0.local.x.toFixed(1), e0.local.y.toFixed(1), e0.local.z.toFixed(1),
          '\n  world:', wv0.x.toFixed(1), wv0.y.toFixed(1), wv0.z.toFixed(1),
          '\n  NDC:', nv0.x.toFixed(3), nv0.y.toFixed(3), nv0.z.toFixed(3),
          '\n  dot:', dot0.toFixed(0), 'fade:', (dot0/(GLOBE_RADIUS*400)).toFixed(3),
          '\n  sx:', ((nv0.x+1)/2*rect.width+rect.left).toFixed(1),
          'sy:', ((1-nv0.y)/2*rect.height+rect.top).toFixed(1));
      }
    }
    tick();
    console.log('[film-sprites] tick loop started');
  }

  // ── 等待 _rleGlobe 就绪 ──────────────────────────────────────────────
  function waitAndInit(tries) {
    tries = tries || 0;
    const rle = window._rleGlobe;
    if (rle && rle.camera && rle.renderer && rle.getRoot) {
      // 再等 1s 确保 globe 内部完成构建
      setTimeout(init, 1000);
      console.log('[film-sprites] _rleGlobe ready, will init in 1s');
    } else if (tries < 300) {
      setTimeout(function () { waitAndInit(tries + 1); }, 100);
    } else {
      console.error('[film-sprites] _rleGlobe never became ready');
    }
  }
  waitAndInit();
})();
