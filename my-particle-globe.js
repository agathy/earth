// 替换 assets/B1Ppr2Cb.min.js
import * as THREE from './assets/three.module.min.js';
(function () {
  const S = window.GLOBE_SETTINGS;

  const vertexShader = `
uniform float time;
uniform float speed;
uniform float twistFactor;
uniform float interactionStrength;
uniform float rayLength;
uniform float glowSizeBoost;
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
  vNoise = clamp(0.5 + 0.5 * perlinNoise(noisePosBase), 0.0, 1.0);
  float wobblePhase = wobbleTime + time * wobbleFrequency;
  vec3 wobbleOffset = vec3(
    perlinNoise(position.xy * 0.5 + wobblePhase) * 2.0 - 1.0,
    perlinNoise(position.yz * 0.5 + wobblePhase) * 2.0 - 1.0,
    perlinNoise(position.zx * 0.5 + wobblePhase) * 2.0 - 1.0
  ) * wobbleStrength;
  float outwardFactor = smoothstep(0.6, 0.9, vNoise);
  vec3 finalPosition = position + wobbleOffset + normalize(position) * outwardFactor * rayLength;
  vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float sizeFactor = 0.25 + (0.5 * vNoise) + (outwardFactor * glowSizeBoost);
  gl_PointSize = (3500.0 * sizeFactor) * (1.0 / -mvPosition.z);
}`;

  const fragmentShader = `
uniform float opacity;
uniform sampler2D pointTexture;
uniform vec3 color1; uniform vec3 color2; uniform vec3 color3;
uniform vec3 color4; uniform vec3 color5;
varying float vNoise;
void main() {
  float glowIntensity = smoothstep(0.60, 0.85, vNoise);
  vec4 texColor = texture2D(pointTexture, gl_PointCoord);
  float finalAlpha = opacity * max(0.05, smoothstep(0.4, 0.7, vNoise)) * texColor.a;
  if (finalAlpha < 0.005) discard;
  float colorPhase = glowIntensity * 4.0;
  vec3 glowColor;
  if (colorPhase <= 1.0)      glowColor = mix(color1, color2, colorPhase);
  else if (colorPhase <= 2.0) glowColor = mix(color2, color3, colorPhase - 1.0);
  else if (colorPhase <= 3.0) glowColor = mix(color3, color4, colorPhase - 2.0);
  else                        glowColor = mix(color4, color5, colorPhase - 3.0);
  vec3 finalColor = vec3(1.5) * (1.0 - glowIntensity) + glowColor * glowIntensity * 3.0;
  gl_FragColor = vec4(finalColor, finalAlpha);
}`;

  function makeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0,   'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  const c1 = new THREE.Color(0xFF8820);
  const c2 = new THREE.Color(0xFF6420);
  const c3 = new THREE.Color(0xFF8820);
  const c4 = new THREE.Color(0xFF6420);
  const c5 = new THREE.Color(0xFF8820);

  class ParticleGlobe {
    constructor() {
      const n = S.NUMBER_OF_BALLS;
      this.geometry     = new THREE.BufferGeometry();
      this.clock        = new THREE.Clock();
      this.ballPositions = new Float32Array(n * 3);
      this.positions    = new Array(n);
      this.currentOpacity = 1;
      this.targetOpacity  = 1;
      this.mousePos   = new THREE.Vector2(0, 0);
      this.targetPos  = new THREE.Vector2(0, 0);
      this.targetInteractionStrength  = 0;
      this.currentInteractionStrength = 0;
      this.lastMouseMove = 0;
      this.mouseIdleTimeout = 200;

      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.ballPositions, 3));

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          pointTexture:        { value: makeTexture() },
          opacity:             { value: 1 },
          time:                { value: 0 },
          speed:               { value: S.GLOBE_GLOW_SPEED },
          glowSizeBoost:       { value: S.GLOBE_GLOW_BOOST },
          rayLength:           { value: 0 },
          mousePos:            { value: this.mousePos },
          twistFactor:         { value: 0 },
          interactionStrength: { value: 0 },
          color1: { value: c1 }, color2: { value: c2 }, color3: { value: c3 },
          color4: { value: c4 }, color5: { value: c5 },
          wobbleFrequency: { value: S.GLOBE_WOBBLE_FREQUENCY },
          wobbleTime:      { value: 0 },
          wobbleStrength:  { value: S.GLOBE_WOBBLE_STRENGTH },
        },
        vertexShader, fragmentShader,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      this.points = new THREE.Points(this.geometry, this.material);
      this._onMouseMove = this._onMouseMove.bind(this);
      window.addEventListener('mousemove', this._onMouseMove);
    }

    _onMouseMove(e) {
      this.targetPos.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.targetPos.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.lastMouseMove = Date.now();
      this.targetInteractionStrength = 1;
    }

    updateBallPosition(idx, vec3, name) {
      if (idx < 0 || idx >= S.NUMBER_OF_BALLS) return;
      const i = idx * 3;
      this.ballPositions[i]     = vec3.x;
      this.ballPositions[i + 1] = vec3.y;
      this.ballPositions[i + 2] = vec3.z;
      this.positions[idx] = vec3.clone();
      this.geometry.attributes.position.needsUpdate = true;
    }

    update() {
      const dt = this.clock.getDelta();
      this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.targetOpacity, 0.05);
      this.material.uniforms.opacity.value = this.currentOpacity;
      this.mousePos.lerp(this.targetPos, 0.08);
      if (Date.now() - this.lastMouseMove > this.mouseIdleTimeout) this.targetInteractionStrength = 0;
      this.currentInteractionStrength = THREE.MathUtils.lerp(
        this.currentInteractionStrength, this.targetInteractionStrength, 0.01);
      this.material.uniforms.interactionStrength.value = this.currentInteractionStrength;
      this.material.uniforms.time.value += dt;
    }

    getPoints() { return this.points; }

    dispose() {
      window.removeEventListener('mousemove', this._onMouseMove);
      this.geometry.dispose();
      this.material.dispose();
    }
  }

  window.ParticleGlobe = ParticleGlobe;
})();
