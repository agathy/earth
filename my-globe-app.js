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
      // 每个 ring 独立一条 LineLoop，避免 LineSegments 的点对逻辑
      const rings = geometry.type === 'Polygon'
        ? geometry.coordinates
        : geometry.coordinates.flat();

      this.lineMaterial = new THREE.LineBasicMaterial({
        color: 0x22AA88,
        transparent: true,
        opacity: 0.35,
        depthTest: true,
      });

      this.lines = [];
      rings.forEach(ring => {
        if (!ring || ring.length < 2) return;   // 跳过无效 ring
        const buf = new Float32Array(ring.length * 3);
        let hasNaN = false;
        ring.forEach(([lon, lat], i) => {
          const v = latLonToVec3(radius + 0.5, lat, lon);
          buf[i * 3]     = v.x;
          buf[i * 3 + 1] = v.y;
          buf[i * 3 + 2] = v.z;
          if (isNaN(v.x) || isNaN(v.y) || isNaN(v.z)) hasNaN = true;
        });
        if (hasNaN) return;                      // 跳过含 NaN 的 ring
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(buf, 3));
        const loop = new THREE.LineLoop(geo, this.lineMaterial);
        this.lines.push(loop);
        this.group.add(loop);
      });
    }

    setHighlight(on) {
      if (this.highlighted === on) return;
      this.highlighted = on;
      this.lineMaterial.color.set(on ? 0x55FFCC : 0x22AA88);
      this.lineMaterial.opacity = on ? 0.9 : 0.35;
    }

    getGroup() { return this.group; }
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
      this.rotationY      = 0;
      this.rotationX      = 0;
      this.velocityY      = 0;
      this.velocityX      = 0;
      this.autoRotate     = true;
      this.autoRotateSpeed = 0.0008;

      this._setupRenderer();
      this._setupCamera();
      this._setupLights();
      this._setupGlobe();
      this._setupParticles();
      this._setupAtmosphere();
      this._setupCountries();
      this._setupPicking();
      this._setupEvents();
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
      this.camera.position.set(0, 0, 900);
    }

    _setupLights() {
      this.scene.add(new THREE.AmbientLight(0x111122, 1.2));
      const dir = new THREE.DirectionalLight(0xfff5ee, 1.0);
      dir.position.set(3, 1, 2);
      this.scene.add(dir);
    }

    _setupGlobe() {
      // 主球体（深色，接受灯光）
      this.globeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 64),
        new THREE.MeshPhongMaterial({
          color: 0x0b1728,
          shininess: 15,
          transparent: false,
        })
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
      this.scene.add(this.particleGlobe.getPoints());

      // 把电影坐标映射到球面
      const te = window._movieTe || [];
      const n  = Math.min(te.length, S.NUMBER_OF_BALLS);
      for (let i = 0; i < n; i++) {
        const [lat, lon, name] = te[i];
        const v = latLonToVec3(R, lat, lon);
        this.particleGlobe.updateBallPosition(i, v, name);
      }
    }

    _setupAtmosphere() {
      if (!window.AtmosphereSphere) return;
      this.atm = new window.AtmosphereSphere(0.03);
      this.atm.setOpacity(0.6);
      this.scene.add(this.atm.getMesh());
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

      c.style.cursor = 'grab';
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
            window.dispatchEvent(new CustomEvent('rle-selection-change', {
              detail: { type: 'language', value: name }
            }));
            return;
          }
        }
      }

      // 再测试国家
      const hits = this.raycaster.intersectObject(this.pickSphere);
      if (!hits.length) {
        window.dispatchEvent(new CustomEvent('rle-selection-change', {
          detail: { type: null, value: null }
        }));
        return;
      }

      const pt = hits[0].point;
      // 把交点变换回局部坐标（消除 globe 旋转）
      const local = this.globeMesh.worldToLocal(pt.clone());
      const { lat, lon } = vec3ToLatLon(local);

      const idx = this.countries.findIndex(cm => hitTestFeature(cm.feature, lat, lon));
      if (idx >= 0) {
        const cm = this.countries[idx];
        this.selectedIdx = idx;
        window.dispatchEvent(new CustomEvent('rle-selection-change', {
          detail: { type: 'country', value: cm.code || cm.name }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('rle-selection-change', {
          detail: { type: null, value: null }
        }));
      }
    }

    _updateHover() {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObject(this.pickSphere);

      if (!hits.length) {
        if (this.hoveredIdx >= 0) {
          this.countries[this.hoveredIdx]?.setHighlight(false);
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
        if (this.hoveredIdx >= 0) this.countries[this.hoveredIdx]?.setHighlight(false);
        this.hoveredIdx = idx;
        if (idx >= 0) {
          this.countries[idx].setHighlight(true);
          document.body.setAttribute('globe-hover-country', this.countries[idx].name);
          this.canvas.style.cursor = 'pointer';
        } else {
          document.body.removeAttribute('globe-hover-country');
          this.canvas.style.cursor = 'grab';
        }
      }
    }

    start() {
      this._raf();
    }

    _raf() {
      requestAnimationFrame(() => this._raf());
      const dt = this.clock.getDelta();

      // 自转 + 惯性
      if (this.autoRotate) this.rotationY += this.autoRotateSpeed;
      if (!this.isDragging) {
        this.velocityX *= 0.92;
        this.velocityY *= 0.92;
      }

      this.globeMesh.rotation.y    = this.rotationY;
      this.globeMesh.rotation.x    = this.rotationX;
      this.pickSphere.rotation.copy(this.globeMesh.rotation);
      this.countryGroup && (this.countryGroup.rotation.copy(this.globeMesh.rotation));
      this.innerSphere.rotation.copy(this.globeMesh.rotation);
      if (this.atm) this.atm.getMesh().rotation.copy(this.globeMesh.rotation);
      if (this.particleGlobe) {
        this.particleGlobe.getPoints().rotation.copy(this.globeMesh.rotation);
        this.particleGlobe.update();
      }
      if (this.atm) this.atm.update(dt);

      // hover 检测（每帧）
      if (!this.isDragging) this._updateHover();

      this.renderer.render(this.scene, this.camera);
    }
  }

  window.GlobeApp = GlobeApp;
})();
