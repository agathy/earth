// 替换 assets/BjblsY1K.min.js
import * as THREE from './assets/three.module.min.js';
(function () {
  const R = window.GLOBE_SETTINGS.GLOBE_RADIUS;

  class AtmosphereSphere {
    constructor(textureUrl, lerpSpeed = 0.05) {
      this.currentOpacity = 1;
      this.targetOpacity  = 1;
      this.lerpSpeed = lerpSpeed;

      const tex = new THREE.TextureLoader().load(textureUrl);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          sphereTexture: { value: tex },
          centerOpacity: { value: 0 },
          edgeOpacity:   { value: 0.2 },
          edgePower:     { value: 6 },
          overallOpacity:{ value: 1 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vUv = uv;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }`,
        fragmentShader: `
          uniform sampler2D sphereTexture;
          uniform float centerOpacity;
          uniform float edgeOpacity;
          uniform float edgePower;
          uniform float overallOpacity;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            float dotNV = dot(normalize(vViewPosition), normalize(vNormal));
            float edgeFactor = pow(max(0.0, 1.0 - abs(dotNV)), edgePower);
            float finalOpacity = mix(centerOpacity, edgeOpacity, edgeFactor);
            vec4 texColor = texture2D(sphereTexture, vUv);
            float finalAlpha = texColor.a * finalOpacity * overallOpacity;
            gl_FragColor = vec4(texColor.rgb, finalAlpha);
            if (any(isnan(gl_FragColor))) gl_FragColor = vec4(0.0);
          }`,
        transparent: true, depthWrite: false,
        side: THREE.FrontSide,
      });

      this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R + 5, 64, 64), this.material);
      this.mesh.rotation.x = -Math.PI / 2;
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
