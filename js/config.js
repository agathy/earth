// 配置管理逻辑
(function() {
  'use strict';

  // 内置默认配置
  var DEFAULT_CONFIG = {
    bgColor: "#000000",
    borderColor: "#949494",
    borderColorEmpty: "#545454",
    borderWidth: "1.5",
    floatSpeed: "800",
    textureImage: "assets/earth-terrain-hd.png",
    textureImageName: "地球地形",
    textureOffsetX: "-0.25",
    textureOpacity: "1",
    atmosphereBrightness: "0.7",
    atmosphereDensity: "80",
    atmosphereHeight: "1.04",
    atmosphereColor: "#000000",
    fresnelWidth: "1.5",
    floatHeight: "1.07",
    glowColor: "#474747",
    highlightColor: "#b8b8b8",
    particleRadiusOffset: "5",
    rotateSpeed: "1",
    posterSize: "20",
    posterHeight: "1.05",
    watchedRatio: "80",
    bloomEnabled: true,
    bloomStrength: "10",
    bloomThreshold: "0.4",
    bloomRadius: "0.4",
    borderGlowIntensity: "0"
  };

  // 从 localStorage 加载配置
  window.loadConfig = function() {
    var saved = localStorage.getItem('globeConfig');
    if (!saved) return DEFAULT_CONFIG;
    try {
      return JSON.parse(saved);
    } catch(e) {
      return DEFAULT_CONFIG;
    }
  };

  // 保存配置到 localStorage
  window.saveConfig = function() {
    var config = {
      bgColor: document.getElementById('bg-color-picker').value,
      borderColor: document.getElementById('border-color-picker').value,
      borderColorEmpty: document.getElementById('border-color-empty-picker').value,
      borderWidth: document.getElementById('border-width-slider').value,
      floatSpeed: document.getElementById('speed-slider').value,
      textureImage: window.currentTextureUrl || DEFAULT_CONFIG.textureImage,
      textureImageName: window.currentTextureName || DEFAULT_CONFIG.textureImageName,
      textureOffsetX: document.getElementById('texture-offset-x').value,
      textureOpacity: document.getElementById('texture-opacity').value,
      atmosphereBrightness: document.getElementById('brightness-slider').value,
      atmosphereDensity: document.getElementById('density-slider').value,
      atmosphereHeight: document.getElementById('height-slider').value,
      atmosphereColor: document.getElementById('atmosphere-color-picker').value,
      fresnelWidth: document.getElementById('fresnel-slider').value,
      floatHeight: document.getElementById('float-height-slider').value,
      glowColor: document.getElementById('glow-color-picker').value,
      highlightColor: document.getElementById('highlight-color-picker').value,
      particleRadiusOffset: document.getElementById('particle-radius-slider').value,
      rotateSpeed: document.getElementById('rotate-speed-slider').value,
      posterSize: document.getElementById('poster-size-slider').value,
      posterHeight: document.getElementById('poster-height-slider').value,
      watchedRatio: document.getElementById('watched-ratio-slider').value,
      bloomEnabled: document.getElementById('bloom-enabled').checked,
      bloomStrength: document.getElementById('bloom-strength-slider').value,
      bloomThreshold: document.getElementById('bloom-threshold-slider').value,
      bloomRadius: document.getElementById('bloom-radius-slider').value,
      borderGlowIntensity: document.getElementById('border-glow-intensity-slider').value,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('globeConfig', JSON.stringify(config));
  };

  // 导出配置为 JSON 文件
  window.exportConfig = function() {
    var config = {
      bgColor: document.getElementById('bg-color-picker').value,
      borderColor: document.getElementById('border-color-picker').value,
      borderColorEmpty: document.getElementById('border-color-empty-picker').value,
      borderWidth: document.getElementById('border-width-slider').value,
      floatSpeed: document.getElementById('speed-slider').value,
      textureImage: window.currentTextureUrl || DEFAULT_CONFIG.textureImage,
      textureImageName: window.currentTextureName || DEFAULT_CONFIG.textureImageName,
      textureOffsetX: document.getElementById('texture-offset-x').value,
      textureOpacity: document.getElementById('texture-opacity').value,
      atmosphereBrightness: document.getElementById('brightness-slider').value,
      atmosphereDensity: document.getElementById('density-slider').value,
      atmosphereHeight: document.getElementById('height-slider').value,
      atmosphereColor: document.getElementById('atmosphere-color-picker').value,
      fresnelWidth: document.getElementById('fresnel-slider').value,
      floatHeight: document.getElementById('float-height-slider').value,
      glowColor: document.getElementById('glow-color-picker').value,
      highlightColor: document.getElementById('highlight-color-picker').value,
      particleRadiusOffset: document.getElementById('particle-radius-slider').value,
      rotateSpeed: document.getElementById('rotate-speed-slider').value,
      posterSize: document.getElementById('poster-size-slider').value,
      posterHeight: document.getElementById('poster-height-slider').value,
      watchedRatio: document.getElementById('watched-ratio-slider').value,
      bloomEnabled: document.getElementById('bloom-enabled').checked,
      bloomStrength: document.getElementById('bloom-strength-slider').value,
      bloomThreshold: document.getElementById('bloom-threshold-slider').value,
      bloomRadius: document.getElementById('bloom-radius-slider').value,
      borderGlowIntensity: document.getElementById('border-glow-intensity-slider').value,
      timestamp: new Date().toISOString()
    };
    
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'globe-config-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入配置
  window.importConfig = function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var config = JSON.parse(e.target.result);
        applyConfig(config);
        localStorage.setItem('globeConfig', JSON.stringify(config));
        alert('配置导入成功！');
      } catch(error) {
        alert('配置文件格式错误：' + error.message);
      }
    };
    reader.readAsText(file);
  };

  // 应用配置到界面
  window.applyConfig = function(config) {
    if (!config) return;

    // 应用颜色配置
    if (config.bgColor) document.getElementById('bg-color-picker').value = config.bgColor;
    if (config.borderColor) document.getElementById('border-color-picker').value = config.borderColor;
    if (config.borderColorEmpty) document.getElementById('border-color-empty-picker').value = config.borderColorEmpty;
    if (config.atmosphereColor) document.getElementById('atmosphere-color-picker').value = config.atmosphereColor;
    if (config.glowColor) document.getElementById('glow-color-picker').value = config.glowColor;
    if (config.highlightColor) document.getElementById('highlight-color-picker').value = config.highlightColor;

    // 应用滑块配置
    if (config.borderWidth) document.getElementById('border-width-slider').value = config.borderWidth;
    if (config.floatSpeed) document.getElementById('speed-slider').value = config.floatSpeed;
    if (config.textureOffsetX) document.getElementById('texture-offset-x').value = config.textureOffsetX;
    if (config.textureOpacity) document.getElementById('texture-opacity').value = config.textureOpacity;
    if (config.atmosphereBrightness) document.getElementById('brightness-slider').value = config.atmosphereBrightness;
    if (config.atmosphereDensity) document.getElementById('density-slider').value = config.atmosphereDensity;
    if (config.atmosphereHeight) document.getElementById('height-slider').value = config.atmosphereHeight;
    if (config.fresnelWidth) document.getElementById('fresnel-slider').value = config.fresnelWidth;
    if (config.floatHeight) document.getElementById('float-height-slider').value = config.floatHeight;
    if (config.particleRadiusOffset) document.getElementById('particle-radius-slider').value = config.particleRadiusOffset;
    if (config.rotateSpeed) document.getElementById('rotate-speed-slider').value = config.rotateSpeed;
    if (config.posterSize) document.getElementById('poster-size-slider').value = config.posterSize;
    if (config.posterHeight) document.getElementById('poster-height-slider').value = config.posterHeight;
    if (config.watchedRatio) document.getElementById('watched-ratio-slider').value = config.watchedRatio;
    if (config.bloomStrength) document.getElementById('bloom-strength-slider').value = config.bloomStrength;
    if (config.bloomThreshold) document.getElementById('bloom-threshold-slider').value = config.bloomThreshold;
    if (config.bloomRadius) document.getElementById('bloom-radius-slider').value = config.bloomRadius;
    if (config.borderGlowIntensity) document.getElementById('border-glow-intensity-slider').value = config.borderGlowIntensity;

    // 应用复选框配置
    if (config.bloomEnabled !== undefined) document.getElementById('bloom-enabled').checked = config.bloomEnabled;

    // 应用贴图配置
    if (config.textureImage) {
      window.currentTextureUrl = config.textureImage;
      window.currentTextureName = config.textureImageName || '自定义贴图';
      document.getElementById('texture-filename').textContent = window.currentTextureName;
    }

    // 更新滑块显示值
    updateSliderValues();

    // 触发配置变更事件
    if (window.globeApp) {
      window.dispatchEvent(new CustomEvent('config-change', { detail: config }));
    }
  };

  // 更新滑块显示值
  function updateSliderValues() {
    var sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(function(slider) {
      var valueSpan = slider.nextElementSibling;
      if (valueSpan && valueSpan.classList.contains('slider-value')) {
        valueSpan.textContent = slider.value;
      }
    });
  }

  // 初始化配置事件监听
  function initConfigEvents() {
    // 保存配置按钮
    var saveBtn = document.getElementById('save-config');
    if (saveBtn) {
      saveBtn.addEventListener('click', window.saveConfig);
    }

    // 导出配置按钮
    var exportBtn = document.getElementById('export-config');
    if (exportBtn) {
      exportBtn.addEventListener('click', window.exportConfig);
    }

    // 导入配置按钮
    var importBtn = document.getElementById('import-config');
    if (importBtn) {
      importBtn.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
          window.importConfig(e.target.files[0]);
          e.target.value = ''; // 重置文件输入
        }
      });
    }

    // 滑块值变化时更新显示
    var sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(function(slider) {
      slider.addEventListener('input', function() {
        var valueSpan = this.nextElementSibling;
        if (valueSpan && valueSpan.classList.contains('slider-value')) {
          valueSpan.textContent = this.value;
        }
      });
    });
  }

  // 页面加载完成后初始化配置事件
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfigEvents);
  } else {
    initConfigEvents();
  }

})();