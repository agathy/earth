#!/usr/bin/env node
// 豆瓣电影封面爬取脚本
// 从豆瓣电影页面获取封面图URL并下载

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 创建保存目录
const POSTERS_DIR = path.join(__dirname, 'assets', 'movie-posters');
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  console.log('创建目录:', POSTERS_DIR);
}

// 读取电影数据
const dataPath = path.join(__dirname, 'female-directors-movies-data.js');
const content = fs.readFileSync(dataPath, 'utf-8');

// 提取所有电影条目
const movies = [];
const entryPattern = /\{\s*id:\s*"([^"]+)"[^}]*name:\s*"([^"]+)"[^}]*link:\s*"([^"]+)"/g;
let match;
while ((match = entryPattern.exec(content)) !== null) {
  movies.push({
    id: match[1],
    name: match[2],
    link: match[3]
  });
}

console.log(`解析到 ${movies.length} 部电影`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractDoubanId(url) {
  const match = url.match(/subject\/(\d+)/);
  return match ? match[1] : null;
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://movie.douban.com/'
      }
    };
    
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/'
      }
    };
    
    const file = fs.createWriteStream(filepath);
    client.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

function extractPosterUrl(html) {
  // 尝试多种方式提取封面图URL
  const patterns = [
    /<img[^>]*src="(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"[^>]*rel="v:image"/,
    /<img[^>]*rel="v:image"[^>]*src="(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"/,
    /"image":\s*"(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"/,
    /<div id="mainpic">[\s\S]*?<img[^>]*src="(https:\/\/img\d+\.doubanio\.com\/[^"]+)"/,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].replace(/\\/g, '');
    }
  }
  return null;
}

async function fetchPoster(movie) {
  const doubanId = extractDoubanId(movie.link);
  if (!doubanId) {
    console.log(`⚠ 跳过: ${movie.name} (无法提取豆瓣ID)`);
    return { success: false, reason: 'no_id' };
  }
  
  const filepath = path.join(POSTERS_DIR, `${doubanId}.jpg`);
  
  // 检查是否已存在
  if (fs.existsSync(filepath)) {
    console.log(`✓ 已存在: ${movie.name}`);
    return { success: true, skipped: true, filepath };
  }
  
  try {
    // 获取电影页面
    console.log(`  获取页面: ${movie.name}`);
    const html = await fetchPage(movie.link);
    
    // 提取封面图URL
    const posterUrl = extractPosterUrl(html);
    if (!posterUrl) {
      console.log(`✗ 未找到封面: ${movie.name}`);
      return { success: false, reason: 'no_poster' };
    }
    
    // 下载封面图
    console.log(`  下载封面: ${posterUrl}`);
    await downloadImage(posterUrl, filepath);
    
    console.log(`✓ 下载成功: ${movie.name}`);
    return { success: true, filepath, url: posterUrl };
  } catch (error) {
    console.log(`✗ 失败: ${movie.name} - ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('开始爬取电影封面...\n');
  
  const results = [];
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    console.log(`[${i + 1}/${movies.length}] ${movie.name}`);
    
    const result = await fetchPoster(movie);
    results.push({ movie: movie.name, ...result });
    
    if (result.success) {
      if (result.skipped) {
        skippedCount++;
      } else {
        successCount++;
      }
    } else {
      failedCount++;
    }
    
    // 延迟，避免请求过快
    if (i < movies.length - 1) {
      await sleep(2000);
    }
  }
  
  // 保存结果报告
  const reportPath = path.join(__dirname, 'poster-fetch-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('爬取完成!');
  console.log(`成功: ${successCount}`);
  console.log(`已存在: ${skippedCount}`);
  console.log(`失败: ${failedCount}`);
  console.log(`详细报告: ${reportPath}`);
}

main().catch(console.error);
