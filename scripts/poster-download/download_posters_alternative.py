#!/usr/bin/env python3
"""
使用替代方法下载电影封面图
尝试 Wikipedia、Wikimedia Commons 等公开资源
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
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?endonym:\s*"([^"]+)"[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'endonym': match.group(3),
        'link': match.group(4)
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

def try_wikipedia(endonym, filepath):
    """尝试从Wikipedia获取封面图"""
    try:
        # 构建Wikipedia搜索URL
        search_term = quote(endonym.replace(' ', '_'))
        wiki_url = f"https://en.wikipedia.org/wiki/{search_term}"
        
        cmd = [
            'curl', '-s', '-L', wiki_url,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        patterns = [
            r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"',
            r'<img[^>]*src="(https://upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1)
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                print(f"  找到Wikipedia图片: {img_url}")
                if download_with_curl(img_url, filepath):
                    return True
        return False
    except Exception as e:
        return False

def try_wikimedia_commons(endonym, filepath):
    """尝试从Wikimedia Commons搜索"""
    try:
        search_term = quote(f"{endonym} film poster")
        search_url = f"https://commons.wikimedia.org/w/index.php?search={search_term}&title=Special:MediaSearch&type=image"
        
        cmd = [
            'curl', '-s', '-L', search_url,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取第一张图片
        match = re.search(r'src="(//upload\.wikimedia\.org/wikipedia/commons/thumb/[^"]+)"', html)
        if match:
            img_url = 'https:' + match.group(1)
            print(f"  找到Wikimedia图片: {img_url}")
            if download_with_curl(img_url, filepath):
                return True
        return False
    except Exception as e:
        return False

def main():
    print("开始下载电影封面...\n")
    
    success_count = 0
    failed_count = 0
    
    # 只处理前10部电影作为测试
    test_movies = movies[:10]
    
    for i, movie in enumerate(test_movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        
        douban_id = extract_douban_id(movie['link'])
        imdb_id = extract_imdb_id(movie['link'])
        file_id = douban_id or imdb_id or movie['id']
        
        filepath = POSTERS_DIR / f"{file_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 20000:
            print(f"[{i+1}] {name} - 已存在")
            continue
        
        print(f"[{i+1}] {name}")
        print(f"  英文名: {endonym}")
        
        downloaded = False
        
        # 尝试Wikipedia
        if not downloaded and endonym:
            print(f"  尝试Wikipedia...")
            downloaded = try_wikipedia(endonym, filepath)
            if downloaded:
                print(f"  ✓ Wikipedia成功")
        
        # 尝试Wikimedia Commons
        if not downloaded and endonym:
            print(f"  尝试Wikimedia Commons...")
            downloaded = try_wikimedia_commons(endonym, filepath)
            if downloaded:
                print(f"  ✓ Wikimedia成功")
        
        if downloaded:
            size = filepath.stat().st_size
            print(f"  文件大小: {size/1024:.1f} KB")
            success_count += 1
        else:
            print(f"  ✗ 所有来源都失败")
            failed_count += 1
        
        time.sleep(2)
    
    print(f"\n完成! 成功: {success_count}, 失败: {failed_count}")

if __name__ == '__main__':
    main()
