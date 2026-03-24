#!/usr/bin/env node
// 使用TMDb API获取电影封面图

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 创建保存目录
const POSTERS_DIR = path.join(__dirname, 'assets', 'movie-posters');
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

// 读取电影数据
const dataPath = path.join(__dirname, 'female-directors-movies-data.js');
const content = fs.readFileSync(dataPath, 'utf-8');

// 提取所有电影条目（包括英文名endonym）
const movies = [];
const entryPattern = /\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?endonym:\s*"([^"]+)"[\s\S]*?link:\s*"([^"]+)"/g;
let match;
while ((match = entryPattern.exec(content)) !== null) {
  movies.push({
    id: match[1],
    name: match[2],
    endonym: match[3],
    link: match[4]
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

// 使用TMDb API搜索电影
async function searchTMDb(movieName) {
  try {
    const encodedName = encodeURIComponent(movieName);
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodedName}&language=en-US&page=1&include_adult=false`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    };
    
    return new Promise((resolve, reject) => {
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.results && json.results.length > 0) {
              const result = json.results[0];
              const posterPath = result.poster_path;
              if (posterPath) {
                resolve(`https://image.tmdb.org/t/p/w500${posterPath}`);
              } else {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

// 下载图片
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

async function fetchPoster(movie) {
  const doubanId = extractDoubanId(movie.link);
  const imdbId = extractImdbId(movie.link);
  
  const fileId = doubanId || imdbId || movie.id;
  const filepath = path.join(POSTERS_DIR, `${fileId}.jpg`);
  
  // 检查是否已存在且有效
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath);
    if (stats.size > 10000) {  // 至少10KB
      console.log(`✓ 已存在: ${movie.name}`);
      return { success: true, skipped: true };
    }
  }
  
  // 先尝试英文名搜索
  let posterUrl = null;
  
  if (movie.endonym && movie.endonym !== movie.name) {
    console.log(`  搜索TMDb (英文): ${movie.endonym}`);
    posterUrl = await searchTMDb(movie.endonym);
  }
  
  // 如果英文名没找到，尝试中文名
  if (!posterUrl) {
    console.log(`  搜索TMDb (中文): ${movie.name}`);
    posterUrl = await searchTMDb(movie.name);
  }
  
  if (posterUrl) {
    try {
      console.log(`  下载: ${posterUrl}`);
      await downloadImage(posterUrl, filepath);
      console.log(`✓ 成功: ${movie.name}`);
      return { success: true, source: 'tmdb' };
    } catch (error) {
      console.log(`  下载失败: ${error.message}`);
    }
  }
  
  console.log(`✗ 未找到: ${movie.name}`);
  return { success: false };
}

async function main() {
  console.log('开始获取电影封面...\n');
  
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    console.log(`[${i + 1}/${movies.length}] ${movie.name}`);
    
    const result = await fetchPoster(movie);
    
    if (result.success) {
      if (result.skipped) {
        skippedCount++;
      } else {
        successCount++;
      }
    } else {
      failedCount++;
    }
    
    // 延迟
    if (i < movies.length - 1) {
      await sleep(300);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('完成!');
  console.log(`成功: ${successCount}`);
  console.log(`已存在: ${skippedCount}`);
  console.log(`失败: ${failedCount}`);
}

main().catch(console.error);
