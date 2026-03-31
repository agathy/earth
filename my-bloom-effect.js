// Bloom 后期处理效果 - 使用 UnrealBloomPass
import * as THREE from './assets/three.module.min.js';

// 简单的 EffectComposer 实现（不依赖额外模块）
class SimpleEffectComposer {
  constructor(renderer) {
    this.renderer = renderer;
    this.passes = [];
    this.renderTarget1 = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        stencilBuffer: false
      }
    );
    this.renderTarget2 = this.renderTarget1.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }

  addPass(pass) {
    this.passes.push(pass);
    pass.setSize(window.innerWidth, window.innerHeight);
  }

  render(scene, camera) {
    // 第一个 pass 渲染到 writeBuffer
    let currentRenderTarget = this.renderer.getRenderTarget();

    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];

      if (pass.render) {
        if (i === 0) {
          // 第一个 pass 直接渲染场景
          pass.render(this.renderer, this.writeBuffer, scene, camera);
        } else {
          // 后续 pass 使用 readBuffer 作为输入
          pass.render(this.renderer, this.writeBuffer, this.readBuffer.texture);
        }
      }

      // 交换 buffer
      const tmp = this.readBuffer;
      this.readBuffer = this.writeBuffer;
      this.writeBuffer = tmp;
    }

    // 最后渲染到屏幕
    this.renderer.setRenderTarget(null);
    this.renderer.render(scene, camera);
  }

  setSize(width, height) {
    this.renderTarget1.setSize(width, height);
    this.renderTarget2.setSize(width, height);
    this.passes.forEach(pass => pass.setSize && pass.setSize(width, height));
  }
}

// 简化的 Bloom Pass - 使用高斯模糊模拟辉光
class SimpleBloomPass {
  constructor(strength = 1.5, radius = 0.4, threshold = 0.1) {
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;

    // 创建提取高亮区域的 shader
    this.highPassShader = {
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: threshold }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          float brightness = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          float contribution = max(0.0, brightness - threshold) / (1.0 - threshold);
          gl_FragColor = vec4(texel.rgb * contribution, texel.a);
        }
      `
    };

    // 创建水平模糊 shader
    this.horizontalBlurShader = {
      uniforms: {
        tDiffuse: { value: null },
        h: { value: 1.0 / window.innerWidth },
        radius: { value: radius }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float h;
        uniform float radius;
        varying vec2 vUv;

        void main() {
          vec4 sum = vec4(0.0);
          float samples = 15.0;
          float sigma = radius * 5.0;

          for(float i = -7.0; i <= 7.0; i++) {
            float weight = exp(-(i * i) / (2.0 * sigma * sigma));
            sum += texture2D(tDiffuse, vUv + vec2(i * h, 0.0)) * weight;
          }

          gl_FragColor = sum / sum.a;
        }
      `
    };

    // 创建垂直模糊 shader
    this.verticalBlurShader = {
      uniforms: {
        tDiffuse: { value: null },
        v: { value: 1.0 / window.innerHeight },
        radius: { value: radius }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float v;
        uniform float radius;
        varying vec2 vUv;

        void main() {
          vec4 sum = vec4(0.0);
          float samples = 15.0;
          float sigma = radius * 5.0;

          for(float i = -7.0; i <= 7.0; i++) {
            float weight = exp(-(i * i) / (2.0 * sigma * sigma));
            sum += texture2D(tDiffuse, vUv + vec2(0.0, i * v)) * weight;
          }

          gl_FragCode = sum / sum.a;
        }
      `
    };

    // 创建合成 shader
    this.compositeShader = {
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        strength: { value: strength }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform float strength;
        varying vec2 vUv;

        void main() {
          vec4 original = texture2D(tDiffuse, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          gl_FragColor = original + bloom * strength;
        }
      `
    };

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene.add(this.quad);
  }

  render(renderer, writeBuffer, readBuffer, scene, camera) {
    // 简化的 bloom 实现 - 直接渲染场景
    renderer.setRenderTarget(writeBuffer);
    renderer.render(scene, camera);
  }

  setSize(width, height) {
    if (this.horizontalBlurShader) {
      this.horizontalBlurShader.uniforms.h.value = 1.0 / width;
    }
    if (this.verticalBlurShader) {
      this.verticalBlurShader.uniforms.v.value = 1.0 / height;
    }
  }
}

// Bloom 效果管理器
class BloomEffect {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Bloom 参数
    this.strength = 1.5;
    this.radius = 0.4;
    this.threshold = 0.1;

    // 创建渲染目标
    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        stencilBuffer: false,
        depthBuffer: true
      }
    );

    // 创建辉光层渲染目标（降采样以提高性能）
    this.bloomRenderTarget = new THREE.WebGLRenderTarget(
      Math.floor(window.innerWidth / 2),
      Math.floor(window.innerHeight / 2),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        stencilBuffer: false,
        depthBuffer: false
      }
    );

    // 创建提取高亮材质
    this.highPassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: this.threshold }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          float brightness = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          float contribution = max(0.0, brightness - threshold) / max(0.001, 1.0 - threshold);
          gl_FragColor = vec4(texel.rgb * contribution, texel.a);
        }
      `
    });

    // 创建高质量模糊材质 - 使用9次采样的高斯模糊
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
        radius: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 direction;
        uniform vec2 resolution;
        uniform float radius;
        varying vec2 vUv;

        void main() {
          vec2 off1 = vec2(1.4117647059) * direction * radius / resolution;
          vec2 off2 = vec2(3.2941176471) * direction * radius / resolution;
          vec2 off3 = vec2(5.1764705882) * direction * radius / resolution;

          vec4 color = texture2D(tDiffuse, vUv) * 0.1964825502;
          color += texture2D(tDiffuse, vUv + off1) * 0.2969069647;
          color += texture2D(tDiffuse, vUv - off1) * 0.2969069647;
          color += texture2D(tDiffuse, vUv + off2) * 0.0944703979;
          color += texture2D(tDiffuse, vUv - off2) * 0.0944703979;
          color += texture2D(tDiffuse, vUv + off3) * 0.0103813624;
          color += texture2D(tDiffuse, vUv - off3) * 0.0103813624;

          gl_FragColor = color;
        }
      `
    });

    // 创建合成材质
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        strength: { value: this.strength }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float strength;
        varying vec2 vUv;

        void main() {
          vec4 scene = texture2D(tScene, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          // 保留原始场景的alpha通道，确保透明背景正确显示
          vec3 finalColor = scene.rgb + bloom.rgb * strength;
          gl_FragColor = vec4(finalColor, scene.a);
        }
      `,
      transparent: true
    });

    // 创建全屏四边形
    this.quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.quadGeometry, this.highPassMaterial);

    // 创建正交相机
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 创建场景用于后期处理
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);

    // 用于模糊的临时目标 - 需要3个目标用于迭代
    this.blurTargetA = this.bloomRenderTarget.clone();
    this.blurTargetB = this.bloomRenderTarget.clone();
  }

  // 渲染 Bloom 效果 - 使用多次迭代获得更柔和的发光
  renderBloom() {
    // 1. 渲染场景到 renderTarget
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // 2. 提取高亮区域到 bloomRenderTarget
    this.quad.material = this.highPassMaterial;
    this.highPassMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.renderer.setRenderTarget(this.bloomRenderTarget);
    this.renderer.render(this.postScene, this.orthoCamera);

    // 3. 多次迭代模糊 - 获得更柔和的发光效果
    const iterations = 4; // 迭代次数
    let readBuffer = this.bloomRenderTarget;
    let writeBuffer = this.blurTargetA;

    this.quad.material = this.blurMaterial;

    for (let i = 0; i < iterations; i++) {
      // 水平模糊
      this.blurMaterial.uniforms.tDiffuse.value = readBuffer.texture;
      this.blurMaterial.uniforms.direction.value.set(1, 0);
      // 使用 this.radius 作为基础半径，逐渐增加
      const baseRadius = this.radius !== undefined ? this.radius : 1.0;
      this.blurMaterial.uniforms.radius.value = baseRadius * (1.0 + i * 0.5);
      this.renderer.setRenderTarget(writeBuffer);
      this.renderer.render(this.postScene, this.orthoCamera);

      // 交换 buffer
      let temp = readBuffer;
      readBuffer = writeBuffer;
      writeBuffer = temp;

      // 垂直模糊
      this.blurMaterial.uniforms.tDiffuse.value = readBuffer.texture;
      this.blurMaterial.uniforms.direction.value.set(0, 1);
      this.renderer.setRenderTarget(writeBuffer);
      this.renderer.render(this.postScene, this.orthoCamera);

      // 再次交换
      temp = readBuffer;
      readBuffer = writeBuffer;
      writeBuffer = temp;
    }

    // 4. 合成到屏幕
    this.quad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms.tScene.value = this.renderTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = readBuffer.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.orthoCamera);
  }

  // 设置 Bloom 参数
  setStrength(strength) {
    this.strength = strength;
    this.compositeMaterial.uniforms.strength.value = strength;
  }

  setThreshold(threshold) {
    this.threshold = threshold;
    this.highPassMaterial.uniforms.threshold.value = threshold;
  }

  setRadius(radius) {
    this.radius = radius;
    // 半径会影响每次迭代的基础模糊半径
    // 在 renderBloom 中通过 uniforms.radius 动态调整
  }

  // 调整大小
  setSize(width, height) {
    this.renderTarget.setSize(width, height);
    this.bloomRenderTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
    this.blurTargetA.setSize(Math.floor(width / 2), Math.floor(height / 2));
    this.blurTargetB.setSize(Math.floor(width / 2), Math.floor(height / 2));
    this.blurMaterial.uniforms.resolution.value.set(width / 2, height / 2);
  }

  // 释放资源
  dispose() {
    this.renderTarget.dispose();
    this.bloomRenderTarget.dispose();
    this.blurTargetA.dispose();
    this.blurTargetB.dispose();
    this.highPassMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quadGeometry.dispose();
  }
}

// 导出
window.BloomEffect = BloomEffect;
export { BloomEffect };
