/**
 * 资产提取脚本 - 在浏览器控制台运行
 * 用于提取Google Language Explorer的视觉资产和配置
 */

(function() {
  'use strict';
  
  const extracted = {
    timestamp: new Date().toISOString(),
    colors: {},
    fonts: [],
    textures: [],
    threeJsConfig: {},
    cameraSettings: {},
    globeSettings: {}
  };

  // 1. 提取CSS变量和配色
  function extractColors() {
    const styles = getComputedStyle(document.documentElement);
    const cssVars = Array.from(styles).filter(k => k.startsWith('--'));
    
    cssVars.forEach(variable => {
      extracted.colors[variable] = styles.getPropertyValue(variable).trim();
    });
    
    console.log('[Extract] Colors:', Object.keys(extracted.colors).length);
  }

  // 2. 提取字体
  function extractFonts() {
    const fontLinks = document.querySelectorAll('link[href*="font"]');
    fontLinks.forEach(link => {
      extracted.fonts.push(link.href);
    });
    
    // 提取font-family使用
    const elements = document.querySelectorAll('*');
    const fontFamilies = new Set();
    elements.forEach(el => {
      const font = getComputedStyle(el).fontFamily;
      if (font) fontFamilies.add(font);
    });
    extracted.fonts = [...fontFamilies];
    
    console.log('[Extract] Fonts:', extracted.fonts.length);
  }

  // 3. 提取Three.js配置
  function extractThreeJsConfig() {
    // 查找全局Three.js对象
    if (window.THREE) {
      extracted.threeJsConfig.version = THREE.REVISION;
      
      // 尝试找到renderer
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach((canvas, i) => {
        if (canvas.__renderer) {
          extracted.threeJsConfig.renderer = {
            index: i,
            parameters: canvas.__renderer.parameters
          };
        }
      });
    }
    
    console.log('[Extract] Three.js config:', extracted.threeJsConfig);
  }

  // 4. 提取纹理和图像
  function extractTextures() {
    const images = document.querySelectorAll('img');
    const textures = [];
    
    images.forEach(img => {
      if (img.src && (img.src.includes('texture') || img.src.includes('map') || img.src.includes('globe'))) {
        textures.push({
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      }
    });
    
    extracted.textures = textures;
    console.log('[Extract] Textures:', textures.length);
  }

  // 5. 导出结果
  function exportResults() {
    const dataStr = JSON.stringify(extracted, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-assets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log('[Extract] Downloaded extracted-assets.json');
  }

  // 执行提取
  console.log('=== Starting Asset Extraction ===');
  extractColors();
  extractFonts();
  extractThreeJsConfig();
  extractTextures();
  
  // 保存到全局变量供调试
  window._extractedAssets = extracted;
  
  console.log('=== Extraction Complete ===');
  console.log('Access via window._extractedAssets');
  console.log('Run exportResults() to download JSON');
  
  // 自动导出
  setTimeout(exportResults, 1000);
})();
