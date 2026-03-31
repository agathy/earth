// 替换 assets/DtqKTFO9.min.js + assets/C2DW12fk.min.js
import * as THREE from './assets/three.module.min.js';
(function () {
  const S = window.GLOBE_SETTINGS;
  const R = S.GLOBE_RADIUS;

  // ── 工具函数 ────────────────────────────────────────────────────────────────

  // 经纬度 → 球面 Vector3（Y-up：北极在 +Y，lon=0 朝 +Z 面向相机）
  function latLonToVec3(radius, lat, lon) {
    const phi   = THREE.MathUtils.degToRad(lat);
    const theta = THREE.MathUtils.degToRad(lon);
    return new THREE.Vector3(
      radius * Math.cos(phi) * Math.sin(theta),  // x：东西方向
      radius * Math.sin(phi),                     // y：南北（上下）
      radius * Math.cos(phi) * Math.cos(theta)    // z：面向相机（lon=0）
    );
  }

  // 球面交点 → 经纬度
  function vec3ToLatLon(v) {
    const len = v.length();
    const lat = THREE.MathUtils.radToDeg(Math.asin(v.y / len));
    const lon = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z));
    return { lat, lon };
  }

  // 点是否在多边形内（射线法）
  function pointInPolygon(lat, lon, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) &&
          lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // 获取 GeoJSON feature 在某经纬度是否命中
  function hitTestFeature(feature, lat, lon) {
    const { type, coordinates } = feature.geometry;
    const rings = type === 'Polygon'
      ? [coordinates[0]]
      : coordinates.map(p => p[0]);
    return rings.some(ring => pointInPolygon(lat, lon, ring));
  }

  // ── CountryMesh：每个国家的边界线 + 不可见拾取网格 ─────────────────────────

  class CountryMesh {
    constructor(feature, radius) {
      this.feature    = feature;
      this.name       = feature.properties.NAME || '';
      this.code       = (feature.properties.ISO_A2 || '').toLowerCase();
      this.group      = new THREE.Group();
      this.lineMesh   = null;
      this.highlighted = false;
      this._buildLines(feature.geometry, radius);
    }

    _buildLines(geometry, radius) {
      // 每个 ring 独立一条发光管道
      const rings = geometry.type === 'Polygon'
        ? geometry.coordinates
        : geometry.coordinates.flat();

      // 默认边线材质 - 使用 MeshBasicMaterial（自发光，不受光照影响）
      this.defaultColor = 0xFFFFFF;
      this.glowMaterial = new THREE.MeshBasicMaterial({
        color: this.defaultColor,
        side: THREE.DoubleSide
      });

      this.lineWidth = 1;
      this.tubes = [];
      this.ringData = []; // 保存 ring 数据用于重建

      rings.forEach(ring => {
        if (!ring || ring.length < 2) return;
        this.ringData.push({ ring, radius });
        this._createGlowTube(ring, radius, 0.5);
      });
    }

    _createGlowTube(ring, radius, tubeRadius) {
      // 创建曲线路径
      const points = [];
      ring.forEach(([lon, lat]) => {
        const v = latLonToVec3(radius + 0.5, lat, lon);
        if (!isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)) {
          points.push(v);
        }
      });
      if (points.length < 2) return;

      // 闭合曲线
      const curve = new THREE.CatmullRomCurve3(points, true);
      
      // 创建管道几何体 - 只需要一层，Bloom 后期处理会实现辉光效果
      const tubeGeo = new THREE.TubeGeometry(curve, Math.min(points.length * 2, 64), tubeRadius, 6, true);
      const tube = new THREE.Mesh(tubeGeo, this.glowMaterial);
      
      this.tubes.push(tube);
      this.group.add(tube);
    }

    setLineColor(hexColor) {
      this.defaultColor = new THREE.Color(hexColor).getHex();
      this.glowMaterial.color.set(hexColor);
    }

    setLineWidth(width) {
      // 通过调整管道半径来模拟粗细
      const tubeRadius = Math.max(0.2, width * 0.5);
      
      // 清除现有管道
      this.tubes.forEach(tube => {
        this.group.remove(tube);
        tube.geometry.dispose();
      });
      this.tubes = [];

      // 重新创建管道
      this.ringData.forEach(({ ring, radius }) => {
        this._createGlowTube(ring, radius, tubeRadius);
      });
    }

    setHighlight(on, duration = 200, glowIntensity = 0.2, floatHeight = 1.015, glowColor = 0x55FFFF, force = false) {
      // force 参数用于强制更新，即使状态相同也执行
      if (this.highlighted === on && !force) return;
      this.highlighted = on;
      this.highlightColor = glowColor;
      this.glowIntensity = glowIntensity;

      // 边界线使用自发光材质（MeshBasicMaterial），不受场景光照影响
      // 通过设置超亮颜色（RGB > 1.0）来触发 Bloom 后期处理辉光
      if (on) {
        // 将颜色转换为超亮版本（RGB > 1.0）以触发 Bloom
        // 使用 glowIntensity 来计算亮度，强度 0-5 映射到亮度 1-11
        const color = new THREE.Color(glowColor);
        const brightness = 1.0 + glowIntensity * 2.0;
        this.glowMaterial.color.setRGB(
          Math.min(color.r * brightness, 10),
          Math.min(color.g * brightness, 10),
          Math.min(color.b * brightness, 10)
        );
      } else {
        // 恢复默认颜色
        this.glowMaterial.color.set(this.defaultColor);
      }

      // 向外浮起效果 - 通过缩放 group 实现
      const targetScale = on ? floatHeight : 1.0;
      this._animateScale(targetScale, duration);

      // Bloom 后期处理会自动实现辉光效果，无需额外的几何体辉光
    }

    _animateScale(targetScale, duration) {
      const startScale = this.group.scale.x;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // 使用 easeOutCubic 缓动，数值越大越有黏质感
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentScale = startScale + (targetScale - startScale) * easeProgress;
        
        this.group.scale.set(currentScale, currentScale, currentScale);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }

    getGroup() { return this.group; }

    setGlowIntensity(intensity) {
      // 更新发光强度，用于动态调整边界线辉光
      this.glowIntensity = intensity;
      // 如果当前处于高亮状态，更新材质颜色
      if (this.highlighted && this.glowMaterial) {
        const color = new THREE.Color(this.highlightColor || 0x55FFFF);
        // 使用 intensity 作为乘数来调整亮度
        const brightness = 1.0 + intensity * 2.0; // 强度 0-5 映射到亮度 1-11
        this.glowMaterial.color.setRGB(
          Math.min(color.r * brightness, 10),
          Math.min(color.g * brightness, 10),
          Math.min(color.b * brightness, 10)
        );
      }
    }
  }

  // ── GlobeApp：主场景 ─────────────────────────────────────────────────────────

  class GlobeApp {
    constructor({ canvas }) {
      this.canvas   = canvas;
      this.scene    = new THREE.Scene();
      this.clock    = new THREE.Clock();
      this.raycaster = new THREE.Raycaster();
      this.mouse    = new THREE.Vector2(-9999, -9999);

      this.countries   = [];
      this.hoveredIdx  = -1;
      this.selectedIdx = -1;

      // 旋转状态
      this.isDragging     = false;
      this.lastMouseX     = 0;
      this.lastMouseY     = 0;
      this.rotationY      = -1.8; // 初始旋转让中国面向前方（经度约104°E）
      this.rotationX      = 0;
      this.velocityY      = 0;
      this.velocityX      = 0;
      this.autoRotate     = true;
      this.autoRotateSpeed = 0.0008;
      this.glowIntensity  = 0.2; // 默认辉光强度（两成）
      this.floatHeight    = 1.015; // 默认浮起高度
      this.glowColor      = 0x55FFFF; // 默认发光颜色
      this.glowRadiusMult = 2.5; // 默认辉光半径倍数
      this.glowBlur       = 0.5; // 默认辉光模糊度
      this.rotateSpeed    = 1.0; // 默认选中旋转速度（秒）
      
      // 边线颜色设置
      this.borderColorHasMovies = '#ffffff'; // 有电影的国家边线颜色
      this.borderColorNoMovies = '#444444'; // 无电影的国家边线颜色
      
      // 电影海报设置
      this.moviePosters = []; // 存储海报对象
      this.posterSize = 20; // 海报大小（默认20）
      this.posterHeight = R * 1.25; // 海报距离地心的高度（比地球稍大）
      
      // 已看电影记录
      this.watchedMovies = this._loadWatchedMovies(); // 从localStorage加载
      this.watchedRatio = 0.5; // 默认显示50%已看电影
      this.randomSeed = Math.random(); // 随机种子
      this.selectedCountry = null; // 当前选中的国家（用于显示未看海报）
      
      // 相机距离设置
      this.defaultCameraDistance = 1000; // 默认距离（取消选中时）
      this.selectedCameraDistance = 800; // 选中时的距离
      
      // 旋转动画状态
      this.isRotating = false; // 是否正在旋转中
      this.selectedCountryForPosters = null; // 旋转完成后要显示海报的国家

      // Bloom 效果设置
      this.bloomEnabled = true; // 默认启用 Bloom
      this.bloomStrength = 1.5;
      this.bloomThreshold = 0.5;
      this.bloomRadius = 0.4;

      // 运动暂停设置
      this.motionPaused = false; // 是否暂停地球和摄像机运动

      // 所有地球对象挂在这个 group 下统一旋转，保留各自内部旋转
      this.globeGroup = new THREE.Group();
      this.scene.add(this.globeGroup);

      this._setupRenderer();
      this._setupCamera();
      this._setupLights();
      this._setupGlobe();
      this._setupParticles();
      this._setupAtmosphere();
      this._setupCountries();
      this._setupPicking();
      this._setupEvents();
      this._setupBloom();
    }

    _setupBloom() {
      // 初始化 Bloom 效果
      if (window.BloomEffect) {
        this.bloomEffect = new window.BloomEffect(this.renderer, this.scene, this.camera);
        this.bloomEffect.setStrength(this.bloomStrength);
        this.bloomEffect.setThreshold(this.bloomThreshold);
        this.bloomEffect.setRadius(this.bloomRadius);
      }
    }

    _setupRenderer() {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }

    _setupCamera() {
      this.camera = new THREE.PerspectiveCamera(
        45, window.innerWidth / window.innerHeight, 1, 10000
      );
      // 初始相机距离使用defaultCameraDistance（1200）
      const initialDistance = this.defaultCameraDistance || 1200;
      this.camera.position.set(0, 0, initialDistance);
      // 同步更新targetZoom，确保滚轮缩放从正确位置开始
      this.targetZoom = initialDistance;
    }

    _setupLights() {
      this.scene.add(new THREE.AmbientLight(0x111122, 1.2));
      const dir = new THREE.DirectionalLight(0xfff5ee, 1.0);
      dir.position.set(3, 1, 2);
      this.scene.add(dir);
    }

    _setupGlobe() {
      // 主球体（深色，接受灯光）- 使用 MeshStandardMaterial 更好地响应光照
      this.defaultGlobeColor = 0x0b1728;
      this.globeMaterial = new THREE.MeshStandardMaterial({
        color: this.defaultGlobeColor,
        roughness: 0.7,
        metalness: 0.1,
        transparent: false,
      });
      this.globeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 64),
        this.globeMaterial
      );
      this.scene.add(this.globeMesh);

      // 不可见的拾取球（略大于主球，用于 Raycaster 捕获鼠标坐标）
      this.pickSphere = new THREE.Mesh(
        new THREE.SphereGeometry(R + 1, 32, 32),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.FrontSide })
      );
      this.scene.add(this.pickSphere);

      // 内球（防止透视穿帮）
      this.innerSphere = new THREE.Mesh(
        new THREE.SphereGeometry(R - 5, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
      );
      this.scene.add(this.innerSphere);
    }

    _setupParticles() {
      if (!window.ParticleGlobe) return;
      this.particleGlobe = new window.ParticleGlobe();
      const points = this.particleGlobe.getPoints();
      // 确保粒子在球体之上渲染
      points.renderOrder = 10;
      this.scene.add(points);

      // 初始化粒子半径偏移
      this.particleRadiusOffset = 5;
      this._updateParticlePositions();
    }

    _updateParticlePositions() {
      if (!this.particleGlobe) return;
      
      // 使用海报的位置数据（如果可用），否则使用 _movieTe
      const particleRadius = R + this.particleRadiusOffset;
      
      if (this.moviePosters && this.moviePosters.length > 0) {
        // 使用海报的位置数据
        const n = Math.min(this.moviePosters.length, S.NUMBER_OF_BALLS);
        for (let i = 0; i < n; i++) {
          const entry = this.moviePosters[i];
          const lat = entry.lat;
          const lon = entry.lon;
          const name = entry.movie.name || entry.movie.title || '';
          const v = latLonToVec3(particleRadius, lat, lon);
          this.particleGlobe.updateBallPosition(i, v, name);
        }
      } else {
        // 回退到使用 _movieTe
        const te = window._movieTe || [];
        const n = Math.min(te.length, S.NUMBER_OF_BALLS);
        for (let i = 0; i < n; i++) {
          const [lat, lon, name] = te[i];
          const v = latLonToVec3(particleRadius, lat, lon);
          this.particleGlobe.updateBallPosition(i, v, name);
        }
      }
    }

    setParticleRadiusOffset(offset) {
      this.particleRadiusOffset = offset;
      this._updateParticlePositions();
    }

    _setupAtmosphere() {
      // 创建带有经纬线纹理的大气层
      this.atmosphereHeight = 1.08; // 默认大气高度倍数
      const atmosphereRadius = R * this.atmosphereHeight; // 比地球稍大

      // 创建 Canvas 生成经纬线纹理
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // 透明背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制经线（垂直线）- 使用白色，让 Shader 控制颜色
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      const meridians = 24; // 经线数量
      for (let i = 0; i <= meridians; i++) {
        const x = (i / meridians) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // 绘制纬线（水平线）- 使用白色，让 Shader 控制颜色
      const parallels = 12; // 纬线数量
      for (let i = 0; i <= parallels; i++) {
        const y = (i / parallels) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 创建纹理
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // 使用 ShaderMaterial 实现边缘发光效果
      const vertexShader = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        uniform sampler2D map;
        uniform vec3 color;
        uniform float intensity;
        uniform float fresnelPower;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // 计算视线方向（假设相机在 +Z 方向）
          vec3 viewDirection = normalize(cameraPosition - vPosition);

          // 计算法线与视线的点积
          // 当法线与视线垂直时（边缘），值为 0
          // 当法线与视线平行时（中心），值为 1
          float viewDotNormal = dot(viewDirection, vNormal);

          // 菲涅尔效果：边缘强，中心弱
          // fresnelPower 控制边缘宽度，值越小边缘越宽
          float fresnel = pow(1.0 - abs(viewDotNormal), fresnelPower);

          // 采样纹理
          vec4 texColor = texture2D(map, vUv);

          // 结合菲涅尔效果和纹理
          vec3 finalColor = color * texColor.rgb * fresnel * intensity;
          float alpha = texColor.a * fresnel * intensity;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `;

      this.atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: texture },
          color: { value: new THREE.Color(0x64b4ff) },
          intensity: { value: 1.5 },
          fresnelPower: { value: 2.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      // 创建大气层球体
      this.atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64);
      this.atmosphereMesh = new THREE.Mesh(
        this.atmosphereGeometry,
        this.atmosphereMaterial
      );

      this.scene.add(this.atmosphereMesh);

      // 保留原有的大气发光效果（如果存在）
      if (window.AtmosphereSphere) {
        this.atm = new window.AtmosphereSphere(0.03);
        this.atm.setOpacity(0.3);
        this.scene.add(this.atm.getMesh());
      }

      // 在大气层上添加光点层（延迟初始化，等待电影数据加载）
      this._atmosphereParticlesInitialized = false;
    }

    // 在大气层上创建光点层
    _setupAtmosphereParticles() {
      if (!window.ParticleGlobe || this._atmosphereParticlesInitialized) return;
      
      // 检查电影数据是否已加载
      const te = window._movieTe || [];
      if (te.length === 0) return; // 数据还未加载，稍后再试
      
      // 创建一个新的粒子系统专门用于大气层
      this.atmosphereParticleGlobe = new window.ParticleGlobe();
      const points = this.atmosphereParticleGlobe.getPoints();
      // 确保在大气层之上渲染
      points.renderOrder = 15;
      this.scene.add(points);
      
      // 设置大气层光点的位置（使用大气层半径）
      this._updateAtmosphereParticlePositions();
      
      this._atmosphereParticlesInitialized = true;
    }

    // 更新大气层光点位置
    _updateAtmosphereParticlePositions() {
      if (!this.atmosphereParticleGlobe) return;
      
      const atmosphereRadius = R * (this.atmosphereHeight || 1.08);
      
      // 使用海报的位置数据（如果可用），否则使用 _movieTe
      if (this.moviePosters && this.moviePosters.length > 0) {
        const n = Math.min(this.moviePosters.length, 1000); // 最多1000个光点
        for (let i = 0; i < n; i++) {
          const entry = this.moviePosters[i];
          const lat = entry.lat;
          const lon = entry.lon;
          const name = entry.movie.name || entry.movie.title || '';
          const v = latLonToVec3(atmosphereRadius, lat, lon);
          this.atmosphereParticleGlobe.updateBallPosition(i, v, name);
        }
      } else {
        // 回退到使用 _movieTe
        const te = window._movieTe || [];
        const n = Math.min(te.length, 1000);
        for (let i = 0; i < n; i++) {
          const [lat, lon, name] = te[i];
          const v = latLonToVec3(atmosphereRadius, lat, lon);
          this.atmosphereParticleGlobe.updateBallPosition(i, v, name);
        }
      }
    }

    _setupCountries() {
      const geojson = window.COUNTRY_GEOJSON;
      if (!geojson) return;

      this.countryGroup = new THREE.Group();
      this.scene.add(this.countryGroup);

      geojson.features.forEach(feature => {
        const cm = new CountryMesh(feature, R);
        this.countries.push(cm);
        this.countryGroup.add(cm.getGroup());
      });
    }

    _setupPicking() {
      // 用于点击影片粒子的射线
      this.pointRaycaster = new THREE.Raycaster();
      this.pointRaycaster.params.Points = { threshold: 4 };
    }

    _setupEvents() {
      const c = this.canvas;

      // 鼠标拖拽旋转
      c.addEventListener('mousedown', e => {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.velocityX = this.velocityY = 0;
        this.autoRotate = false;
        c.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', e => {
        // 更新 normalized mouse
        this.mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.velocityY = dx * S.ROTATE_SPEED;
        this.velocityX = dy * S.ROTATE_SPEED;
        this.rotationY += this.velocityY;
        this.rotationX += this.velocityX;
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
        c.style.cursor = 'grab';
        // 3秒无操作后恢复自转
        clearTimeout(this._autoRotateTimer);
        this._autoRotateTimer = setTimeout(() => { this.autoRotate = true; }, 3000);
      });

      // 触摸支持
      c.addEventListener('touchstart', e => {
        const t = e.touches[0];
        this.isDragging = true;
        this.lastMouseX = t.clientX;
        this.lastMouseY = t.clientY;
        this.autoRotate = false;
      }, { passive: true });

      window.addEventListener('touchmove', e => {
        if (!this.isDragging) return;
        const t = e.touches[0];
        const dx = t.clientX - this.lastMouseX;
        const dy = t.clientY - this.lastMouseY;
        this.rotationY += dx * S.ROTATE_SPEED;
        this.rotationX += dy * S.ROTATE_SPEED;
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
        this.lastMouseX = t.clientX;
        this.lastMouseY = t.clientY;
      }, { passive: true });

      window.addEventListener('touchend', () => {
        this.isDragging = false;
        clearTimeout(this._autoRotateTimer);
        this._autoRotateTimer = setTimeout(() => { this.autoRotate = true; }, 3000);
      });

      // 点击
      c.addEventListener('click', e => this._onClick(e));

      // resize
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // 控制面板事件 - 边线颜色
      window.addEventListener('border-color-change', (e) => {
        const color = e.detail && e.detail.color;
        const type = e.detail && e.detail.type;
        if (color) {
          if (type === 'noMovies') {
            this.setBorderColorEmpty(color);
          } else {
            this.setBorderColor(color);
          }
        }
      });

      // 控制面板事件 - 浮起颜色
      window.addEventListener('highlight-color-change', (e) => {
        const color = e.detail && e.detail.color;
        if (color) this.setHighlightColor(color);
      });

      // 控制面板事件 - 边线粗细
      window.addEventListener('border-width-change', (e) => {
        const width = e.detail && e.detail.width;
        if (width !== undefined) this.setBorderWidth(width);
      });

      // 控制面板事件 - 贴图更改
      window.addEventListener('globe-texture-change', (e) => {
        const imageUrl = e.detail && e.detail.imageUrl;
        this.setGlobeTexture(imageUrl, -0.25, 0);
      });

      // 控制面板事件 - 贴图偏移
      window.addEventListener('texture-offset-change', (e) => {
        const offsetX = e.detail && e.detail.offsetX;
        const offsetY = e.detail && e.detail.offsetY;
        this.setTextureOffset(offsetX, offsetY);
      });

      // 控制面板事件 - 贴图透明度
      window.addEventListener('texture-opacity-change', (e) => {
        const opacity = e.detail && e.detail.opacity;
        if (opacity !== undefined) this.setTextureOpacity(opacity);
      });

      // 控制面板事件 - 浮起速度
      this.floatDuration = 200; // 默认 200ms
      window.addEventListener('float-speed-change', (e) => {
        const speed = e.detail && e.detail.speed;
        if (speed !== undefined) this.floatDuration = speed;
      });

      // 控制面板事件 - 大气亮度
      window.addEventListener('atmosphere-brightness-change', (e) => {
        const brightness = e.detail && e.detail.brightness;
        if (brightness !== undefined) this.setAtmosphereBrightness(brightness);
      });

      // 控制面板事件 - 大气密度
      window.addEventListener('atmosphere-density-change', (e) => {
        const density = e.detail && e.detail.density;
        if (density !== undefined) this.setAtmosphereDensity(density);
      });

      // 控制面板事件 - 大气高度
      window.addEventListener('atmosphere-height-change', (e) => {
        const height = e.detail && e.detail.height;
        if (height !== undefined) this.setAtmosphereHeight(height);
      });

      // 控制面板事件 - 大气颜色
      window.addEventListener('atmosphere-color-change', (e) => {
        const color = e.detail && e.detail.color;
        if (color) this.setAtmosphereColor(color);
      });

      // 控制面板事件 - 边线辉光强度
      window.addEventListener('border-glow-intensity-change', (e) => {
        const intensity = e.detail && e.detail.intensity;
        if (intensity !== undefined) this.setGlowIntensity(intensity);
      });

      // 控制面板事件 - 菲涅尔边缘宽度
      window.addEventListener('fresnel-width-change', (e) => {
        const width = e.detail && e.detail.width;
        if (width !== undefined) this.setFresnelWidth(width);
      });

      // 控制面板事件 - 浮起高度
      window.addEventListener('float-height-change', (e) => {
        const height = e.detail && e.detail.height;
        if (height !== undefined) this.setFloatHeight(height);
      });

      // 控制面板事件 - 发光颜色
      window.addEventListener('glow-color-change', (e) => {
        const color = e.detail && e.detail.color;
        if (color) this.setGlowColor(color);
      });

      // 控制面板事件 - 辉光半径倍数
      window.addEventListener('glow-radius-mult-change', (e) => {
        const radiusMult = e.detail && e.detail.radiusMult;
        if (radiusMult !== undefined) this.setGlowRadiusMult(radiusMult);
      });

      // 控制面板事件 - 辉光模糊度
      window.addEventListener('glow-blur-change', (e) => {
        const blur = e.detail && e.detail.blur;
        if (blur !== undefined) this.setGlowBlur(blur);
      });

      // 控制面板事件 - 粒子半径偏移
      window.addEventListener('particle-radius-change', (e) => {
        const radiusOffset = e.detail && e.detail.radiusOffset;
        if (radiusOffset !== undefined) this.setParticleRadiusOffset(radiusOffset);
      });

      // 控制面板事件 - 海报大小
      window.addEventListener('poster-size-change', (e) => {
        const size = e.detail && e.detail.size;
        if (size !== undefined) this.setPosterSize(size);
      });

      // 控制面板事件 - 海报高度偏移
      window.addEventListener('poster-height-change', (e) => {
        const offset = e.detail && e.detail.offset;
        if (offset !== undefined) this.setPosterHeightOffset(offset);
      });

      // 控制面板事件 - 辉光层参数变化
      window.addEventListener('glow-layer-change', (e) => {
        const detail = e.detail;
        if (detail && detail.layer !== undefined) {
          const layerIndex = detail.layer - 1; // 转换为 0-based index
          if (detail.radius !== undefined) {
            this.setGlowLayerParam(layerIndex, 'radius', detail.radius);
          }
          if (detail.blur !== undefined) {
            this.setGlowLayerParam(layerIndex, 'blur', detail.blur);
          }
          if (detail.opacity !== undefined) {
            this.setGlowLayerParam(layerIndex, 'opacity', detail.opacity);
          }
        }
      });

      // 滚轮缩放
      this.minZoom = 400;
      this.maxZoom = 2000;
      this.targetZoom = this.camera.position.z;
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * 0.5;
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom + delta));
      }, { passive: false });

      // 取消选中事件 - 关闭弹窗时恢复自转
      window.addEventListener('country-deselect', () => {
        this.clearSelection();
      });

      // 旋转速度变化事件
      window.addEventListener('rotate-speed-change', (e) => {
        const speed = e.detail && e.detail.speed;
        if (speed !== undefined) {
          this.rotateSpeed = speed;
        }
      });

      // Bloom 参数变化事件
      window.addEventListener('bloom-strength-change', (e) => {
        const strength = e.detail && e.detail.strength;
        if (strength !== undefined && this.bloomEffect) {
          this.bloomStrength = strength;
          this.bloomEffect.setStrength(strength);
        }
      });

      window.addEventListener('bloom-threshold-change', (e) => {
        const threshold = e.detail && e.detail.threshold;
        if (threshold !== undefined && this.bloomEffect) {
          this.bloomThreshold = threshold;
          this.bloomEffect.setThreshold(threshold);
        }
      });

      window.addEventListener('bloom-radius-change', (e) => {
        const radius = e.detail && e.detail.radius;
        if (radius !== undefined && this.bloomEffect) {
          this.bloomRadius = radius;
          this.bloomEffect.setRadius(radius);
        }
      });

      window.addEventListener('bloom-enabled-change', (e) => {
        const enabled = e.detail && e.detail.enabled;
        if (enabled !== undefined) {
          this.bloomEnabled = enabled;
        }
      });

      // 运动暂停事件
      window.addEventListener('motion-pause-change', (e) => {
        const paused = e.detail && e.detail.paused;
        if (paused !== undefined) {
          this.motionPaused = paused;
        }
      });

      // 海报大小变化事件
      window.addEventListener('poster-size-change', (e) => {
        const size = e.detail && e.detail.size;
        if (size !== undefined) {
          this.setPosterSize(size);
        }
      });

      // 已看电影比例变化事件
      window.addEventListener('watched-ratio-change', (e) => {
        const ratio = e.detail && e.detail.ratio;
        if (ratio !== undefined) {
          this.setWatchedRatio(ratio);
        }
      });

      // 刷新随机种子事件
      window.addEventListener('refresh-random-seed', () => {
        this.refreshRandomSeed();
      });

      // 电影海报显示/隐藏事件
      window.addEventListener('toggle-posters', (e) => {
        const visible = e.detail && e.detail.visible;
        if (visible !== undefined) {
          this.togglePosters(visible);
        }
      });

      // 时间轴筛选事件 - 根据年份筛选电影
      window.addEventListener('moviesFilterChange', (e) => {
        const detail = e.detail;
        if (!detail) return;
        
        const { startYear, endYear, filteredMovies } = detail;
        
        // 保存年份筛选范围
        this.yearFilterStart = startYear;
        this.yearFilterEnd = endYear;
        
        // 筛选粒子显示
        this._filterParticlesByYear(startYear, endYear);
      });

      c.style.cursor = 'grab';
    }

    // 根据年份筛选粒子显示 - 粒子始终显示，不受年份筛选影响
    _filterParticlesByYear(startYear, endYear) {
      // 粒子光点始终显示，不进行筛选
      // 只有海报会根据年份显示/隐藏
      return;
    }

    setBorderColor(hexColor) {
      this.borderColorHasMovies = hexColor;
      this._updateBorderColors();
    }

    setBorderColorEmpty(hexColor) {
      this.borderColorNoMovies = hexColor;
      this._updateBorderColors();
    }

    _updateBorderColors() {
      // 获取所有有电影的国家名称（中文）
      const movies = window.femaleDirectorsMovies || [];
      const countriesWithMoviesZh = new Set();
      movies.forEach(movie => {
        if (movie.countries_regions && movie.countries_regions.length) {
          countriesWithMoviesZh.add(movie.countries_regions[0]);
        }
      });

      // 为每个国家设置对应的颜色
      this.countries.forEach(cm => {
        const countryEn = cm.feature.properties.NAME || cm.feature.properties.ADMIN;
        // 检查这个英文国家名是否对应有电影的中文国家名
        let hasMovies = false;
        for (const zhName of countriesWithMoviesZh) {
          const mappedEn = this._getCountryEnglishName(zhName);
          if (mappedEn === countryEn || 
              mappedEn === cm.name || 
              (mappedEn && cm.code === mappedEn.toLowerCase())) {
            hasMovies = true;
            break;
          }
        }
        
        if (hasMovies && this.borderColorHasMovies) {
          cm.setLineColor(this.borderColorHasMovies);
        } else if (!hasMovies && this.borderColorNoMovies) {
          cm.setLineColor(this.borderColorNoMovies);
        } else if (this.borderColorHasMovies) {
          cm.setLineColor(this.borderColorHasMovies);
        }
      });
    }

    setBorderWidth(width) {
      this.countries.forEach(cm => cm.setLineWidth(width));
    }

    _updateTimelineRingScale() {
      // 获取星环元素 - 注意：时间轴HTML在页面底部定义，可能初始不存在
      const timelineContainer = document.getElementById('timeline-container');
      const timelineRing = document.getElementById('timeline-ring');
      if (!timelineContainer || !timelineRing) {
        // 元素不存在时设置默认半径
        this.timelineRingRadius = 350;
        return;
      }

      // 基础配置
      const baseSize = 700; // 基础大小（像素）
      const baseCameraZ = 1200; // 基础相机距离
      const dampingFactor = 0.6; // 缩放阻尼系数（地球缩放2倍，星环缩放1.2倍）
      const maxScreenRatio = 0.9; // 最大占屏幕高度比例（90%）

      // 计算当前缩放比例
      const currentCameraZ = this.camera.position.z;
      const zoomRatio = baseCameraZ / currentCameraZ; // >1 表示放大，<1 表示缩小

      // 应用阻尼
      const dampedZoom = 1 + (zoomRatio - 1) * dampingFactor;

      // 计算目标大小
      let targetSize = baseSize * dampedZoom;

      // 边缘停靠逻辑
      const screenHeight = window.innerHeight;
      const maxSize = screenHeight * maxScreenRatio;

      let edgeLocked = false;
      let tiltAngle = 75; // 基础倾斜角度
      let opacity = 1;

      if (targetSize > maxSize) {
        // 达到边缘，停止放大
        targetSize = maxSize;
        edgeLocked = true;

        // 根据超出程度调整倾斜角度和透明度
        const overflowRatio = (baseSize * dampedZoom) / maxSize;
        tiltAngle = 75 + (overflowRatio - 1) * 15; // 倾斜更多
        opacity = Math.max(0.3, 1 - (overflowRatio - 1) * 0.5); // 逐渐变透明
      }

      // 应用样式
      timelineContainer.style.width = targetSize + 'px';
      timelineContainer.style.height = targetSize + 'px';

      // 更新3D变换
      const baseTransform = `rotateX(${tiltAngle}deg) rotateY(-10deg)`;
      timelineRing.style.transform = baseTransform;
      timelineRing.style.opacity = opacity;

      // 更新刻度半径（用于手柄定位）
      this.timelineRingRadius = targetSize / 2;
    }

    setGlobeTexture(imageUrl, offsetX = 0, offsetY = 0) {
      if (!imageUrl) {
        // 恢复默认颜色
        this.globeMaterial.map = null;
        this.globeMaterial.color.setHex(this.defaultGlobeColor);
        this.globeMaterial.needsUpdate = true;
        this.currentTexture = null;
        return;
      }

      // 加载贴图
      const loader = new THREE.TextureLoader();
      loader.load(imageUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // 不翻转Y轴
        texture.flipY = true;
        // 设置重复和偏移
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        // 添加0.5的基础偏移，再加上用户偏移（默认-0.25）
        texture.offset.x = offsetX + 0.5;
        texture.offset.y = offsetY;
        // 不进行水平翻转
        
        this.globeMaterial.map = texture;
        this.globeMaterial.color.setHex(0xffffff);
        this.globeMaterial.needsUpdate = true;
        this.currentTexture = texture;
      }, undefined, (error) => {
        console.error('贴图加载失败:', error);
      });
    }

    setTextureOffset(offsetX, offsetY) {
      if (this.currentTexture) {
        // 保持0.5的基础偏移
        this.currentTexture.offset.x = offsetX + 0.5;
        this.currentTexture.offset.y = offsetY;
        this.currentTexture.needsUpdate = true;
      }
    }

    setAtmosphereBrightness(brightness) {
      if (this.atmosphereMaterial && this.atmosphereMaterial.uniforms) {
        this.atmosphereMaterial.uniforms.intensity.value = brightness;
      }
    }

    setTextureOpacity(opacity) {
      if (this.globeMaterial) {
        this.globeMaterial.opacity = opacity;
        this.globeMaterial.transparent = opacity < 1;
        this.globeMaterial.needsUpdate = true;
      }
    }

    setAtmosphereColor(colorHex) {
      if (this.atmosphereMaterial && this.atmosphereMaterial.uniforms) {
        this.atmosphereMaterial.uniforms.color.value.set(colorHex);
      }
    }

    setGlowIntensity(intensity) {
      this.glowIntensity = intensity;
      // 更新所有国家的辉光强度
      this.countries.forEach(cm => {
        cm.setGlowIntensity(intensity);
      });
    }

    setFresnelWidth(width) {
      if (this.atmosphereMaterial && this.atmosphereMaterial.uniforms) {
        this.atmosphereMaterial.uniforms.fresnelPower.value = width;
      }
    }

    setFloatHeight(height) {
      this.floatHeight = height;
    }

    setGlowColor(colorHex) {
      this.glowColor = new THREE.Color(colorHex).getHex();
    }

    setHighlightColor(colorHex) {
      this.glowColor = new THREE.Color(colorHex).getHex();
      // 更新所有国家的辉光颜色
      this.countries.forEach(cm => {
        cm.highlightColor = this.glowColor;
      });
    }

    setGlowRadiusMult(radiusMult) {
      this.glowRadiusMult = radiusMult;
      // 更新所有国家的辉光半径倍数
      this.countries.forEach(cm => {
        cm.setGlowRadiusMult(radiusMult);
      });
    }

    setGlowBlur(blur) {
      this.glowBlur = blur;
      // 更新所有国家的辉光模糊度
      this.countries.forEach(cm => {
        cm.setGlowBlur(blur);
      });
    }

    setGlowLayerParam(layerIndex, param, value) {
      // 更新所有国家的辉光层参数
      this.countries.forEach(cm => {
        cm.setGlowLayerParam(layerIndex, param, value);
      });
    }

    setAtmosphereDensity(density) {
      // 重新生成大气层纹理，改变经纬线密度
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');

      // 透明背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 获取当前亮度
      const currentIntensity = this.atmosphereMaterial?.uniforms?.intensity?.value || 1.5;

      // 绘制经线（垂直线）- 使用白色，让 Shader 控制颜色
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      const meridians = density; // 经线数量由滑块控制
      for (let i = 0; i <= meridians; i++) {
        const x = (i / meridians) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // 绘制纬线（水平线）- 使用白色，让 Shader 控制颜色
      const parallels = Math.floor(density / 2); // 纬线数量约为经线的一半
      for (let i = 0; i <= parallels; i++) {
        const y = (i / parallels) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 更新纹理
      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.colorSpace = THREE.SRGBColorSpace;
      newTexture.wrapS = THREE.RepeatWrapping;
      newTexture.wrapT = THREE.ClampToEdgeWrapping;

      if (this.atmosphereMaterial && this.atmosphereMaterial.uniforms) {
        // 释放旧纹理
        if (this.atmosphereMaterial.uniforms.map.value) {
          this.atmosphereMaterial.uniforms.map.value.dispose();
        }
        this.atmosphereMaterial.uniforms.map.value = newTexture;
      }
    }

    setAtmosphereHeight(height) {
      // 更新大气高度
      this.atmosphereHeight = height;
      
      // 重新创建几何体
      if (this.atmosphereMesh && this.atmosphereGeometry) {
        const newRadius = R * height;
        
        // 移除旧网格
        this.scene.remove(this.atmosphereMesh);
        
        // 释放旧几何体
        this.atmosphereGeometry.dispose();
        
        // 创建新几何体
        this.atmosphereGeometry = new THREE.SphereGeometry(newRadius, 64, 64);
        
        // 创建新网格
        this.atmosphereMesh = new THREE.Mesh(
          this.atmosphereGeometry,
          this.atmosphereMaterial
        );
        
        // 添加到场景
        this.scene.add(this.atmosphereMesh);
      }
      
      // 更新大气层光点位置
      this._updateAtmosphereParticlePositions();
    }

    // 设置大气层光点的不透明度
    setAtmosphereParticleOpacity(opacity) {
      if (this.atmosphereParticleGlobe) {
        this.atmosphereParticleGlobe.setOpacity(opacity);
      }
    }

    // 设置大气层光点的大小
    setAtmosphereParticleSize(min, max) {
      if (this.atmosphereParticleGlobe) {
        this.atmosphereParticleGlobe.setBallSizeMin(min);
        this.atmosphereParticleGlobe.setBallSizeMax(max);
      }
    }

    _onClick(e) {
      this.raycaster.setFromCamera(this.mouse, this.camera);

      // 先测试粒子
      if (this.particleGlobe) {
        const pts = this.particleGlobe.getPoints();
        const hits = this.raycaster.intersectObject(pts);
        if (hits.length) {
          const idx = hits[0].index;
          const name = this.particleGlobe.ballCountryNames?.[idx] ||
                       (window._movieTe?.[idx]?.[2]);
          if (name) {
            this.selectCountry(name, 'language');
            return;
          }
        }
      }

      // 再测试国家
      const hits = this.raycaster.intersectObject(this.pickSphere);
      if (!hits.length) {
        this.clearSelection();
        return;
      }

      const pt = hits[0].point;
      // 把交点变换回局部坐标（消除 globe 旋转）
      const local = this.globeMesh.worldToLocal(pt.clone());
      const { lat, lon } = vec3ToLatLon(local);

      const idx = this.countries.findIndex(cm => hitTestFeature(cm.feature, lat, lon));
      if (idx >= 0) {
        const cm = this.countries[idx];
        this.selectCountry(cm.code || cm.name, 'country');
      } else {
        this.clearSelection();
      }
    }

    selectCountry(value, type) {
      this.selectedValue = value;
      this.selectedType = type;
      // 停止地球自转
      this.autoRotate = false;
      // 取消之前的自动恢复定时器
      clearTimeout(this._autoRotateTimer);

      // 如果是国家，让边线浮起并旋转到中心
      if (type === 'country') {
        // 找到对应的国家索引
        const idx = this.countries.findIndex(cm => (cm.code || cm.name) === value);
        if (idx >= 0) {
          // 如果之前有选中的国家，先取消浮起
          if (this.selectedIdx >= 0 && this.selectedIdx !== idx) {
            this.countries[this.selectedIdx]?.setHighlight(false, this.floatDuration, this.glowIntensity, this.floatHeight, this.glowColor);
          }
          this.selectedIdx = idx;
          // 让边线浮起，使用 force=true 确保即使已经 hover 也能浮起
          this.countries[idx].setHighlight(true, this.floatDuration, this.glowIntensity, this.floatHeight, this.glowColor, true);
          
          // 计算国家中心并旋转到画面中心
          const center = this._getCountryCenter(this.countries[idx].feature);
          if (center) {
            // 使用 rotateSpeed（秒）转换为毫秒
            const duration = this.rotateSpeed * 1000;
            // 传入国家名称，旋转完成后才显示海报
            const chineseName = this._getCountryChineseName(this.countries[idx].name);
            this._rotateToCenter(center.lat, center.lon, duration, chineseName);
          }
        }
      }

      // 发送选中事件
      window.dispatchEvent(new CustomEvent('rle-selection-change', {
        detail: { type: type, value: value }
      }));
    }

    // 计算国家的中心点（使用边界框中心）
    _getCountryCenter(feature) {
      if (!feature || !feature.geometry) return null;
      
      const geometry = feature.geometry;
      let coords = [];
      
      if (geometry.type === 'Polygon') {
        coords = geometry.coordinates[0];
      } else if (geometry.type === 'MultiPolygon') {
        // 取第一个多边形的坐标
        coords = geometry.coordinates[0][0];
      }
      
      if (!coords || !coords.length) return null;
      
      // 计算边界框中心
      let minLon = Infinity, maxLon = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      let validCount = 0;
      
      coords.forEach((coord) => {
        // 安全检查：确保坐标是数组且有至少两个元素
        if (!Array.isArray(coord) || coord.length < 2) return;
        
        const lon = parseFloat(coord[0]);
        const lat = parseFloat(coord[1]);
        
        // 检查是否为有效数字
        if (isNaN(lon) || isNaN(lat)) return;
        
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        validCount++;
      });
      
      // 如果没有有效坐标，返回 null
      if (validCount === 0) return null;
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      
      // 最终检查计算结果
      if (isNaN(centerLat) || isNaN(centerLon)) return null;
      
      return {
        lat: centerLat,
        lon: centerLon
      };
    }

    // 平滑旋转到指定经纬度
    _rotateToCenter(targetLat, targetLon, duration = 1000, countryName = null) {
      // 安全检查
      if (isNaN(targetLat) || isNaN(targetLon) || isNaN(duration)) {
        console.warn('Invalid rotation target:', targetLat, targetLon, duration);
        return;
      }

      // 标记开始旋转，并记录旋转完成后要显示海报的国家
      this.isRotating = true;
      this.selectedCountryForPosters = countryName;

      // 将目标经纬度转换为旋转角度
      // 目标：让目标点转到画面中心（相机前方）
      // 相机在 z 轴正方向，所以目标点应该转到 z 轴正方向

      const startRotationY = this.rotationY;
      const startRotationX = this.rotationX;

      // 计算目标旋转角度
      // 经度直接对应 Y 轴旋转（注意方向）
      const targetRotationY = -targetLon * Math.PI / 180;
      // 纬度对应 X 轴旋转
      const targetRotationX = targetLat * Math.PI / 180;

      // 找到最短旋转路径
      let deltaY = targetRotationY - startRotationY;
      while (deltaY > Math.PI) deltaY -= 2 * Math.PI;
      while (deltaY < -Math.PI) deltaY += 2 * Math.PI;

      // 目标相机距离 - 选中国家时使用固定距离
      const targetDistance = this.selectedCameraDistance;

      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 easeInOutCubic 缓动
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        this.rotationY = startRotationY + deltaY * easeProgress;
        this.rotationX = startRotationX + (targetRotationX - startRotationX) * easeProgress;

        // 限制 X 轴旋转范围
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));

        // 相机距离动画 - 从当前位置动画到选中距离
        const currentDistance = this.camera.position.z;
        const newDistance = currentDistance + (targetDistance - currentDistance) * easeProgress;
        this.cameraDistance = newDistance;
        // 同步更新 targetZoom，使相机实际位置跟随变化
        this.targetZoom = newDistance;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // 旋转完成
          this.isRotating = false;
          // 旋转完成后才显示该国家的海报
          this.setSelectedCountry(this.selectedCountryForPosters);
        }
      };

      animate();
    }

    clearSelection() {
      // 如果之前有选中的国家，取消边线浮起
      if (this.selectedIdx >= 0) {
        this.countries[this.selectedIdx]?.setHighlight(false, this.floatDuration, this.glowIntensity, this.floatHeight, this.glowColor);
        this.selectedIdx = -1;
      }
      this.selectedValue = null;
      this.selectedType = null;
      // 清除选中的国家（隐藏未看海报）
      this.setSelectedCountry(null);
      // 恢复地球自转
      this.autoRotate = true;
      // 恢复相机到默认距离
      this._animateToDefaultDistance();
      // 发送清空事件
      window.dispatchEvent(new CustomEvent('rle-selection-change', {
        detail: { type: null, value: null }
      }));
    }

    // 动画恢复到默认相机距离
    _animateToDefaultDistance(duration) {
      // 如果没有指定duration，使用rotateSpeed（秒）转换为毫秒
      if (duration === undefined) {
        duration = (this.rotateSpeed || 1) * 1000;
      }
      const startDistance = this.camera.position.z;
      const targetDistance = this.defaultCameraDistance;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 easeInOutCubic 缓动
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const newDistance = startDistance + (targetDistance - startDistance) * easeProgress;
        this.cameraDistance = newDistance;
        this.targetZoom = newDistance;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }

    _updateHover() {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObject(this.pickSphere);

      if (!hits.length) {
        if (this.hoveredIdx >= 0) {
          // 只有当前 hover 的国家不是选中的国家时才取消高亮
          if (this.hoveredIdx !== this.selectedIdx) {
            this.countries[this.hoveredIdx]?.setHighlight(false, this.floatDuration);
          }
          this.hoveredIdx = -1;
          document.body.removeAttribute('globe-hover-country');
          this.canvas.style.cursor = 'grab';
        }
        return;
      }

      const pt    = hits[0].point;
      const local = this.globeMesh.worldToLocal(pt.clone());
      const { lat, lon } = vec3ToLatLon(local);

      const idx = this.countries.findIndex(cm => hitTestFeature(cm.feature, lat, lon));

      if (idx !== this.hoveredIdx) {
        // 只有当前 hover 的国家不是选中的国家时才取消高亮
        if (this.hoveredIdx >= 0 && this.hoveredIdx !== this.selectedIdx) {
          this.countries[this.hoveredIdx]?.setHighlight(false, this.floatDuration, this.glowIntensity, this.floatHeight, this.glowColor);
        }
        this.hoveredIdx = idx;
        if (idx >= 0) {
          // 如果当前国家不是选中的国家，才设置高亮
          if (idx !== this.selectedIdx) {
            this.countries[idx].setHighlight(true, this.floatDuration, this.glowIntensity, this.floatHeight, this.glowColor);
          }
          document.body.setAttribute('globe-hover-country', this.countries[idx].name);
          this.canvas.style.cursor = 'pointer';
          
          // 计算国家中心位置并发送事件
          const center = this._getCountryCenter(this.countries[idx].feature);
          if (center) {
            this._updateCountryLabelPosition(center.lat, center.lon, this.countries[idx].name);
          }
        } else {
          document.body.removeAttribute('globe-hover-country');
          this.canvas.style.cursor = 'grab';
          // 清除国家标签位置
          this._updateCountryLabelPosition(null, null, null);
        }
      }
    }
    
    // 更新国家标签位置（发送到HTML显示）
    _updateCountryLabelPosition(lat, lon, name) {
      if (lat === null || lon === null || !name) {
        window.dispatchEvent(new CustomEvent('country-label-update', {
          detail: { visible: false }
        }));
        return;
      }
      
      // 计算国家中心在屏幕上的位置
      const R = 300; // 地球半径
      const labelHeight = R * 1.1; // 标签位置稍高于地球表面
      
      const phi = THREE.MathUtils.degToRad(lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const pos = new THREE.Vector3(
        labelHeight * Math.cos(phi) * Math.sin(theta),
        labelHeight * Math.sin(phi),
        labelHeight * Math.cos(phi) * Math.cos(theta)
      );
      
      // 应用地球旋转
      pos.applyMatrix4(this.globeMesh.matrixWorld);
      
      // 投影到屏幕坐标
      const projected = pos.clone();
      projected.project(this.camera);
      
      // 检查是否在背面
      const camDir = new THREE.Vector3();
      camDir.copy(this.camera.position).normalize();
      const posDir = new THREE.Vector3();
      posDir.copy(pos).normalize();
      const d = posDir.dot(camDir);
      
      if (d < 0.1) {
        // 在背面，隐藏标签
        window.dispatchEvent(new CustomEvent('country-label-update', {
          detail: { visible: false }
        }));
        return;
      }
      
      // 转换为屏幕像素坐标
      const canvas = this.renderer.domElement;
      const sx = (projected.x + 1) / 2 * canvas.width;
      const sy = (1 - projected.y) / 2 * canvas.height;
      
      window.dispatchEvent(new CustomEvent('country-label-update', {
        detail: { 
          visible: true, 
          x: sx, 
          y: sy, 
          name: name 
        }
      }));
    }

    start() {
      this._raf();
    }

    _raf() {
      requestAnimationFrame(() => this._raf());
      const dt = this.clock.getDelta();

      // 自转 + 惯性（暂停时不更新旋转）
      if (!this.motionPaused) {
        if (this.autoRotate) this.rotationY += this.autoRotateSpeed;
        if (!this.isDragging) {
          this.velocityX *= 0.92;
          this.velocityY *= 0.92;
        }

        // 平滑缩放（暂停时不更新摄像机）
        const currentZ = this.camera.position.z;
        if (Math.abs(currentZ - this.targetZoom) > 0.1) {
          this.camera.position.z += (this.targetZoom - currentZ) * 0.1;
        }

        // 更新星环缩放（带阻尼和边缘停靠）
        this._updateTimelineRingScale();
        
        // 调试：每100帧输出一次相机位置
        if (!this._frameCount) this._frameCount = 0;
        this._frameCount++;
        if (this._frameCount % 100 === 0) {
          console.log('[GlobeApp] Camera Z:', this.camera.position.z, 'Target:', this.targetZoom);
        }

        this.globeMesh.rotation.y    = this.rotationY;
        this.globeMesh.rotation.x    = this.rotationX;
        this.pickSphere.rotation.copy(this.globeMesh.rotation);
        this.countryGroup && (this.countryGroup.rotation.copy(this.globeMesh.rotation));
        this.innerSphere.rotation.copy(this.globeMesh.rotation);
        if (this.atmosphereMesh) this.atmosphereMesh.rotation.copy(this.globeMesh.rotation);
        if (this.atm) this.atm.getMesh().rotation.copy(this.globeMesh.rotation);
      }

      // 粒子更新（暂停时停止闪烁）
      if (this.particleGlobe && !this.motionPaused) {
        this.particleGlobe.getPoints().rotation.copy(this.globeMesh.rotation);
        this.particleGlobe.update();
      }
      // 尝试初始化大气层光点（如果还未初始化）
      if (!this._atmosphereParticlesInitialized) {
        this._setupAtmosphereParticles();
      }
      
      // 大气层光点更新
      if (this.atmosphereParticleGlobe && !this.motionPaused) {
        this.atmosphereParticleGlobe.getPoints().rotation.copy(this.globeMesh.rotation);
        this.atmosphereParticleGlobe.update();
      }
      if (this.atm && !this.motionPaused) this.atm.update(dt);

      // hover 检测（每帧）
      if (!this.isDragging) this._updateHover();

      // 使用 Bloom 后期处理渲染
      if (this.bloomEffect && this.bloomEnabled) {
        this.bloomEffect.renderBloom();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }

    // Canvas 海报生成器 - 当真实海报加载失败时使用
    _makePosterCanvas(movie, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // 基于电影名称生成确定性颜色
      const name = movie.name || movie.title || '';
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash = hash & hash;
      }
      const hue = Math.abs(hash) % 360;
      
      // 渐变背景
      const gradient = ctx.createLinearGradient(0, 0, width * 0.4, height);
      gradient.addColorStop(0, `hsl(${hue}, 55%, 13%)`);
      gradient.addColorStop(1, `hsl(${(hue + 50) % 360}, 30%, 4%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // 装饰条
      ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.22)`;
      ctx.fillRect(0, 0, Math.ceil(width * 0.13), height);
      
      // 评分
      const rating = parseFloat(movie.rating) || 0;
      const scoreColor = rating >= 8.5 ? '#FFD700' : rating >= 7.5 ? '#FF8C00' : '#B8B830';
      ctx.fillStyle = scoreColor;
      ctx.font = `bold ${Math.round(height * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rating.toFixed(1), width / 2, height * 0.75);
      
      // 电影名称（垂直显示前4个字）
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `bold ${Math.round(height * 0.12)}px sans-serif`;
      ctx.textBaseline = 'top';
      const chars = [...name].slice(0, 4);
      chars.forEach((ch, i) => {
        ctx.fillText(ch, width / 2, height * 0.06 + i * height * 0.145);
      });
      
      return canvas.toDataURL();
    }

    // 通过国家名称获取中心点
    _getCountryCenterByName(countryName) {
      // 常见国家中心点映射
      const countryCenters = {
        '中国': { lat: 35.0, lon: 104.0 },
        '美国': { lat: 39.8, lon: -98.5 },
        '法国': { lat: 46.2, lon: 2.2 },
        '英国': { lat: 54.0, lon: -2.0 },
        '德国': { lat: 51.2, lon: 10.4 },
        '日本': { lat: 36.2, lon: 138.3 },
        '韩国': { lat: 36.5, lon: 127.9 },
        '意大利': { lat: 41.9, lon: 12.6 },
        '西班牙': { lat: 40.4, lon: -3.7 },
        '加拿大': { lat: 56.0, lon: -106.0 },
        '澳大利亚': { lat: -25.3, lon: 133.8 },
        '印度': { lat: 20.6, lon: 78.9 },
        '巴西': { lat: -14.2, lon: -51.9 },
        '俄罗斯': { lat: 61.5, lon: 105.3 },
        '墨西哥': { lat: 23.6, lon: -102.5 },
        '阿根廷': { lat: -38.4, lon: -63.6 },
        '南非': { lat: -30.6, lon: 22.9 },
        '埃及': { lat: 26.8, lon: 30.8 },
        '土耳其': { lat: 38.9, lon: 35.2 },
        '伊朗': { lat: 32.4, lon: 53.7 },
        '泰国': { lat: 15.8, lon: 100.9 },
        '越南': { lat: 14.1, lon: 108.3 },
        '波兰': { lat: 51.9, lon: 19.1 },
        '荷兰': { lat: 52.1, lon: 5.3 },
        '比利时': { lat: 50.5, lon: 4.5 },
        '瑞典': { lat: 60.1, lon: 18.6 },
        '挪威': { lat: 60.5, lon: 8.0 },
        '丹麦': { lat: 56.3, lon: 9.5 },
        '芬兰': { lat: 61.9, lon: 25.7 },
        '瑞士': { lat: 46.8, lon: 8.2 },
        '奥地利': { lat: 47.5, lon: 14.5 },
        '希腊': { lat: 39.0, lon: 21.8 },
        '葡萄牙': { lat: 39.4, lon: -8.2 },
        '爱尔兰': { lat: 53.4, lon: -8.2 },
        '新西兰': { lat: -40.9, lon: 174.9 },
        '新加坡': { lat: 1.4, lon: 103.8 },
        '马来西亚': { lat: 4.2, lon: 101.9 },
        '印度尼西亚': { lat: -0.8, lon: 113.9 },
        '菲律宾': { lat: 12.9, lon: 121.8 },
        '以色列': { lat: 31.0, lon: 34.9 },
        '阿联酋': { lat: 23.4, lon: 53.8 },
        '沙特阿拉伯': { lat: 23.9, lon: 45.1 },
        '巴基斯坦': { lat: 30.4, lon: 69.3 },
        '孟加拉国': { lat: 23.7, lon: 90.4 },
        '尼日利亚': { lat: 9.1, lon: 8.7 },
        '肯尼亚': { lat: -0.0, lon: 37.9 },
        '摩洛哥': { lat: 31.8, lon: -7.1 },
        '突尼斯': { lat: 33.9, lon: 9.5 },
        '黎巴嫩': { lat: 33.9, lon: 35.9 },
        '喀麦隆': { lat: 7.4, lon: 12.4 },
        '约旦': { lat: 30.6, lon: 36.2 },
        '捷克': { lat: 49.8, lon: 15.5 },
        '匈牙利': { lat: 47.2, lon: 19.4 },
        '罗马尼亚': { lat: 45.9, lon: 24.9 },
        '保加利亚': { lat: 42.7, lon: 25.5 },
        '塞尔维亚': { lat: 44.0, lon: 21.0 },
        '克罗地亚': { lat: 45.1, lon: 15.2 },
        '乌克兰': { lat: 48.4, lon: 31.2 },
        '白俄罗斯': { lat: 53.7, lon: 27.9 },
        '立陶宛': { lat: 55.2, lon: 23.9 },
        '拉脱维亚': { lat: 56.9, lon: 24.6 },
        '爱沙尼亚': { lat: 58.6, lon: 25.0 },
        '斯洛伐克': { lat: 48.7, lon: 19.7 },
        '斯洛文尼亚': { lat: 46.2, lon: 14.9 },
        '卢森堡': { lat: 49.8, lon: 6.1 },
        '冰岛': { lat: 64.9, lon: -19.0 },
        '马耳他': { lat: 35.9, lon: 14.4 },
        '塞浦路斯': { lat: 35.1, lon: 33.4 },
        '中国香港': { lat: 22.3, lon: 114.2 },
        '中国台湾': { lat: 23.7, lon: 120.9 },
        '中国澳门': { lat: 22.2, lon: 113.5 },
        '中国大陆': { lat: 35.0, lon: 104.0 },
        '哥伦比亚': { lat: 4.6, lon: -74.3 },
        '智利': { lat: -35.7, lon: -71.5 },
        '秘鲁': { lat: -9.2, lon: -75.0 },
        '委内瑞拉': { lat: 6.4, lon: -66.6 },
        '厄瓜多尔': { lat: -1.8, lon: -78.2 },
        '乌拉圭': { lat: -32.5, lon: -55.8 },
        '巴拉圭': { lat: -23.4, lon: -58.4 },
        '玻利维亚': { lat: -16.3, lon: -63.6 },
        '苏联': { lat: 61.5, lon: 105.3 }
      };
      
      return countryCenters[countryName] || null;
    }

    // 设置电影海报数据 - 使用经纬度直接定位，大国内均匀分布
    setMoviePosters(movies) {
      // 清除旧的海报
      this.clearMoviePosters();
      
      if (!movies || !movies.length) return;
      
      // 创建海报容器
      if (!this.posterOverlay) {
        this.posterOverlay = document.createElement('div');
        this.posterOverlay.id = 'poster-overlay';
        this.posterOverlay.style.cssText = `
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          overflow: hidden;
        `;
        document.body.appendChild(this.posterOverlay);
      }
      
      const posterEntries = [];
      
      // 按国家分组电影
      const moviesByCountry = new Map();
      movies.forEach(movie => {
        if (!movie.countries_regions || !movie.countries_regions.length) return;
        const country = movie.countries_regions[0];
        if (!moviesByCountry.has(country)) {
          moviesByCountry.set(country, []);
        }
        moviesByCountry.get(country).push(movie);
      });
      
      console.log('[GlobeApp] setMoviePosters 开始, movies=', movies.length, 'countries=', moviesByCountry.size);
      
      // 为每个国家的电影均匀分布位置
      moviesByCountry.forEach((countryMovies, country) => {
        const countryInfo = this._getCountryCenterByName(country);
        if (!countryInfo) return;
        
        // 查找国家的 GeoJSON feature
        const countryEn = this._getCountryEnglishName(country);
        const countryMesh = this.countries.find(cm => 
          cm.name === countryEn || 
          cm.code === countryEn.toLowerCase() ||
          (cm.feature && cm.feature.properties && 
           (cm.feature.properties.NAME === countryEn || cm.feature.properties.ADMIN === countryEn))
        );
        const countryFeature = countryMesh ? countryMesh.feature : null;
        
        const countryRadius = this._getCountryRadius(country); // 获取国家分布半径（度）
        const movieCount = countryMovies.length;
        
        countryMovies.forEach((movie, index) => {
          // 获取电影的经纬度
          let lat = parseFloat(movie.latitude);
          let lon = parseFloat(movie.longitude);
          
          // 如果没有经纬度或经纬度在国家中心附近，则在国家范围内均匀分布
          if (isNaN(lat) || isNaN(lon) || 
              (Math.abs(lat - countryInfo.lat) < 1 && Math.abs(lon - countryInfo.lon) < 1)) {
            
            if (movieCount === 1) {
              // 只有一个电影，放在中心
              lat = countryInfo.lat;
              lon = countryInfo.lon;
            } else {
              // 多个电影，均匀分布（使用GeoJSON边界限制）
              const distribution = this._distributePostersInCountry(countryInfo.lat, countryInfo.lon, countryRadius, movieCount, index, countryFeature);
              lat = distribution.lat;
              lon = distribution.lon;
            }
          }
          
          // 创建海报DOM元素
          const el = this._createPosterElement(movie);
          // 根据当前可见性设置显示状态
          if (this.postersVisible === false) {
            el.style.display = 'none';
          }
          this.posterOverlay.appendChild(el);
          
          // 存储海报数据
          posterEntries.push({
            movie: movie,
            lat: lat,
            lon: lon,
            el: el
          });
        });
      });
      
      this.moviePosters = posterEntries;
      console.log('[GlobeApp] 创建了', posterEntries.length, '个海报');
      
      // 应用已看/未看的显示逻辑
      this._refreshPosterVisibility();
      
      // 开始更新循环
      this._startPosterUpdateLoop();
      
      // 更新粒子位置以匹配海报位置
      this._updateParticlePositions();
      
      // 更新大气层光点位置
      this._updateAtmosphereParticlePositions();
    }
    
    // 中文国家名转英文（用于匹配GeoJSON）
    _getCountryEnglishName(countryName) {
      const countryNameMap = {
        '中国': 'China', '美国': 'United States of America', '法国': 'France',
        '英国': 'United Kingdom', '德国': 'Germany', '日本': 'Japan',
        '韩国': 'Korea, Republic of', '意大利': 'Italy', '西班牙': 'Spain',
        '加拿大': 'Canada', '澳大利亚': 'Australia', '印度': 'India',
        '巴西': 'Brazil', '俄罗斯': 'Russian Federation', '苏联': 'Russian Federation',
        '墨西哥': 'Mexico', '阿根廷': 'Argentina', '南非': 'South Africa',
        '埃及': 'Egypt', '土耳其': 'Turkey', '伊朗': 'Iran, Islamic Republic of',
        '泰国': 'Thailand', '越南': 'Vietnam', '波兰': 'Poland',
        '荷兰': 'Netherlands', '比利时': 'Belgium', '瑞典': 'Sweden',
        '挪威': 'Norway', '丹麦': 'Denmark', '芬兰': 'Finland',
        '瑞士': 'Switzerland', '奥地利': 'Austria', '希腊': 'Greece',
        '葡萄牙': 'Portugal', '爱尔兰': 'Ireland', '新西兰': 'New Zealand',
        '新加坡': 'Singapore', '马来西亚': 'Malaysia', '印度尼西亚': 'Indonesia',
        '菲律宾': 'Philippines', '以色列': 'Israel', '阿联酋': 'United Arab Emirates',
        '沙特阿拉伯': 'Saudi Arabia', '巴基斯坦': 'Pakistan', '孟加拉国': 'Bangladesh',
        '尼日利亚': 'Nigeria', '肯尼亚': 'Kenya', '摩洛哥': 'Morocco',
        '突尼斯': 'Tunisia', '黎巴嫩': 'Lebanon', '喀麦隆': 'Cameroon',
        '约旦': 'Jordan', '捷克': 'Czechia', '匈牙利': 'Hungary',
        '罗马尼亚': 'Romania', '保加利亚': 'Bulgaria', '塞尔维亚': 'Serbia',
        '克罗地亚': 'Croatia', '乌克兰': 'Ukraine', '白俄罗斯': 'Belarus',
        '立陶宛': 'Lithuania', '拉脱维亚': 'Latvia', '爱沙尼亚': 'Estonia',
        '斯洛伐克': 'Slovakia', '斯洛文尼亚': 'Slovenia', '卢森堡': 'Luxembourg',
        '冰岛': 'Iceland', '马耳他': 'Malta', '塞浦路斯': 'Cyprus',
        '中国香港': 'Hong Kong', '中国台湾': 'Taiwan', '中国澳门': 'Macao',
        '中国大陆': 'China', '哥伦比亚': 'Colombia', '智利': 'Chile',
        '秘鲁': 'Peru', '委内瑞拉': 'Venezuela', '厄瓜多尔': 'Ecuador',
        '乌拉圭': 'Uruguay', '巴拉圭': 'Paraguay', '玻利维亚': 'Bolivia'
      };
      return countryNameMap[countryName] || countryName;
    }

    // 英文国家名转中文（用于hover匹配）
    _getCountryChineseName(englishName) {
      const reverseMap = {
        'China': '中国', 'United States of America': '美国', 'France': '法国',
        'United Kingdom': '英国', 'Germany': '德国', 'Japan': '日本',
        'Korea, Republic of': '韩国', 'Italy': '意大利', 'Spain': '西班牙',
        'Canada': '加拿大', 'Australia': '澳大利亚', 'India': '印度',
        'Brazil': '巴西', 'Russian Federation': '俄罗斯', 'Mexico': '墨西哥',
        'Argentina': '阿根廷', 'South Africa': '南非', 'Egypt': '埃及',
        'Turkey': '土耳其', 'Iran, Islamic Republic of': '伊朗',
        'Thailand': '泰国', 'Vietnam': '越南', 'Poland': '波兰',
        'Netherlands': '荷兰', 'Belgium': '比利时', 'Sweden': '瑞典',
        'Norway': '挪威', 'Denmark': '丹麦', 'Finland': '芬兰',
        'Switzerland': '瑞士', 'Austria': '奥地利', 'Greece': '希腊',
        'Portugal': '葡萄牙', 'Ireland': '爱尔兰', 'New Zealand': '新西兰',
        'Singapore': '新加坡', 'Malaysia': '马来西亚', 'Indonesia': '印度尼西亚',
        'Philippines': '菲律宾', 'Israel': '以色列', 'United Arab Emirates': '阿联酋',
        'Saudi Arabia': '沙特阿拉伯', 'Pakistan': '巴基斯坦', 'Bangladesh': '孟加拉国',
        'Nigeria': '尼日利亚', 'Kenya': '肯尼亚', 'Morocco': '摩洛哥',
        'Tunisia': '突尼斯', 'Lebanon': '黎巴嫩', 'Cameroon': '喀麦隆',
        'Jordan': '约旦', 'Czechia': '捷克', 'Hungary': '匈牙利',
        'Romania': '罗马尼亚', 'Bulgaria': '保加利亚', 'Serbia': '塞尔维亚',
        'Croatia': '克罗地亚', 'Ukraine': '乌克兰', 'Belarus': '白俄罗斯',
        'Lithuania': '立陶宛', 'Latvia': '拉脱维亚', 'Estonia': '爱沙尼亚',
        'Slovakia': '斯洛伐克', 'Slovenia': '斯洛文尼亚', 'Luxembourg': '卢森堡',
        'Iceland': '冰岛', 'Malta': '马耳他', 'Cyprus': '塞浦路斯',
        'Hong Kong': '中国香港', 'Taiwan': '中国台湾', 'Macao': '中国澳门',
        'Colombia': '哥伦比亚', 'Chile': '智利', 'Peru': '秘鲁',
        'Venezuela': '委内瑞拉', 'Ecuador': '厄瓜多尔', 'Uruguay': '乌拉圭',
        'Paraguay': '巴拉圭', 'Bolivia': '玻利维亚'
      };
      return reverseMap[englishName] || englishName;
    }

    // 获取国家分布半径（大致估算）
    _getCountryRadius(countryName) {
      const countrySizes = {
        '俄罗斯': 25, '苏联': 25, '加拿大': 20, '中国': 18, '美国': 15,
        '巴西': 15, '澳大利亚': 15, '印度': 12, '阿根廷': 12, '哈萨克斯坦': 12,
        '阿尔及利亚': 10, '刚果民主共和国': 10, '沙特阿拉伯': 10, '墨西哥': 10,
        '印度尼西亚': 10, '苏丹': 9, '利比亚': 9, '伊朗': 9, '蒙古': 9,
        '秘鲁': 8, '乍得': 8, '尼日尔': 8, '安哥拉': 8, '马里': 8,
        '南非': 7, '哥伦比亚': 7, '埃塞俄比亚': 7, '玻利维亚': 7,
        '毛里塔尼亚': 7, '埃及': 7, '坦桑尼亚': 7, '尼日利亚': 7,
        '法国': 6, '西班牙': 5, '瑞典': 5, '德国': 4, '日本': 4,
        '英国': 3, '意大利': 3, '韩国': 2, '新西兰': 5
      };
      return countrySizes[countryName] || 5; // 默认5度
    }
    
    // 在国家范围内均匀分布海报位置 - 使用GeoJSON边界限制
    _distributePostersInCountry(centerLat, centerLon, radius, total, index, countryFeature) {
      if (total <= 1) {
        return { lat: centerLat, lon: centerLon };
      }
      
      // 尝试最多100次找到边界内的点
      for (let attempt = 0; attempt < 100; attempt++) {
        // 使用螺旋分布算法，但添加一些随机性
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 黄金角
        const i = index + attempt * 0.1; // 轻微偏移避免重复
        
        // 计算该点在圆内的位置（使用 Vogel 螺旋）
        const r = radius * Math.sqrt((i + 0.5) / total) * (0.8 + Math.random() * 0.4);
        const theta = i * goldenAngle + attempt * 0.5; // 添加旋转偏移
        
        // 转换为经纬度偏移
        const latOffset = r * Math.cos(theta);
        const lonOffset = r * Math.sin(theta) / Math.cos(centerLat * Math.PI / 180);
        
        let lat = centerLat + latOffset;
        let lon = centerLon + lonOffset;
        
        // 限制范围
        lat = Math.max(-85, Math.min(85, lat));
        lon = ((lon + 180) % 360) - 180;
        
        // 如果有国家边界数据，检查点是否在边界内
        if (countryFeature) {
          if (hitTestFeature(countryFeature, lat, lon)) {
            return { lat, lon };
          }
        } else {
          // 没有边界数据，直接返回
          return { lat, lon };
        }
      }
      
      // 如果100次都没找到边界内的点，返回中心点
      return { lat: centerLat, lon: centerLon };
    }

    // 创建海报DOM元素
    _createPosterElement(movie) {
      const wrap = document.createElement('div');
      wrap.className = 'globe-poster';
      wrap.style.cssText = `
        position: absolute;
        width: ${this.posterSize}px;
        height: ${this.posterSize * 1.5}px;
        border-radius: 2px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        cursor: pointer;
        pointer-events: auto;
        transform: translate(-50%, -50%);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        background: #1a1a2e;
      `;
      
      // 海报图片 - 先用 Canvas 生成默认海报
      const img = document.createElement('img');
      img.src = this._makePosterCanvas(movie, this.posterSize, this.posterSize * 1.5);
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      `;
      
      // 如果有真实海报，尝试加载
      if (movie.poster) {
        const realImg = new Image();
        realImg.onload = () => {
          img.src = movie.poster;
        };
        realImg.src = movie.poster;
      }
      
      wrap.appendChild(img);
      
      // 点击事件
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.showMoviesForCountry && movie.countries_regions && movie.countries_regions.length) {
          window.showMoviesForCountry(movie.countries_regions[0]);
        }
      });
      
      // 悬停显示电影卡片
      wrap.addEventListener('mouseenter', (e) => {
        // 获取海报在屏幕上的位置
        const rect = wrap.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top;
        
        // 显示电影卡片
        if (window.showMovieCard) {
          window.showMovieCard(movie, x, y);
        }
      });
      
      wrap.addEventListener('mouseleave', () => {
        // 隐藏电影卡片
        if (window.hideMovieCard) {
          window.hideMovieCard();
        }
      });
      
      return wrap;
    }

    // 经纬度转3D坐标
    _latLonToVector3(lat, lon, radius) {
      // 使用本文件统一的 latLonToVec3 函数
      const phi = THREE.MathUtils.degToRad(lat);
      const theta = THREE.MathUtils.degToRad(lon);
      return new THREE.Vector3(
        radius * Math.cos(phi) * Math.sin(theta),
        radius * Math.sin(phi),
        radius * Math.cos(phi) * Math.cos(theta)
      );
    }

    // 更新海报位置
    _updatePosterPositions() {
      if (!this.moviePosters || !this.moviePosters.length) return;
      if (!this.camera || !this.renderer) return;
      
      const canvas = this.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      const hw = rect.width * 0.5;
      const hh = rect.height * 0.5;
      
      // 相机位置归一化（用于背面检测）
      const camDir = new THREE.Vector3();
      camDir.copy(this.camera.position).normalize();
      
      const R = 300; // 地球半径（与 GLOBE_SETTINGS 一致）
      const posterHeightOffset = this.posterHeightOffset || 1.05; // 海报高度偏移系数，可通过滑块调节
      const posterHeight = R * posterHeightOffset; // 海报在地球表面稍上方
      
      // 获取年份筛选范围
      const filterStart = this.yearFilterStart;
      const filterEnd = this.yearFilterEnd;
      
      this.moviePosters.forEach(entry => {
        const { lat, lon, el } = entry;

        // 检查年份筛选
        const movieYear = parseInt(entry.movie.year) || 0;
        if (filterStart !== undefined && filterEnd !== undefined) {
          if (movieYear < filterStart || movieYear > filterEnd) {
            el.style.display = 'none';
            return;
          }
        }

        // 检查海报是否应该显示（根据已看/未看逻辑）
        const movieId = entry.movie.id;
        const isWatched = this._shouldShowAsWatched(movieId);
        const isSelected = this.selectedCountry &&
          entry.movie.countries_regions &&
          entry.movie.countries_regions.includes(this.selectedCountry);

        // 如果海报不应该显示（未看且未选中），则隐藏
        if (!isWatched && !isSelected) {
          el.style.display = 'none';
          return;
        }

        // 计算3D坐标（使用本文件统一的坐标计算方式）
        const phi = THREE.MathUtils.degToRad(lat);
        const theta = THREE.MathUtils.degToRad(lon);
        const pos = new THREE.Vector3(
          posterHeight * Math.cos(phi) * Math.sin(theta),
          posterHeight * Math.sin(phi),
          posterHeight * Math.cos(phi) * Math.cos(theta)
        );

        // 应用地球旋转（使用 globeMesh 的矩阵）
        pos.applyMatrix4(this.globeMesh.matrixWorld);

        // 背面检测 - 计算位置向量与相机方向的点积
        const posDir = new THREE.Vector3();
        posDir.copy(pos).normalize();
        const d = posDir.dot(camDir);

        if (d < 0.08) {
          el.style.display = 'none';
          return;
        }

        // 投影到屏幕坐标
        const projected = pos.clone();
        projected.project(this.camera);

        // 设置位置
        el.style.left = Math.round((projected.x + 1) * hw) + 'px';
        el.style.top = Math.round((-projected.y + 1) * hh) + 'px';

        // 检查是否属于当前选中的国家
        const isSelectedCountry = this.selectedCountry &&
          entry.movie.countries_regions &&
          entry.movie.countries_regions.includes(this.selectedCountry);

        // 计算目标缩放比例（选中国家的海报变大）
        const targetScale = isSelectedCountry ? 1.3 : 1.0;

        // 获取当前缩放值（用于平滑过渡）
        if (!entry.currentScale) entry.currentScale = 1.0;

        // 使用滞后系数平滑过渡（0.1 = 慢速跟随，有滞后感）
        const lerpFactor = 0.08;
        entry.currentScale += (targetScale - entry.currentScale) * lerpFactor;

        // 设置过渡时间（与浮起速度相同）
        const transitionDuration = this.floatDuration || 200;
        el.style.transition = `opacity ${transitionDuration}ms ease`;

        // 根据已看/未看状态设置不同的透明度
        if (isWatched) {
          // 已看电影 - 正常显示
          el.style.display = 'block';
          el.style.opacity = Math.min(1, (d - 0.08) / 0.18).toFixed(2);
          el.style.filter = 'none';
          el.style.pointerEvents = d > 0.3 ? 'auto' : 'none';
          // 底部居中锚点：translate(-50%, -100%) 使海报底部居中于点
          // 使用 currentScale 实现滞后放大效果
          el.style.transform = `translate(-50%, -100%) scale(${entry.currentScale.toFixed(3)})`;
        } else {
          // 未看电影但国家被选中 - 简单半透明显示
          el.style.display = 'block';
          el.style.opacity = '0.3'; // 简单固定透明度
          el.style.filter = 'grayscale(100%)';
          el.style.pointerEvents = 'none';
          // 底部居中锚点
          el.style.transform = `translate(-50%, -100%) scale(${entry.currentScale.toFixed(3)})`;
        }
      });
    }

    // 启动海报更新循环
    _startPosterUpdateLoop() {
      const update = () => {
        if (this.moviePosters && this.moviePosters.length > 0) {
          this._updatePosterPositions();
        }
        requestAnimationFrame(update);
      };
      update();
    }

    // 清除所有海报
    clearMoviePosters() {
      if (this.moviePosters) {
        this.moviePosters.forEach(entry => {
          if (entry.el && entry.el.parentNode) {
            entry.el.parentNode.removeChild(entry.el);
          }
        });
      }
      this.moviePosters = [];
    }

    // 设置海报大小
    setPosterSize(size) {
      this.posterSize = size;
      // 更新现有海报大小
      if (this.moviePosters) {
        this.moviePosters.forEach(entry => {
          if (entry.el) {
            entry.el.style.width = size + 'px';
            entry.el.style.height = (size * 1.5) + 'px';
          }
        });
      }
    }

    // 设置海报高度偏移（解决位置偏移问题）
    setPosterHeightOffset(offset) {
      this.posterHeightOffset = offset;
      // 触发一次位置更新
      if (this.moviePosters && this.moviePosters.length > 0) {
        this._updatePosterPositions();
      }
    }

    // 显示/隐藏电影海报
    togglePosters(visible) {
      this.postersVisible = visible;
      if (this.moviePosters) {
        this.moviePosters.forEach(entry => {
          if (entry.el) {
            entry.el.style.display = visible ? 'block' : 'none';
          }
        });
      }
    }

    // ========== 已看电影记录功能 ==========
    
    // 从localStorage加载已看电影记录
    _loadWatchedMovies() {
      try {
        const stored = localStorage.getItem('globeWatchedMovies');
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    }
    
    // 保存已看电影记录到localStorage
    _saveWatchedMovies() {
      try {
        localStorage.setItem('globeWatchedMovies', JSON.stringify(this.watchedMovies));
      } catch (e) {
        console.warn('Failed to save watched movies:', e);
      }
    }
    
    // 切换电影观看状态
    toggleWatched(movieId) {
      if (this.watchedMovies[movieId]) {
        delete this.watchedMovies[movieId];
      } else {
        this.watchedMovies[movieId] = true;
      }
      this._saveWatchedMovies();
      // 刷新海报显示
      this._refreshPosterVisibility();
    }
    
    // 检查电影是否已看过
    isWatched(movieId) {
      return !!this.watchedMovies[movieId];
    }
    
    // 设置已看电影显示比例
    setWatchedRatio(ratio) {
      this.watchedRatio = Math.max(0, Math.min(1, ratio));
      this._refreshPosterVisibility();
    }
    
    // 刷新随机种子
    refreshRandomSeed() {
      this.randomSeed = Math.random();
      this._refreshPosterVisibility();
    }
    
    // 根据随机种子和比例判断电影是否应该显示为已看
    _shouldShowAsWatched(movieId) {
      // 如果用户明确标记为已看，总是显示
      if (this.watchedMovies[movieId]) return true;
      
      // 根据随机种子和比例决定是否显示
      const hash = this._hashString(movieId + this.randomSeed);
      return hash < this.watchedRatio;
    }
    
    // 简单的字符串哈希函数
    _hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) / 2147483647; // 归一化到0-1
    }
    
    // 刷新海报可见性
    _refreshPosterVisibility() {
      if (!this.moviePosters) return;
      
      let watchedCount = 0;
      let hiddenCount = 0;
      
      this.moviePosters.forEach(entry => {
        const movieId = entry.movie.id;
        const isWatched = this._shouldShowAsWatched(movieId);
        const isHovered = this.hoveredCountry && 
          entry.movie.countries_regions && 
          entry.movie.countries_regions.includes(this.hoveredCountry);
        
        if (isWatched) {
          // 已看电影 - 正常显示
          entry.el.style.opacity = '1';
          entry.el.style.display = 'block';
          entry.el.style.filter = 'none';
          entry.el.style.pointerEvents = 'auto';
          watchedCount++;
        } else if (isHovered) {
          // 未看电影但国家被hover - 半透明显示
          entry.el.style.opacity = '0.4';
          entry.el.style.display = 'block';
          entry.el.style.filter = 'grayscale(80%)';
          entry.el.style.pointerEvents = 'none';
        } else {
          // 未看电影且国家未hover - 隐藏
          entry.el.style.display = 'none';
          hiddenCount++;
        }
      });
      
      console.log('[GlobeApp] 海报可见性更新:', { watched: watchedCount, hidden: hiddenCount, ratio: this.watchedRatio, seed: this.randomSeed });
    }
    
    // 设置当前选中的国家（用于显示未看海报）
    setSelectedCountry(countryName) {
      this.selectedCountry = countryName;
      // 不需要调用 _refreshPosterVisibility，因为 _updatePosterPositions 每帧都会更新
    }
  }

  window.GlobeApp = GlobeApp;
})();
