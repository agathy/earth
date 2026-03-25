// 替换 assets/BjblsY1K.min.js
import * as THREE from './assets/three.module.min.js';
(function () {
  const R = window.GLOBE_SETTINGS.GLOBE_RADIUS;

  class AtmosphereSphere {
    constructor(lerpSpeed = 0.05) {
      this.currentOpacity = 1;
      this.targetOpacity  = 1;
      this.lerpSpeed = lerpSpeed;

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          centerOpacity:  { value: 0 },
          edgeOpacity:    { value: 0.5 },
          edgePower:      { value: 5.0 },
          glowColor:      { value: new THREE.Color(0x2266ff) },
          overallOpacity: { value: 1 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }`,
        fragmentShader: `
          uniform float centerOpacity;
          uniform float edgeOpacity;
          uniform float edgePower;
          uniform vec3  glowColor;
          uniform float overallOpacity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            float dotNV = dot(normalize(vViewPosition), normalize(vNormal));
            float edgeFactor = pow(max(0.0, 1.0 - abs(dotNV)), edgePower);
            float alpha = mix(centerOpacity, edgeOpacity, edgeFactor) * overallOpacity;
            gl_FragColor = vec4(glowColor, alpha);
          }`,
        transparent: true,
        depthWrite:  false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
      });

      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(R + 8, 64, 64),
        this.material
      );
    }

    setOpacity(v) { this.targetOpacity = THREE.MathUtils.clamp(v, 0, 1); }

    update(dt = 1 / 60) {
      if (Math.abs(this.currentOpacity - this.targetOpacity) > 0.001) {
        const t = 1 - Math.pow(0.001, dt);
        this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.targetOpacity, t);
        this.material.uniforms.overallOpacity.value = this.currentOpacity;
      }
    }

    getMesh() { return this.mesh; }
  }

  window.AtmosphereSphere = AtmosphereSphere;
})();

