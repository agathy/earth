#!/usr/bin/env python3
"""
从多个来源下载电影封面图
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

def curl_download(url, filepath, use_proxy=True):
    """使用curl下载文件"""
    try:
        cmd = ['curl', '-s', '-L', '--http1.1',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '--connect-timeout', '30', '--max-time', '90',
            '-o', str(filepath)]
        
        if use_proxy:
            cmd.extend(['--socks5-hostname', '127.0.0.1:7897'])
        
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
        return False, 0

def try_wikipedia(endonym, year, filepath):
    """尝试从Wikipedia获取封面图"""
    try:
        # 构建Wikipedia页面URL
        search_term = quote(endonym.replace(' ', '_'))
        wiki_url = f"https://en.wikipedia.org/wiki/{search_term}_(film)"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', wiki_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取infobox中的图片
        patterns = [
            r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/en/[^"]+)"[^>]*class="[^"]*infobox[^"]*"',
            r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/en/[^"]+)"[^>]*',
            r'<img[^>]*src="(https://upload\.wikimedia\.org/wikipedia/en/[^"]+)"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1)
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                print(f"    找到Wikipedia图片: {img_url[:60]}...")
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size
        return False, 0
    except Exception as e:
        return False, 0

def try_wikimedia_commons(endonym, filepath):
    """尝试从Wikimedia Commons搜索"""
    try:
        search_term = quote(f"{endonym} film poster")
        search_url = f"https://commons.wikimedia.org/w/index.php?search={search_term}&title=Special:MediaSearch&type=image"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', search_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取搜索结果中的图片
        match = re.search(r'src="(//upload\.wikimedia\.org/wikipedia/commons/thumb/[^"]+)"', html)
        if match:
            img_url = 'https:' + match.group(1)
            print(f"    找到Wikimedia图片: {img_url[:60]}...")
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size
        return False, 0
    except Exception as e:
        return False, 0

def try_imdb(imdb_id, filepath):
    """尝试从IMDb获取封面图"""
    try:
        url = f"https://www.imdb.com/title/{imdb_id}/"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        patterns = [
            r'"image":"(https://m\.media-amazon\.com/images/[^"]+)"',
            r'"poster":"(https://m\.media-amazon\.com/images/[^"]+)"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1).replace('\\u0026', '&')
                print(f"    找到IMDb图片: {img_url[:60]}...")
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size
        return False, 0
    except Exception as e:
        return False, 0

def try_tmdb(endonym, year, filepath):
    """尝试从TMDB获取"""
    try:
        # TMDB搜索
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(endonym)}&year={year}&language=en-US"
        
        cmd = ['curl', '-s', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', search_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        
        try:
            data = json.loads(result.stdout.decode('utf-8'))
        except:
            return False, 0
        
        if data.get('results') and len(data['results']) > 0:
            poster_path = data['results'][0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                print(f"    找到TMDB图片: {img_url}")
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size
        return False, 0
    except Exception as e:
        return False, 0

def main():
    print("开始从多个来源下载电影封面...")
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
        if filepath.exists() and filepath.stat().st_size > 20000:
            print(f"[{i+1}/{len(movies)}] {name} - 已存在")
            success_count += 1
            continue
        
        print(f"\n[{i+1}/{len(movies)}] {name} ({year})")
        
        downloaded = False
        file_size = 0
        source = None
        
        # 1. 尝试IMDb
        if imdb_id and not downloaded:
            print(f"    尝试IMDb...")
            downloaded, file_size = try_imdb(imdb_id, filepath)
            if downloaded:
                source = "IMDb"
                print(f"    ✓ IMDb成功 ({file_size/1024:.1f} KB)")
        
        # 2. 尝试Wikipedia
        if not downloaded and endonym:
            print(f"    尝试Wikipedia...")
            downloaded, file_size = try_wikipedia(endonym, year, filepath)
            if downloaded:
                source = "Wikipedia"
                print(f"    ✓ Wikipedia成功 ({file_size/1024:.1f} KB)")
        
        # 3. 尝试Wikimedia Commons
        if not downloaded and endonym:
            print(f"    尝试Wikimedia Commons...")
            downloaded, file_size = try_wikimedia_commons(endonym, filepath)
            if downloaded:
                source = "Wikimedia"
                print(f"    ✓ Wikimedia成功 ({file_size/1024:.1f} KB)")
        
        # 4. 尝试TMDB
        if not downloaded and endonym:
            print(f"    尝试TMDB...")
            downloaded, file_size = try_tmdb(endonym, year, filepath)
            if downloaded:
                source = "TMDB"
                print(f"    ✓ TMDB成功 ({file_size/1024:.1f} KB)")
        
        if downloaded:
            success_count += 1
        else:
            print(f"    ✗ 所有来源都失败")
            failed_movies.append(movie)
        
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print(f"完成! 成功: {success_count}/{len(movies)}")
    if failed_movies:
        print(f"失败: {len(failed_movies)}/{len(movies)}")

if __name__ == '__main__':
    main()
