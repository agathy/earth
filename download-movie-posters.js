// 下载电影封面图脚本
// 从豆瓣获取电影封面并保存到本地

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建保存目录
const POSTERS_DIR = path.join(__dirname, 'assets', 'movie-posters');
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
  console.log('创建目录:', POSTERS_DIR);
}

// 读取电影数据
const moviesData = require('./female-directors-movies-data.js');

// 从豆瓣链接中提取电影ID
function extractDoubanId(url) {
  const match = url.match(/subject\/(\d+)/);
  return match ? match[1] : null;
}

// 下载图片
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/'
      }
    };
    
    const request = client.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 跟随重定向
        downloadImage(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filepath);
      });
      
      fileStream.on('error', reject);
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// 获取豆瓣电影封面
async function getDoubanPoster(doubanId, movieName) {
  try {
    // 尝试多个可能的封面URL格式
    const possibleUrls = [
      `https://img9.doubanio.com/view/photo/s_ratio_poster/public/p${doubanId}.jpg`,
      `https://img1.doubanio.com/view/photo/s_ratio_poster/public/p${doubanId}.jpg`,
      `https://img2.doubanio.com/view/photo/s_ratio_poster/public/p${doubanId}.jpg`,
      `https://img3.doubanio.com/view/photo/s_ratio_poster/public/p${doubanId}.jpg`,
    ];
    
    const filepath = path.join(POSTERS_DIR, `${doubanId}.jpg`);
    
    // 如果文件已存在，跳过
    if (fs.existsSync(filepath)) {
      console.log(`✓ 已存在: ${movieName} (${doubanId})`);
      return { success: true, filepath: `./assets/movie-posters/${doubanId}.jpg`, skipped: true };
    }
    
    // 尝试下载
    for (const url of possibleUrls) {
      try {
        await downloadImage(url, filepath);
        console.log(`✓ 下载成功: ${movieName} (${doubanId})`);
        return { success: true, filepath: `./assets/movie-posters/${doubanId}.jpg` };
      } catch (err) {
        // 继续尝试下一个URL
        continue;
      }
    }
    
    throw new Error('所有URL都失败了');
  } catch (error) {
    console.error(`✗ 失败: ${movieName} (${doubanId}) - ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 主函数
async function main() {
  console.log('开始下载电影封面...');
  console.log(`共 ${moviesData.length} 部电影`);
  console.log('');
  
  const results = [];
  const concurrency = 3; // 并发数
  
  for (let i = 0; i < moviesData.length; i += concurrency) {
    const batch = moviesData.slice(i, i + concurrency);
    const batchPromises = batch.map(async (movie) => {
      const doubanId = extractDoubanId(movie.link);
      if (!doubanId) {
        console.error(`✗ 无法提取豆瓣ID: ${movie.name}`);
        return { movie, success: false, error: 'No Douban ID' };
      }
      
      const result = await getDoubanPoster(doubanId, movie.name);
      return { movie, ...result };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 显示进度
    const progress = Math.min(i + concurrency, moviesData.length);
    console.log(`进度: ${progress}/${moviesData.length}`);
    
    // 延迟一下，避免请求过快
    if (i + concurrency < moviesData.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 统计结果
  const successful = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('');
  console.log('下载完成!');
  console.log(`成功: ${successful} (已存在: ${skipped})`);
  console.log(`失败: ${failed}`);
  
  // 保存结果报告
  const reportPath = path.join(__dirname, 'poster-download-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`详细报告已保存: ${reportPath}`);
}

main().catch(console.error);
