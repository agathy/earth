#!/usr/bin/env python3
"""
为剩余的电影从其他来源下载封面图
尝试Wikipedia、Wikimedia Commons、TMDB等
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

# 找出缺少封面图的电影
missing_movies = []
for movie in movies:
    filepath = POSTERS_DIR / f"{movie['id']}.jpg"
    if not filepath.exists() or filepath.stat().st_size < 15000:
        missing_movies.append(movie)

print(f"缺少封面图: {len(missing_movies)}/{len(movies)}")

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

def try_wikipedia(endonym, year, filepath):
    """尝试Wikipedia"""
    try:
        # 尝试多种URL格式
        url_formats = [
            f"https://en.wikipedia.org/wiki/{quote(endonym.replace(' ', '_'))}_({year}_film)",
            f"https://en.wikipedia.org/wiki/{quote(endonym.replace(' ', '_'))}_(film)",
            f"https://en.wikipedia.org/wiki/{quote(endonym.replace(' ', '_'))}",
        ]
        
        for url in url_formats:
            cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
                '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                '--connect-timeout', '20', '--max-time', '45', url]
            
            result = subprocess.run(cmd, capture_output=True, timeout=50)
            html = result.stdout.decode('utf-8', errors='ignore')
            
            # 提取infobox图片
            match = re.search(r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"', html)
            if not match:
                match = re.search(r'<img[^>]*src="(https://upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"', html)
            
            if match:
                img_url = match.group(1)
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, "Wikipedia"
        
        return False, 0, None
    except Exception as e:
        return False, 0, None

def try_wikimedia_commons(endonym, filepath):
    """尝试Wikimedia Commons"""
    try:
        search_terms = [
            quote(f"{endonym} film poster"),
            quote(f"{endonym} movie poster"),
            quote(f"{endonym} poster"),
        ]
        
        for search_term in search_terms:
            url = f"https://commons.wikimedia.org/w/index.php?search={search_term}&title=Special:MediaSearch&type=image"
            
            cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
                '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                '--connect-timeout', '20', '--max-time', '45', url]
            
            result = subprocess.run(cmd, capture_output=True, timeout=50)
            html = result.stdout.decode('utf-8', errors='ignore')
            
            # 提取搜索结果中的图片
            matches = re.findall(r'src="(//upload\.wikimedia\.org/wikipedia/commons/thumb/[^"]+)"', html)
            for img_url in matches[:3]:
                full_url = 'https:' + img_url
                success, size = curl_download(full_url, filepath)
                if success:
                    return True, size, "Wikimedia"
        
        return False, 0, None
    except Exception as e:
        return False, 0, None

def try_tmdb(endonym, year, filepath):
    """尝试TMDB"""
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
            return False, 0, None
        
        if data.get('results') and len(data['results']) > 0:
            poster_path = data['results'][0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, "TMDB"
        
        return False, 0, None
    except Exception as e:
        return False, 0, None

def try_imdb(imdb_id, filepath):
    """尝试IMDb"""
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
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, "IMDb"
        
        return False, 0, None
    except Exception as e:
        return False, 0, None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

def main():
    print("\n开始从其他来源下载剩余封面...")
    print("=" * 60)
    
    success_count = 0
    still_failed = []
    
    for i, movie in enumerate(missing_movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        year = movie.get('year', '')
        imdb_id = extract_imdb_id(movie['link'])
        
        filepath = POSTERS_DIR / f"{movie['id']}.jpg"
        
        print(f"\n[{i+1}/{len(missing_movies)}] {name} ({year})")
        print(f"    英文名: {endonym}")
        
        downloaded = False
        file_size = 0
        source = None
        
        # 1. 尝试IMDb
        if imdb_id and not downloaded:
            print(f"    尝试IMDb...")
            downloaded, file_size, source = try_imdb(imdb_id, filepath)
            if downloaded:
                print(f"    ✓ IMDb成功 ({file_size/1024:.1f} KB)")
        
        # 2. 尝试Wikipedia
        if not downloaded and endonym:
            print(f"    尝试Wikipedia...")
            downloaded, file_size, source = try_wikipedia(endonym, year, filepath)
            if downloaded:
                print(f"    ✓ Wikipedia成功 ({file_size/1024:.1f} KB)")
        
        # 3. 尝试Wikimedia Commons
        if not downloaded and endonym:
            print(f"    尝试Wikimedia Commons...")
            downloaded, file_size, source = try_wikimedia_commons(endonym, filepath)
            if downloaded:
                print(f"    ✓ Wikimedia成功 ({file_size/1024:.1f} KB)")
        
        # 4. 尝试TMDB
        if not downloaded and endonym:
            print(f"    尝试TMDB...")
            downloaded, file_size, source = try_tmdb(endonym, year, filepath)
            if downloaded:
                print(f"    ✓ TMDB成功 ({file_size/1024:.1f} KB)")
        
        if downloaded:
            success_count += 1
        else:
            print(f"    ✗ 所有来源都失败")
            still_failed.append(movie)
        
        time.sleep(1.5)
    
    print("\n" + "=" * 60)
    print(f"完成!")
    print(f"本次成功: {success_count}/{len(missing_movies)}")
    print(f"仍然失败: {len(still_failed)}/{len(missing_movies)}")
    
    if still_failed:
        print(f"\n仍然失败的 {len(still_failed)} 部电影:")
        for m in still_failed[:20]:
            print(f"  - {m['name']} ({m['endonym']}, {m['year']})")

if __name__ == '__main__':
    main()
