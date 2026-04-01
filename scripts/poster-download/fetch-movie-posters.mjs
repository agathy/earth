#!/usr/bin/env node
// 豆瓣电影封面爬取脚本
// 从豆瓣、IMDb、TMDb等平台获取封面图

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

function extractImdbId(url) {
  const match = url.match(/title\/(tt\d+)/);
  return match ? match[1] : null;
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
      }
    };
    
    const file = fs.createWriteStream(filepath);
    client.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        // 检查文件大小
        const stats = fs.statSync(filepath);
        if (stats.size < 1000) {
          fs.unlinkSync(filepath);
          reject(new Error('File too small'));
        } else {
          resolve(filepath);
        }
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
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

async function fetchFromDouban(doubanId, movieName) {
  try {
    const url = `https://movie.douban.com/subject/${doubanId}/`;
    console.log(`  尝试豆瓣: ${url}`);
    const html = await fetchPage(url);
    const posterUrl = extractPosterUrl(html);
    if (posterUrl) {
      return { success: true, url: posterUrl, source: 'douban' };
    }
  } catch (error) {
    console.log(`  豆瓣失败: ${error.message}`);
  }
  return { success: false };
}

async function fetchFromImdb(imdbId, movieName) {
  try {
    const url = `https://www.imdb.com/title/${imdbId}/`;
    console.log(`  尝试IMDb: ${url}`);
    const html = await fetchPage(url);
    
    // 提取IMDb封面图
    const patterns = [
      /"image":"(https:\/\/m\.media-amazon\.com\/images\/[^"]+)"/,
      /<img[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/[^"]+)"[^>]*class="[^"]*poster[^"]*"/,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const posterUrl = match[1].replace(/\\/g, '');
        return { success: true, url: posterUrl, source: 'imdb' };
      }
    }
  } catch (error) {
    console.log(`  IMDb失败: ${error.message}`);
  }
  return { success: false };
}

async function fetchFromTMDb(movieName, year) {
  // TMDb需要API key，这里尝试通过搜索页面获取
  try {
    const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(movieName)}`;
    console.log(`  尝试TMDb搜索: ${searchUrl}`);
    const html = await fetchPage(searchUrl);
    
    // 提取第一个结果的封面
    const pattern = /"poster_path":"(\/[^"]+\.(?:jpg|png))"/;
    const match = html.match(pattern);
    if (match) {
      const posterUrl = `https://image.tmdb.org/t/p/w500${match[1]}`;
      return { success: true, url: posterUrl, source: 'tmdb' };
    }
  } catch (error) {
    console.log(`  TMDb失败: ${error.message}`);
  }
  return { success: false };
}

async function fetchPoster(movie) {
  const doubanId = extractDoubanId(movie.link);
  const imdbId = extractImdbId(movie.link);
  
  if (!doubanId && !imdbId) {
    console.log(`⚠ 跳过: ${movie.name} (无法提取ID)`);
    return { success: false, reason: 'no_id' };
  }
  
  // 使用doubanId或imdbId作为文件名
  const fileId = doubanId || imdbId;
  const filepath = path.join(POSTERS_DIR, `${fileId}.jpg`);
  
  // 检查是否已存在
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath);
    if (stats.size > 1000) {
      console.log(`✓ 已存在: ${movie.name}`);
      return { success: true, skipped: true, filepath };
    }
  }
  
  // 尝试多个来源
  let result;
  
  // 1. 尝试豆瓣
  if (doubanId) {
    result = await fetchFromDouban(doubanId, movie.name);
    if (result.success) {
      try {
        await downloadImage(result.url, filepath);
        console.log(`✓ 豆瓣下载成功: ${movie.name}`);
        return { success: true, filepath, url: result.url, source: 'douban' };
      } catch (error) {
        console.log(`  豆瓣下载失败: ${error.message}`);
      }
    }
  }
  
  // 2. 尝试IMDb
  if (imdbId) {
    result = await fetchFromImdb(imdbId, movie.name);
    if (result.success) {
      try {
        await downloadImage(result.url, filepath);
        console.log(`✓ IMDb下载成功: ${movie.name}`);
        return { success: true, filepath, url: result.url, source: 'imdb' };
      } catch (error) {
        console.log(`  IMDb下载失败: ${error.message}`);
      }
    }
  }
  
  // 3. 尝试TMDb
  result = await fetchFromTMDb(movie.name);
  if (result.success) {
    try {
      await downloadImage(result.url, filepath);
      console.log(`✓ TMDb下载成功: ${movie.name}`);
      return { success: true, filepath, url: result.url, source: 'tmdb' };
    } catch (error) {
      console.log(`  TMDb下载失败: ${error.message}`);
    }
  }
  
  console.log(`✗ 所有来源都失败: ${movie.name}`);
  return { success: false, reason: 'all_sources_failed' };
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
    results.push({ movie: movie.name, link: movie.link, ...result });
    
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
