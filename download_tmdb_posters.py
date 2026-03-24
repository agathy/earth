#!/usr/bin/env python3
"""
使用TMDB API下载电影封面图
注意：TMDB需要API key，但我们可以尝试使用公开接口
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

def download_with_curl(url, filepath):
    """使用curl下载图片"""
    try:
        cmd = [
            'curl', '-s', '-L', url,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '--connect-timeout', '20',
            '--max-time', '60',
            '-o', str(filepath)
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=70)
        
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 10000:
                return True
            else:
                filepath.unlink()
        return False
    except Exception as e:
        return False

def try_tmdb_search(name, year, filepath):
    """尝试从TMDB搜索电影"""
    try:
        # TMDB搜索API (不需要API key的公开接口)
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(name)}&year={year}&language=en-US"
        
        cmd = [
            'curl', '-s', search_url,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        
        try:
            data = json.loads(result.stdout.decode('utf-8'))
        except:
            return False
        
        if data.get('results') and len(data['results']) > 0:
            poster_path = data['results'][0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                print(f"  找到TMDB图片: {img_url}")
                if download_with_curl(img_url, filepath):
                    return True
        return False
    except Exception as e:
        print(f"  TMDB错误: {e}")
        return False

def try_tmdb_by_imdb(imdb_id, filepath):
    """通过IMDb ID从TMDB获取"""
    try:
        # TMDB通过IMDb ID查找
        url = f"https://api.themoviedb.org/3/find/{imdb_id}?external_source=imdb_id"
        
        cmd = [
            'curl', '-s', url,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        
        try:
            data = json.loads(result.stdout.decode('utf-8'))
        except:
            return False
        
        movie_results = data.get('movie_results', [])
        if movie_results and len(movie_results) > 0:
            poster_path = movie_results[0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                print(f"  找到TMDB图片(IMDb): {img_url}")
                if download_with_curl(img_url, filepath):
                    return True
        return False
    except Exception as e:
        return False

def main():
    print("开始下载电影封面...\n")
    
    success_count = 0
    failed_count = 0
    
    # 先测试前5部
    test_movies = movies[:5]
    
    for i, movie in enumerate(test_movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        year = movie.get('year', '')
        
        douban_id = extract_douban_id(movie['link'])
        imdb_id = extract_imdb_id(movie['link'])
        file_id = douban_id or imdb_id or movie['id']
        
        filepath = POSTERS_DIR / f"{file_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 20000:
            print(f"[{i+1}] {name} - 已存在")
            continue
        
        print(f"[{i+1}] {name} ({year})")
        
        downloaded = False
        
        # 1. 尝试通过IMDb ID从TMDB获取
        if imdb_id and not downloaded:
            print(f"  尝试TMDB (IMDb ID: {imdb_id})...")
            downloaded = try_tmdb_by_imdb(imdb_id, filepath)
            if downloaded:
                print(f"  ✓ TMDB (IMDb)成功")
        
        # 2. 尝试用英文名搜索TMDB
        if not downloaded and endonym and endonym != name:
            print(f"  尝试TMDB (英文: {endonym})...")
            downloaded = try_tmdb_search(endonym, year, filepath)
            if downloaded:
                print(f"  ✓ TMDB (英文)成功")
        
        # 3. 尝试用中文名搜索TMDB
        if not downloaded:
            print(f"  尝试TMDB (中文: {name})...")
            downloaded = try_tmdb_search(name, year, filepath)
            if downloaded:
                print(f"  ✓ TMDB (中文)成功")
        
        if downloaded:
            size = filepath.stat().st_size
            print(f"  文件大小: {size/1024:.1f} KB")
            success_count += 1
        else:
            print(f"  ✗ 所有来源都失败")
            failed_count += 1
        
        time.sleep(1)
    
    print(f"\n完成! 成功: {success_count}, 失败: {failed_count}")

if __name__ == '__main__':
    main()
