// Standalone Particle Globe - 使用模块导入
import * as THREE from './assets/three.module.min.js';

class ParticleGlobe {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.currentOpacity = 1;
    this.targetOpacity = 1;
    this.clock = new THREE.Clock();
    this.mousePos = new THREE.Vector2(0, 0);
    this.targetPos = new THREE.Vector2(0, 0);
    this.lastMouseMoveTime = 0;
    this.mouseIdleTimeout = 200;
    this.targetInteractionStrength = 0;
    this.currentInteractionStrength = 0;
    this.interactionLerpFactor = 0.01;
    this.positions = [];
    this.dimmed = false;
    this.selectedCountries = [];

    // 默认粒子数量
    this.numberOfBalls = 1000;
    this.ballPositions = new Float32Array(this.numberOfBalls * 3);
    this.ballCountryNames = new Array(this.numberOfBalls);
    this.positions = new Array(this.numberOfBalls);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.ballPositions, 3));
    this.pointTexture = this.createTexture();

    // 顶点着色器
    const vertexShader = `
      uniform float time;
      uniform float speed;
      uniform float twistFactor;
      uniform float interactionStrength;
      uniform float rayLength;
      uniform float glowSizeBoost;
      uniform float ballSizeMin;
      uniform float ballSizeMax;
      uniform float wobbleFrequency;
      uniform float wobbleTime;
      uniform float wobbleStrength;

      varying vec3 vPosition;
      varying float vNoise;

      const float noiseScale = 0.008;

      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }

      float perlinNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        vec2 g00 = hash(i + vec2(0.0, 0.0)); vec2 g10 = hash(i + vec2(1.0, 0.0));
        vec2 g01 = hash(i + vec2(0.0, 1.0)); vec2 g11 = hash(i + vec2(1.0, 1.0));
        float d00 = dot(g00, f - vec2(0.0, 0.0)); float d10 = dot(g10, f - vec2(1.0, 0.0));
        float d01 = dot(g01, f - vec2(0.0, 1.0)); float d11 = dot(g11, f - vec2(1.0, 1.0));
        return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y);
      }

      void main() {
        vPosition = position;

        vec2 noisePosBase = vPosition.xy * noiseScale + vec2(time * speed * 0.2, time * speed * 0.15);
        vNoise = 0.5 + 0.5 * perlinNoise(noisePosBase);
        vNoise = clamp(vNoise, 0.0, 1.0);

        float wobblePhase = wobbleTime + time * wobbleFrequency;
        float wobbleX = perlinNoise(position.xy * 0.5 + wobblePhase) * 2.0 - 1.0;
        float wobbleY = perlinNoise(position.yz * 0.5 + wobblePhase) * 2.0 - 1.0;
        float wobbleZ = perlinNoise(position.zx * 0.5 + wobblePhase) * 2.0 - 1.0;
        vec3 wobbleOffset = vec3(wobbleX, wobbleY, wobbleZ) * wobbleStrength;

        vec3 targetPosition = position + wobbleOffset;

        float outwardFactor = smoothstep(0.6, 0.9, vNoise);
        vec3 originalNormal = normalize(position);
        vec3 rayDisplacement = originalNormal * outwardFactor * rayLength;

        vec3 finalPosition = targetPosition + rayDisplacement;

        vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float sizeFactor = 0.3 + (0.25 * vNoise) + (outwardFactor * glowSizeBoost * 0.3);
        // 添加基于时间的动态大小波动
        float sizeWobble = 0.15 * sin(time * 2.0 + vNoise * 10.0);
        sizeFactor = max(0.35, sizeFactor + sizeWobble);
        float baseBallSize = mix(ballSizeMin, ballSizeMax, 0.5);
        gl_PointSize = (baseBallSize * sizeFactor) * (1.0 / -mvPosition.z);
      }
    `;

    // 片段着色器
    const fragmentShader = `
      uniform float opacity;
      uniform sampler2D pointTexture;
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;
      uniform vec3 color4;
      uniform vec3 color5;

      varying float vNoise;

      void main() {
        float glowIntensity = smoothstep(0.60, 0.85, vNoise);

        vec4 texColor = texture2D(pointTexture, gl_PointCoord);
        float minPointAlpha = 0.85;
        float noiseAlphaFactor = smoothstep(0.4, 0.7, vNoise);
        float calculatedAlpha = max(minPointAlpha, noiseAlphaFactor) * texColor.a;
        float finalAlpha = opacity * calculatedAlpha;

        if (finalAlpha < 0.005) discard;

        float colorPhase = glowIntensity * 4.0;
        vec3 glowColor;

        if (colorPhase <= 1.0)      glowColor = mix(color1, color2, colorPhase);
        else if (colorPhase <= 2.0) glowColor = mix(color2, color3, colorPhase - 1.0);
        else if (colorPhase <= 3.0) glowColor = mix(color3, color4, colorPhase - 2.0);
        else                        glowColor = mix(color4, color5, colorPhase - 3.0);

        float baseBrightness = 0.6;
        vec3 baseComponent = vec3(baseBrightness) * (1.0 - glowIntensity);

        float glowBrightness = 1.2;
        vec3 glowComponent = glowColor * glowIntensity * glowBrightness;

        vec3 finalColor = baseComponent + glowComponent;

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    // 颜色定义 (金黄色调)
    const color1 = new THREE.Color(0xFFA500);
    const color2 = new THREE.Color(0xFF8C00);
    const color3 = new THREE.Color(0xFFA500);
    const color4 = new THREE.Color(0xFF8C00);
    const color5 = new THREE.Color(0xFFA500);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: this.pointTexture },
        opacity: { value: this.currentOpacity },
        time: { value: 0 },
        speed: { value: 0.5 },
        glowSizeBoost: { value: 0.5 },
        rayLength: { value: 0 },
        mousePos: { value: this.mousePos },
        warpStrength: { value: true },
        warpRadius: { value: 1000 },
        twistFactor: { value: 0 },
        interactionStrength: { value: this.currentInteractionStrength },
        color1: { value: color1 },
        color2: { value: color2 },
        color3: { value: color3 },
        color4: { value: color4 },
        color5: { value: color5 },
        wobbleFrequency: { value: 1.0 },
        wobbleTime: { value: 0 },
        wobbleStrength: { value: 0.3 },
        ballSizeMin: { value: 6000.0 },
        ballSizeMax: { value: 9000.0 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);

    this.onMouseMove = this.onMouseMove.bind(this);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(t) {
    this.targetPos.x = t.clientX / window.innerWidth * 2 - 1;
    this.targetPos.y = -(t.clientY / window.innerHeight) * 2 + 1;
    this.lastMouseMoveTime = Date.now();
    this.targetInteractionStrength = 1;
  }

  createTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  getPoints() {
    return this.points;
  }

  update() {
    const delta = this.clock.getDelta();
    const time = this.clock.elapsedTime;

    this.material.uniforms.time.value = time;
    this.material.uniforms.wobbleTime.value = time;

    // 平滑插值交互强度
    this.currentInteractionStrength += (this.targetInteractionStrength - this.currentInteractionStrength) * this.interactionLerpFactor;
    this.material.uniforms.interactionStrength.value = this.currentInteractionStrength;

    // 检查鼠标是否静止
    if (Date.now() - this.lastMouseMoveTime > this.mouseIdleTimeout) {
      this.targetInteractionStrength = 0;
    }

    // 平滑插值鼠标位置
    this.mousePos.x += (this.targetPos.x - this.mousePos.x) * 0.05;
    this.mousePos.y += (this.targetPos.y - this.mousePos.y) * 0.05;

    // 透明度动画
    this.currentOpacity += (this.targetOpacity - this.currentOpacity) * 0.1;
    this.material.uniforms.opacity.value = this.currentOpacity;
  }

  setOpacity(opacity) {
    this.targetOpacity = opacity;
  }

  setBallSizeMin(size) {
    this.material.uniforms.ballSizeMin.value = Math.max(1000, Math.min(20000, size));
  }

  setBallSizeMax(size) {
    this.material.uniforms.ballSizeMax.value = Math.max(2000, Math.min(10000, size));
  }

  updateBallPosition(index, position, name) {
    if (index < 0 || index >= this.numberOfBalls) return;
    const i = index * 3;
    this.ballPositions[i] = position.x;
    this.ballPositions[i + 1] = position.y;
    this.ballPositions[i + 2] = position.z;
    this.ballCountryNames[index] = name;
    if (this.positions[index]) {
      this.positions[index].copy(position);
    } else {
      this.positions[index] = position.clone();
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  setSelectedCountries(countries) {
    this.selectedCountries = countries;
    if (this.selectedCountries.length === 0) {
      this.material.uniforms.glowSizeBoost.value = 0.5;
    } else {
      this.material.uniforms.glowSizeBoost.value = 1.5;
    }
  }

  setGlowColors(c1, c2, c3, c4, c5) {
    const setColor = (name, color) => {
      const uniform = this.material.uniforms[name];
      if (uniform) {
        if (color instanceof THREE.Color) {
          uniform.value.copy(color);
        } else {
          uniform.value.set(color);
        }
      }
    };
    setColor('color1', c1);
    setColor('color2', c2);
    setColor('color3', c3);
    setColor('color4', c4);
    setColor('color5', c5);
  }

  setSpeed(speed) {
    if (this.material.uniforms.speed) {
      this.material.uniforms.speed.value = Math.max(0, speed);
    }
  }

  setGlowSizeBoost(boost) {
    if (this.material.uniforms.glowSizeBoost) {
      this.material.uniforms.glowSizeBoost.value = Math.max(0, boost);
    }
  }

  setRayLength(length) {
    if (this.material.uniforms.rayLength) {
      this.material.uniforms.rayLength.value = Math.max(0, length);
    }
  }

  setScale(scale) {
    this.points.scale.set(scale, scale, scale);
  }

  dispose() {
    window.removeEventListener('mousemove', this.onMouseMove);
    this.geometry?.dispose();
    this.material?.dispose();
    this.pointTexture?.dispose();
    this.ballPositions = new Float32Array(0);
    this.ballCountryNames = [];
    this.positions = [];
  }
}

// 导出到全局
window.ParticleGlobe = ParticleGlobe;
