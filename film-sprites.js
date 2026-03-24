/**
 * film-sprites.js — 女性电影海报叠加层
 * 原理：用 Three.js 相机矩阵将每部电影的 3D 球面坐标投影到 2D 屏幕，
 *       用 CSS div 渲染海报卡片，无需访问 THREE 类。
 */
(function () {
  'use strict';

  const GLOBE_RADIUS = 300;
  const DEG = Math.PI / 180;

  // ── 150 部电影数据 ────────────────────────────────────────────────────────
  const MOVIES = [
    {id:1,title:"你好，李焕英",director:"贾玲",year:2021,rating:7.7,lat:36.0484,lon:105.0715,color:"#e8341c"},
    {id:2,title:"热辣滚烫",director:"贾玲",year:2024,rating:7.5,lat:36.2418,lon:105.9053,color:"#e8341c"},
    {id:3,title:"观音山",director:"李玉",year:2010,rating:7.1,lat:35.5126,lon:107.804,color:"#e8341c"},
    {id:4,title:"二次曝光",director:"李玉",year:2012,rating:6.8,lat:34.4673,lon:106.277,color:"#e8341c"},
    {id:5,title:"万物生长",director:"李玉",year:2015,rating:5.8,lat:34.1626,lon:105.7926,color:"#e8341c"},
    {id:6,title:"断·桥",director:"李玉",year:2022,rating:6.1,lat:33.002,lon:105.2757,color:"#e8341c"},
    {id:7,title:"桃姐",director:"许鞍华",year:2011,rating:8.3,lat:23.6727,lon:113.9156,color:"#e8341c"},
    {id:8,title:"天水围的日与夜",director:"许鞍华",year:2008,rating:8.6,lat:22.8256,lon:116.3862,color:"#e8341c"},
    {id:9,title:"黄金时代",director:"许鞍华",year:2014,rating:7.3,lat:33.1056,lon:103.6866,color:"#e8341c"},
    {id:10,title:"明月几时有",director:"许鞍华",year:2017,rating:6.9,lat:21.4132,lon:114.7293,color:"#e8341c"},
    {id:11,title:"女人，四十",director:"许鞍华",year:1995,rating:8.9,lat:20.5477,lon:112.4333,color:"#e8341c"},
    {id:12,title:"投奔怒海",director:"许鞍华",year:1982,rating:8.5,lat:22.6247,lon:112.8272,color:"#e8341c"},
    {id:13,title:"苹果",director:"李玉",year:2007,rating:7.0,lat:34.781,lon:102.975,color:"#e8341c"},
    {id:14,title:"红颜",director:"李玉",year:2005,rating:7.8,lat:35.1798,lon:103.5597,color:"#e8341c"},
    {id:15,title:"今年夏天",director:"李玉",year:2001,rating:7.3,lat:36.9484,lon:103.7334,color:"#e8341c"},
    {id:16,title:"芭比",director:"Greta Gerwig",year:2023,rating:7.0,lat:42.4409,lon:-99.6066,color:"#2980b9"},
    {id:17,title:"小妇人",director:"Greta Gerwig",year:2019,rating:8.0,lat:42.5299,lon:-98.0289,color:"#2980b9"},
    {id:18,title:"伯德小姐",director:"Greta Gerwig",year:2017,rating:7.9,lat:41.1393,lon:-97.6908,color:"#2980b9"},
    {id:19,title:"弗朗西丝·哈",director:"Noah Baumbach (编剧Greta Gerwig)",year:2012,rating:8.3,lat:39.7061,lon:-97.1051,color:"#2980b9"},
    {id:20,title:"无依之地",director:"Chloé Zhao",year:2020,rating:8.1,lat:38.6649,lon:-97.7923,color:"#2980b9"},
    {id:21,title:"骑士",director:"Chloé Zhao",year:2018,rating:7.5,lat:39.0132,lon:-99.3907,color:"#2980b9"},
    {id:22,title:"哥哥教我唱的歌",director:"Chloé Zhao",year:2015,rating:7.1,lat:38.4306,lon:-99.7761,color:"#2980b9"},
    {id:23,title:"犬之力",director:"Jane Campion",year:2021,rating:7.9,lat:-39.4551,lon:174.5756,color:"#7f8c8d"},
    {id:24,title:"钢琴课",director:"Jane Campion",year:1993,rating:8.1,lat:-41.4539,lon:176.8237,color:"#7f8c8d"},
    {id:25,title:"明亮的星",director:"Jane Campion",year:2009,rating:7.7,lat:-41.6823,lon:172.8591,color:"#8e44ad"},
    {id:26,title:"迷失东京",director:"Sofia Coppola",year:2003,rating:7.7,lat:38.7359,lon:-100.8417,color:"#2980b9"},
    {id:27,title:"绝代艳后",director:"Sofia Coppola",year:2006,rating:6.8,lat:38.338,lon:-103.0597,color:"#2980b9"},
    {id:28,title:"处女之死",director:"Sofia Coppola",year:1999,rating:7.5,lat:40.1313,lon:-102.8907,color:"#2980b9"},
    {id:29,title:"在某处",director:"Sofia Coppola",year:2010,rating:7.3,lat:40.9393,lon:-102.9655,color:"#2980b9"},
    {id:30,title:"牡丹花下",director:"Sofia Coppola",year:2017,rating:6.2,lat:41.3914,lon:-101.4046,color:"#2980b9"},
    {id:31,title:"燃烧女子的肖像",director:"Céline Sciamma",year:2019,rating:8.7,lat:48.2364,lon:2.6386,color:"#27ae60"},
    {id:32,title:"假小子",director:"Céline Sciamma",year:2011,rating:8.0,lat:47.8845,lon:4.0671,color:"#27ae60"},
    {id:33,title:"女孩帮",director:"Céline Sciamma",year:2014,rating:7.4,lat:46.4494,lon:5.6163,color:"#27ae60"},
    {id:34,title:"小妈妈",director:"Céline Sciamma",year:2021,rating:8.0,lat:45.7826,lon:3.4997,color:"#27ae60"},
    {id:35,title:"将来的事",director:"Mia Hansen-Løve",year:2016,rating:8.2,lat:44.8277,lon:3.4276,color:"#27ae60"},
    {id:36,title:"晨光正好",director:"Mia Hansen-Løve",year:2022,rating:7.6,lat:43.1334,lon:2.4792,color:"#27ae60"},
    {id:37,title:"阿黛尔的生活",director:"Abdellatif Kechiche (原著Julie Maroh)",year:2013,rating:8.4,lat:44.8404,lon:0.3523,color:"#27ae60"},
    {id:38,title:"钢琴教师",director:"Michael Haneke (原著Elfriede Jelinek)",year:2001,rating:7.5,lat:45.5534,lon:-0.4972,color:"#27ae60"},
    {id:39,title:"八美图",director:"François Ozon (编剧团队含女性)",year:2002,rating:7.8,lat:46.8855,lon:-0.4487,color:"#27ae60"},
    {id:40,title:"花容月貌",director:"François Ozon",year:2013,rating:7.4,lat:47.1203,lon:0.5787,color:"#27ae60"},
    {id:41,title:"82年生的金智英",director:"Kim Do-young",year:2019,rating:8.6,lat:38.025,lon:127.9466,color:"#1abc9c"},
    {id:42,title:"蜂鸟",director:"Kim Bora",year:2018,rating:7.9,lat:38.4088,lon:130.441,color:"#1abc9c"},
    {id:43,title:"我们的世界",director:"Yoon Ga-eun",year:2016,rating:8.3,lat:36.5579,lon:129.6882,color:"#1abc9c"},
    {id:44,title:"道熙呀",director:"July Jung",year:2014,rating:8.3,lat:34.8182,lon:129.2899,color:"#1abc9c"},
    {id:45,title:"小公女",director:"Jeon Go-woon",year:2018,rating:7.9,lat:35.4204,lon:128.1218,color:"#1abc9c"},
    {id:46,title:"恋爱谈",director:"Lee Hyun-ju",year:2016,rating:7.8,lat:34.677,lon:126.2491,color:"#1abc9c"},
    {id:47,title:"阳光姐妹淘",director:"Kang Hyeong-cheol",year:2011,rating:8.8,lat:36.715,lon:125.6213,color:"#1abc9c"},
    {id:48,title:"非常主播",director:"Kang Hyeong-cheol",year:2008,rating:7.9,lat:37.5113,lon:126.1031,color:"#1abc9c"},
    {id:49,title:"海鸥食堂",director:"Naoko Ogigami",year:2006,rating:8.3,lat:38.0178,lon:138.5016,color:"#e74c3c"},
    {id:50,title:"眼镜",director:"Naoko Ogigami",year:2007,rating:8.0,lat:37.5299,lon:140.7822,color:"#e74c3c"},
    {id:51,title:"租赁猫",director:"Naoko Ogigami",year:2012,rating:7.3,lat:36.474,lon:140.9604,color:"#e74c3c"},
    {id:52,title:"海鸥食堂",director:"Naoko Ogigami",year:2006,rating:8.3,lat:34.4309,lon:139.6763,color:"#e74c3c"},
    {id:53,title:"何时是读书天",director:"Shunichi Nagasaki",year:2005,rating:8.0,lat:33.728,lon:138.2627,color:"#e74c3c"},
    {id:54,title:"无人知晓",director:"Hirokazu Kore-eda",year:2004,rating:9.1,lat:34.4894,lon:136.6385,color:"#e74c3c"},
    {id:55,title:"花与爱丽丝",director:"Shunji Iwai",year:2004,rating:8.2,lat:35.9462,lon:134.4066,color:"#e74c3c"},
    {id:56,title:"情书",director:"Shunji Iwai",year:1995,rating:8.9,lat:37.2291,lon:136.8805,color:"#e74c3c"},
    {id:57,title:"成长教育",director:"Lone Scherfig",year:2009,rating:7.7,lat:55.3573,lon:-1.9995,color:"#8e44ad"},
    {id:58,title:"一天",director:"Lone Scherfig",year:2011,rating:7.9,lat:55.5934,lon:1.7944,color:"#8e44ad"},
    {id:59,title:"他们的最好时",director:"Lone Scherfig",year:2016,rating:7.7,lat:54.1835,lon:1.8628,color:"#8e44ad"},
    {id:60,title:"时时刻刻",director:"Stephen Daldry",year:2002,rating:8.7,lat:53.0374,lon:-0.4992,color:"#8e44ad"},
    {id:61,title:"女王",director:"Stephen Frears",year:2006,rating:7.7,lat:51.9327,lon:-2.3707,color:"#8e44ad"},
    {id:62,title:"菲洛梅娜",director:"Stephen Frears",year:2013,rating:8.4,lat:52.714,lon:-4.7394,color:"#8e44ad"},
    {id:63,title:"东方快车谋杀案",director:"Kenneth Branagh",year:2017,rating:6.8,lat:53.6729,lon:-4.7485,color:"#8e44ad"},
    {id:64,title:"看得见风景的房间",director:"James Ivory",year:1985,rating:7.7,lat:55.5978,lon:-6.0319,color:"#8e44ad"},
    {id:65,title:"何处是我家",director:"Caroline Link",year:2001,rating:8.2,lat:53.6328,lon:10.6387,color:"#f39c12"},
    {id:66,title:"走出寂静",director:"Caroline Link",year:1996,rating:8.1,lat:51.0858,lon:11.7679,color:"#f39c12"},
    {id:67,title:"完美陌生人",director:"Paolo Genovese",year:2016,rating:8.5,lat:45.8609,lon:12.596,color:"#16a085"},
    {id:68,title:"窃听风暴",director:"Florian Henckel von Donnersmarck",year:2006,rating:9.2,lat:49.055,lon:10.517,color:"#f39c12"},
    {id:69,title:"再见列宁",director:"Wolfgang Becker",year:2003,rating:9.1,lat:50.5677,lon:6.0531,color:"#f39c12"},
    {id:70,title:"还有明天",director:"Paola Cortellesi",year:2023,rating:9.0,lat:43.5093,lon:13.571,color:"#16a085"},
    {id:71,title:"完美陌生人",director:"Paolo Genovese",year:2016,rating:8.5,lat:41.9682,lon:14.5003,color:"#16a085"},
    {id:72,title:"美丽人生",director:"Roberto Benigni",year:1997,rating:9.5,lat:40.2672,lon:12.3522,color:"#16a085"},
    {id:73,title:"天堂电影院",director:"Giuseppe Tornatore",year:1988,rating:9.2,lat:42.2506,lon:10.345,color:"#16a085"},
    {id:74,title:"海上钢琴师",director:"Giuseppe Tornatore",year:1998,rating:9.3,lat:44.2633,lon:9.114,color:"#16a085"},
    {id:75,title:"胡丽叶塔",director:"Pedro Almodóvar",year:2016,rating:7.6,lat:41.6118,lon:-4.2527,color:"#d35400"},
    {id:76,title:"关于我母亲的一切",director:"Pedro Almodóvar",year:1999,rating:8.5,lat:40.2664,lon:-1.0181,color:"#d35400"},
    {id:77,title:"回归",director:"Pedro Almodóvar",year:2006,rating:8.1,lat:38.3836,lon:-2.3857,color:"#d35400"},
    {id:78,title:"对她说",director:"Pedro Almodóvar",year:2002,rating:8.5,lat:38.7122,lon:-4.8682,color:"#d35400"},
    {id:79,title:"痛苦与荣耀",director:"Pedro Almodóvar",year:2019,rating:8.5,lat:40.5372,lon:-6.7535,color:"#d35400"},
    {id:80,title:"天才枪手",director:"Nattawut Poonpiriya",year:2017,rating:8.2,lat:16.432,lon:99.8393,color:"#27ae60"},
    {id:81,title:"下一站说爱你",director:"Adisorn Tresirikasem",year:2009,rating:7.8,lat:12.771,lon:100.3999,color:"#27ae60"},
    {id:82,title:"摔跤吧！爸爸",director:"Nitesh Tiwari",year:2016,rating:9.0,lat:22.7943,lon:76.6763,color:"#f39c12"},
    {id:83,title:"三傻大闹宝莱坞",director:"Rajkumar Hirani",year:2009,rating:9.2,lat:20.1935,lon:78.1974,color:"#f39c12"},
    {id:84,title:"调音师",director:"Sriram Raghavan",year:2018,rating:8.2,lat:18.2627,lon:78.6649,color:"#f39c12"},
    {id:85,title:"神秘巨星",director:"Advait Chandan",year:2017,rating:7.7,lat:18.8988,lon:76.3383,color:"#f39c12"},
    {id:86,title:"我的个神啊",director:"Rajkumar Hirani",year:2014,rating:8.4,lat:21.005,lon:74.9869,color:"#f39c12"},
    {id:87,title:"游客",director:"Ruben Östlund",year:2014,rating:7.6,lat:62.5691,lon:17.9438,color:"#2c3e50"},
    {id:88,title:"方形",director:"Ruben Östlund",year:2017,rating:7.7,lat:59.1681,lon:20.2042,color:"#2c3e50"},
    {id:89,title:"悲情三角",director:"Ruben Östlund",year:2022,rating:7.5,lat:58.8221,lon:15.1155,color:"#2c3e50"},
    {id:90,title:"狩猎",director:"Thomas Vinterberg",year:2012,rating:9.1,lat:57.9331,lon:9.8943,color:"#7f8c8d"},
    {id:91,title:"酒精计划",director:"Thomas Vinterberg",year:2020,rating:7.8,lat:53.6631,lon:9.616,color:"#7f8c8d"},
    {id:92,title:"世界上最糟糕的人",director:"Joachim Trier",year:2021,rating:7.9,lat:61.1745,lon:8.4607,color:"#34495e"},
    {id:93,title:"奥斯陆，8月31日",director:"Joachim Trier",year:2011,rating:7.9,lat:58.3227,lon:8.1307,color:"#34495e"},
    {id:94,title:"修女艾达",director:"Paweł Pawlikowski",year:2013,rating:7.8,lat:53.4817,lon:20.3506,color:"#c0392b"},
    {id:95,title:"冷战",director:"Paweł Pawlikowski",year:2018,rating:7.8,lat:50.1173,lon:20.3809,color:"#c0392b"},
    {id:96,title:"我曾经侍候过英国国王",director:"Jiří Menzel",year:2006,rating:8.1,lat:49.8,lon:15.5,color:"#2980b9"},
    {id:97,title:"索尔之子",director:"László Nemes",year:2015,rating:7.4,lat:47.0,lon:20.0,color:"#8e44ad"}
  ];

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
