#!/usr/bin/env python3
"""
使用 Letterboxd 下载所有电影封面图
"""

import re
import time
import subprocess
from pathlib import Path
from urllib.parse import quote

POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

movies = []
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?endonym:\s*"([^"]+)"[\s\S]*?year:\s*(\d+)[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'endonym': match.group(3),
        'year': match.group(4),
        'link': match.group(5)
    })

print(f"解析到 {len(movies)} 部电影")

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

def curl_download(url, filepath):
    """使用curl下载文件"""
    try:
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '--connect-timeout', '30', '--max-time', '90',
            '-o', str(filepath), url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=100)
        
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 10000:
                return True, size
            else:
                filepath.unlink()
                return False, 0
        return False, 0
    except Exception as e:
        return False, 0

def try_letterboxd(endonym, year, filepath):
    """从Letterboxd获取封面图"""
    try:
        # 构建Letterboxd URL
        search_term = quote(endonym.lower().replace(' ', '-'))
        url = f"https://letterboxd.com/film/{search_term}/"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        patterns = [
            r'"image":"(https://a\.ltrbxd\.com/[^"]+)"',
            r'"posterImage":"(https://a\.ltrbxd\.com/[^"]+)"',
            r'<img[^>]*src="(https://a\.ltrbxd\.com/[^"]+)"[^>]*class="[^"]*poster[^"]*"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1).replace('\\u0026', '&')
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size
        
        return False, 0
    except Exception as e:
        return False, 0

def main():
    print("开始从 Letterboxd 下载电影封面...")
    print("=" * 60)
    
    success_count = 0
    failed_movies = []
    
    for i, movie in enumerate(movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        year = movie.get('year', '')
        
        douban_id = extract_douban_id(movie['link'])
        imdb_id = extract_imdb_id(movie['link'])
        file_id = douban_id or imdb_id or movie['id']
        
        filepath = POSTERS_DIR / f"{file_id}.jpg"
        
        # 检查是否已有有效文件
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 15000:  # 大于15KB认为是真实图片
                print(f"[{i+1}/{len(movies)}] {name} - 已存在 ({size/1024:.1f} KB)")
                success_count += 1
                continue
        
        print(f"\n[{i+1}/{len(movies)}] {name} ({year})")
        print(f"    英文名: {endonym}")
        
        # 尝试Letterboxd
        if endonym:
            print(f"    尝试Letterboxd...")
            downloaded, size = try_letterboxd(endonym, year, filepath)
            if downloaded:
                print(f"    ✓ Letterboxd成功 ({size/1024:.1f} KB)")
                success_count += 1
            else:
                print(f"    ✗ Letterboxd失败")
                failed_movies.append(movie)
        else:
            print(f"    ✗ 没有英文名，跳过")
            failed_movies.append(movie)
        
        # 延迟避免被封
        if i < len(movies) - 1:
            time.sleep(1.5)
    
    print("\n" + "=" * 60)
    print(f"完成!")
    print(f"成功: {success_count}/{len(movies)}")
    if failed_movies:
        print(f"失败: {len(failed_movies)}/{len(movies)}")
        print("\n失败的电影列表:")
        for m in failed_movies[:10]:  # 只显示前10个
            print(f"  - {m['name']} ({m['endonym']})")

if __name__ == '__main__':
    main()
