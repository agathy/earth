#!/usr/bin/env python3
"""
尝试更多来源下载电影封面图
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

def try_rotten_tomatoes(endonym, year, filepath):
    """烂番茄"""
    try:
        search_term = quote(endonym.lower().replace(' ', '_'))
        url = f"https://www.rottentomatoes.com/m/{search_term}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"image":"(https://resizing\.flixster\.com/[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size, "烂番茄"
        return False, 0, None
    except:
        return False, 0, None

def try_metacritic(endonym, filepath):
    """Metacritic"""
    try:
        search_term = quote(endonym.lower().replace(' ', '-'))
        url = f"https://www.metacritic.com/movie/{search_term}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"imageUrl":"(https://static\.metacritic\.com/[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size, "Metacritic"
        return False, 0, None
    except:
        return False, 0, None

def try_allmovie(endonym, filepath):
    """AllMovie"""
    try:
        search_term = quote(endonym.lower().replace(' ', '-'))
        url = f"https://www.allmovie.com/movie/{search_term}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"image":"(https://[^"]+allmovie\.com[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size, "AllMovie"
        return False, 0, None
    except:
        return False, 0, None

def try_duckduckgo(endonym, year, filepath):
    """DuckDuckGo图片搜索"""
    try:
        search_query = quote(f"{endonym} {year} movie poster")
        url = f"https://duckduckgo.com/?q={search_query}&iax=images&ia=images"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        matches = re.findall(r'https://[^"\s]+\.(?:jpg|jpeg|png)', html)
        for img_url in matches[:5]:
            if 'duckduckgo' not in img_url:
                success, size = curl_download(img_url, filepath)
                if success:
                    return True, size, "DuckDuckGo"
        return False, 0, None
    except:
        return False, 0, None

def try_baidu_images(name, filepath):
    """百度图片搜索"""
    try:
        search_query = quote(f"{name} 电影海报")
        url = f"https://image.baidu.com/search/index?tn=baiduimage&word={search_query}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept-Language: zh-CN,zh;q=0.9',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        matches = re.findall(r'"objURL":"(https?://[^"]+\.(?:jpg|jpeg|png))"', html)
        for img_url in matches[:5]:
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size, "百度图片"
        return False, 0, None
    except:
        return False, 0, None

def try_yandex(endonym, filepath):
    """Yandex图片搜索"""
    try:
        search_query = quote(f"{endonym} movie poster")
        url = f"https://yandex.com/images/search?text={search_query}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        matches = re.findall(r'"url":"(https://[^"]+\.(?:jpg|jpeg|png))"', html)
        for img_url in matches[:5]:
            success, size = curl_download(img_url, filepath)
            if success:
                return True, size, "Yandex"
        return False, 0, None
    except:
        return False, 0, None

def main():
    print("\n尝试更多来源下载剩余封面...")
    print("=" * 60)
    
    success_count = 0
    still_failed = []
    
    for i, movie in enumerate(missing_movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        year = movie.get('year', '')
        
        filepath = POSTERS_DIR / f"{movie['id']}.jpg"
        
        print(f"\n[{i+1}/{len(missing_movies)}] {name} ({year})")
        
        downloaded = False
        file_size = 0
        source = None
        
        # 1. 尝试烂番茄
        if not downloaded and endonym:
            print(f"    尝试烂番茄...")
            downloaded, file_size, source = try_rotten_tomatoes(endonym, year, filepath)
            if downloaded:
                print(f"    ✓ 烂番茄成功 ({file_size/1024:.1f} KB)")
        
        # 2. 尝试Metacritic
        if not downloaded and endonym:
            print(f"    尝试Metacritic...")
            downloaded, file_size, source = try_metacritic(endonym, filepath)
            if downloaded:
                print(f"    ✓ Metacritic成功 ({file_size/1024:.1f} KB)")
        
        # 3. 尝试AllMovie
        if not downloaded and endonym:
            print(f"    尝试AllMovie...")
            downloaded, file_size, source = try_allmovie(endonym, filepath)
            if downloaded:
                print(f"    ✓ AllMovie成功 ({file_size/1024:.1f} KB)")
        
        # 4. 尝试百度图片
        if not downloaded:
            print(f"    尝试百度图片...")
            downloaded, file_size, source = try_baidu_images(name, filepath)
            if downloaded:
                print(f"    ✓ 百度图片成功 ({file_size/1024:.1f} KB)")
        
        # 5. 尝试DuckDuckGo
        if not downloaded and endonym:
            print(f"    尝试DuckDuckGo...")
            downloaded, file_size, source = try_duckduckgo(endonym, year, filepath)
            if downloaded:
                print(f"    ✓ DuckDuckGo成功 ({file_size/1024:.1f} KB)")
        
        # 6. 尝试Yandex
        if not downloaded and endonym:
            print(f"    尝试Yandex...")
            downloaded, file_size, source = try_yandex(endonym, filepath)
            if downloaded:
                print(f"    ✓ Yandex成功 ({file_size/1024:.1f} KB)")
        
        if downloaded:
            success_count += 1
        else:
            print(f"    ✗ 所有来源都失败")
            still_failed.append(movie)
        
        time.sleep(2)
    
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
