/**
 * 资产分析脚本 - Node.js版本
 * 用于分析Google Language Explorer的构建产物
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = './assets';
const OUTPUT_FILE = './extracted-analysis.json';

// 分析结果
const analysis = {
  timestamp: new Date().toISOString(),
  css: {
    variables: {},
    colors: [],
    fonts: [],
    selectors: []
  },
  js: {
    imports: [],
    exports: [],
    strings: [],
    threeJsVersion: null,
    reactVersion: null
  },
  html: {
    meta: {},
    scripts: [],
    stylesheets: [],
    webComponents: []
  }
};

// 1. 分析CSS文件
function analyzeCSS() {
  console.log('🔍 Analyzing CSS files...');
  
  const cssFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.css'));
  
  cssFiles.forEach(file => {
    const content = fs.readFileSync(path.join(ASSETS_DIR, file), 'utf-8');
    
    // 提取CSS变量
    const varMatches = content.match(/--[\w-]+:\s*[^;]+/g) || [];
    varMatches.forEach(v => {
      const [name, value] = v.split(':').map(s => s.trim());
      analysis.css.variables[name] = value;
    });
    
    // 提取颜色值
    const colorMatches = content.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g) || [];
    analysis.css.colors.push(...[...new Set(colorMatches)]);
    
    // 提取字体
    const fontMatches = content.match(/font-family:\s*([^;]+)/g) || [];
    fontMatches.forEach(f => {
      const fonts = f.replace('font-family:', '').split(',').map(s => s.trim().replace(/['"]/g, ''));
      analysis.css.fonts.push(...fonts);
    });
    
    // 提取类选择器
    const selectorMatches = content.match(/\._[a-zA-Z0-9_]+/g) || [];
    analysis.css.selectors.push(...[...new Set(selectorMatches)]);
  });
  
  // 去重
  analysis.css.colors = [...new Set(analysis.css.colors)];
  analysis.css.fonts = [...new Set(analysis.css.fonts)];
  
  console.log(`  ✓ Found ${Object.keys(analysis.css.variables).length} CSS variables`);
  console.log(`  ✓ Found ${analysis.css.colors.length} unique colors`);
  console.log(`  ✓ Found ${analysis.css.fonts.length} unique fonts`);
  console.log(`  ✓ Found ${analysis.css.selectors.length} unique selectors`);
}

// 2. 分析JS文件
function analyzeJS() {
  console.log('\n🔍 Analyzing JS files...');
  
  const jsFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
  
  jsFiles.forEach(file => {
    const content = fs.readFileSync(path.join(ASSETS_DIR, file), 'utf-8');
    
    // 检测Three.js版本
    const threeVersion = content.match(/THREE\.REVISION\s*=\s*["']([^"']+)["']/) ||
                         content.match(/three@[~^]?([0-9.]+)/);
    if (threeVersion) {
      analysis.js.threeJsVersion = threeVersion[1];
    }
    
    // 检测React
    if (content.includes('react') || content.includes('React')) {
      analysis.js.reactVersion = 'detected';
    }
    
    // 提取import语句
    const importMatches = content.match(/import[\s\S]*?from\s*["'][^"']+["']/g) || [];
    analysis.js.imports.push(...importMatches.map(i => i.match(/from\s*["']([^"']+)["']/)?.[1]).filter(Boolean));
    
    // 提取字符串（可能是URL、类名等）
    const stringMatches = content.match(/["'](https?:\/\/[^"']+)["']/g) || [];
    analysis.js.strings.push(...stringMatches.map(s => s.replace(/["']/g, '')));
  });
  
  // 去重
  analysis.js.imports = [...new Set(analysis.js.imports)];
  analysis.js.strings = [...new Set(analysis.js.strings)];
  
  console.log(`  ✓ Three.js version: ${analysis.js.threeJsVersion || 'unknown'}`);
  console.log(`  ✓ React: ${analysis.js.reactVersion ? 'detected' : 'not detected'}`);
  console.log(`  ✓ Found ${analysis.js.imports.length} unique imports`);
  console.log(`  ✓ Found ${analysis.js.strings.length} unique URLs`);
}

// 3. 分析HTML文件
function analyzeHTML() {
  console.log('\n🔍 Analyzing HTML file...');
  
  const htmlContent = fs.readFileSync('./language-explorer.html', 'utf-8');
  
  // 提取meta标签
  const metaMatches = htmlContent.match(/<meta[^>]+>/g) || [];
  metaMatches.forEach(meta => {
    const name = meta.match(/name=["']([^"']+)["']/)?.[1] ||
                 meta.match(/property=["']([^"']+)["']/)?.[1];
    const content = meta.match(/content=["']([^"']+)["']/)?.[1];
    if (name && content) {
      analysis.html.meta[name] = content;
    }
  });
  
  // 提取脚本
  const scriptMatches = htmlContent.match(/<script[^>]+src=["']([^"']+)["']/g) || [];
  analysis.html.scripts = scriptMatches.map(s => s.match(/src=["']([^"']+)["']/)?.[1]).filter(Boolean);
  
  // 提取样式表
  const cssMatches = htmlContent.match(/<link[^>]+href=["']([^"']+\.css)["']/g) || [];
  analysis.html.stylesheets = cssMatches.map(s => s.match(/href=["']([^"']+)["']/)?.[1]).filter(Boolean);
  
  // 提取Web Components
  const wcMatches = htmlContent.match(/<[a-z]+-[a-z-]+/g) || [];
  analysis.html.webComponents = [...new Set(wcMatches.map(s => s.replace('<', '')))];
  
  console.log(`  ✓ Found ${Object.keys(analysis.html.meta).length} meta tags`);
  console.log(`  ✓ Found ${analysis.html.scripts.length} external scripts`);
  console.log(`  ✓ Found ${analysis.html.stylesheets.length} stylesheets`);
  console.log(`  ✓ Found ${analysis.html.webComponents.length} Web Components`);
}

// 4. 生成配色方案
function generateColorPalette() {
  console.log('\n🎨 Generating color palette...');
  
  const palette = {
    primary: [],
    background: [],
    text: [],
    accent: []
  };
  
  analysis.css.colors.forEach(color => {
    // 简单的颜色分类
    if (color.includes('202124') || color.includes('000')) {
      palette.background.push(color);
    } else if (color.includes('fff') || color.includes('white')) {
      palette.text.push(color);
    } else if (color.match(/#[0-9a-fA-F]{6}/)) {
      // 分析RGB值来判断颜色类型
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      if (r > 200 && g < 100 && b < 100) {
        palette.accent.push(color);
      } else if (r > 200 && g > 200 && b > 200) {
        palette.text.push(color);
      } else {
        palette.primary.push(color);
      }
    }
  });
  
  analysis.colorPalette = palette;
  
  console.log(`  ✓ Primary colors: ${palette.primary.length}`);
  console.log(`  ✓ Background colors: ${palette.background.length}`);
  console.log(`  ✓ Text colors: ${palette.text.length}`);
  console.log(`  ✓ Accent colors: ${palette.accent.length}`);
}

// 5. 保存结果
function saveResults() {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysis, null, 2));
  console.log(`\n💾 Analysis saved to ${OUTPUT_FILE}`);
  
  // 同时生成一个可读报告
  const report = `
# Google Language Explorer - Asset Analysis Report
Generated: ${analysis.timestamp}

## CSS Analysis

### CSS Variables (${Object.keys(analysis.css.variables).length})
${Object.entries(analysis.css.variables).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

### Color Palette
- **Primary**: ${analysis.colorPalette?.primary.slice(0, 5).join(', ')}
- **Background**: ${analysis.colorPalette?.background.slice(0, 5).join(', ')}
- **Text**: ${analysis.colorPalette?.text.slice(0, 5).join(', ')}
- **Accent**: ${analysis.colorPalette?.accent.slice(0, 5).join(', ')}

### Fonts
${analysis.css.fonts.map(f => `- ${f}`).join('\n')}

## JavaScript Analysis

- **Three.js Version**: ${analysis.js.threeJsVersion || 'Unknown'}
- **React**: ${analysis.js.reactVersion ? 'Detected' : 'Not detected'}
- **Total Imports**: ${analysis.js.imports.length}

## HTML Structure

### Web Components
${analysis.html.webComponents.map(wc => `- \`<${wc}>\``).join('\n')}

### External Resources
- Scripts: ${analysis.html.scripts.length}
- Stylesheets: ${analysis.html.stylesheets.length}
`;
  
  fs.writeFileSync('./ASSET-ANALYSIS-REPORT.md', report);
  console.log(`📝 Report saved to ASSET-ANALYSIS-REPORT.md`);
}

// 主函数
function main() {
  console.log('🚀 Starting Asset Analysis...\n');
  
  try {
    analyzeCSS();
    analyzeJS();
    analyzeHTML();
    generateColorPalette();
    saveResults();
    
    console.log('\n✅ Analysis complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
