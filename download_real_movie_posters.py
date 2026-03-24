#!/usr/bin/env python3
"""
下载真实电影封面图 - 使用多种方法尝试
"""

import re
import time
import subprocess
import json
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

def curl_download(url, filepath, referer=None):
    """使用curl下载文件"""
    try:
        cmd = [
            'curl', '-s', '-L', '--http1.1',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            '-H', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
            '-H', 'Accept-Encoding: gzip, deflate, br',
            '-H', 'Connection: keep-alive',
            '--compressed',
            '--connect-timeout', '30',
            '--max-time', '90',
            '-o', str(filepath)
        ]
        
        if referer:
            cmd.extend(['-H', f'Referer: {referer}'])
        
        cmd.append(url)
        
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
        print(f"    curl错误: {e}")
        return False, 0

def try_douban_image(douban_id, filepath):
    """尝试多种豆瓣图片URL模式"""
    # 豆瓣图片URL模式
    patterns = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img3.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img4.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    
    for url in patterns:
        success, size = curl_download(url, filepath, referer="https://movie.douban.com/")
        if success:
            return True, size, url
    return False, 0, None

def try_imdb_image(imdb_id, filepath):
    """尝试从IMDb获取图片"""
    try:
        # 先获取IMDb页面
        url = f"https://www.imdb.com/title/{imdb_id}/"
        cmd = [
            'curl', '-s', '-L',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '--connect-timeout', '20',
            '--max-time', '45',
            url
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        patterns = [
            r'"image":"(https://m\.media-amazon\.com/images/[^"]+)"',
            r'"poster":"(https://m\.media-amazon\.com/images/[^"]+)"',
            r'<img[^>]*src="(https://m\.media-amazon\.com/images/M/[^"]+)"[^>]*class="[^"]*poster[^"]*"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1).replace('\\u0026', '&')
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, img_url
        
        return False, 0, None
    except Exception as e:
        print(f"    IMDb错误: {e}")
        return False, 0, None

def try_tmdb_api(name, year, filepath):
    """尝试TMDB API"""
    try:
        # 搜索电影
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(name)}&year={year}&language=en-US&page=1"
        
        cmd = [
            'curl', '-s', search_url,
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20',
            '--max-time', '45'
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        
        try:
            data = json.loads(result.stdout.decode('utf-8'))
        except:
            return False, 0, None
        
        if data.get('results') and len(data['results']) > 0:
            poster_path = data['results'][0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, img_url
        
        return False, 0, None
    except Exception as e:
        print(f"    TMDB错误: {e}")
        return False, 0, None

def main():
    print("开始下载真实电影封面...")
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
            if size > 20000:  # 大于20KB认为是真实图片
                print(f"[{i+1}/{len(movies)}] {name} - 已存在 ({size/1024:.1f} KB)")
                success_count += 1
                continue
        
        print(f"\n[{i+1}/{len(movies)}] {name} ({year})")
        print(f"    豆瓣ID: {douban_id}, IMDbID: {imdb_id}")
        
        downloaded = False
        source = None
        file_size = 0
        
        # 1. 尝试豆瓣直接下载
        if douban_id and not downloaded:
            print(f"    尝试豆瓣图片...")
            downloaded, file_size, img_url = try_douban_image(douban_id, filepath)
            if downloaded:
                source = "豆瓣"
                print(f"    ✓ 豆瓣成功 ({file_size/1024:.1f} KB)")
        
        # 2. 尝试IMDb
        if imdb_id and not downloaded:
            print(f"    尝试IMDb...")
            downloaded, file_size, img_url = try_imdb_image(imdb_id, filepath)
            if downloaded:
                source = "IMDb"
                print(f"    ✓ IMDb成功 ({file_size/1024:.1f} KB)")
        
        # 3. 尝试TMDB (英文名)
        if not downloaded and endonym and endonym != name:
            print(f"    尝试TMDB (英文: {endonym})...")
            downloaded, file_size, img_url = try_tmdb_api(endonym, year, filepath)
            if downloaded:
                source = "TMDB(英文)"
                print(f"    ✓ TMDB英文成功 ({file_size/1024:.1f} KB)")
        
        # 4. 尝试TMDB (中文名)
        if not downloaded:
            print(f"    尝试TMDB (中文: {name})...")
            downloaded, file_size, img_url = try_tmdb_api(name, year, filepath)
            if downloaded:
                source = "TMDB(中文)"
                print(f"    ✓ TMDB中文成功 ({file_size/1024:.1f} KB)")
        
        if downloaded:
            success_count += 1
        else:
            print(f"    ✗ 所有来源都失败")
            failed_movies.append({
                'name': name,
                'endonym': endonym,
                'year': year,
                'douban_id': douban_id,
                'imdb_id': imdb_id,
                'link': movie['link']
            })
        
        # 延迟避免被封
        if i < len(movies) - 1:
            time.sleep(1.5)
    
    print("\n" + "=" * 60)
    print(f"下载完成!")
    print(f"成功: {success_count}/{len(movies)}")
    print(f"失败: {len(failed_movies)}/{len(movies)}")
    
    if failed_movies:
        print(f"\n失败的 {len(failed_movies)} 部电影:")
        for m in failed_movies:
            print(f"  - {m['name']} ({m['year']}) - {m['link']}")

if __name__ == '__main__':
    main()
