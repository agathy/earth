#!/usr/bin/env python3
"""
从多个来源下载电影封面图
"""

import re
import json
import time
import requests
from pathlib import Path
from urllib.parse import quote

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目（包括英文名）
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

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

def download_image(url, filepath):
    """下载图片"""
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200 and len(response.content) > 5000:
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        pass
    return False

def try_douban(douban_id, filepath):
    """尝试从豆瓣下载"""
    img_urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    
    for url in img_urls:
        if download_image(url, filepath):
            return True, 'douban'
    return False, None

def try_imdb(imdb_id, filepath):
    """尝试从IMDb下载"""
    try:
        # 获取IMDb页面
        url = f"https://www.imdb.com/title/{imdb_id}/"
        response = requests.get(url, headers={**headers, 'Accept-Language': 'en-US'}, timeout=30)
        
        if response.status_code == 200:
            # 提取封面图URL
            patterns = [
                r'"image":"(https://m\.media-amazon\.com/images/[^"]+)"',
                r'"poster":"(https://m\.media-amazon\.com/images/[^"]+)"',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, response.text)
                if match:
                    img_url = match.group(1).replace('\\u0026', '&')
                    if download_image(img_url, filepath):
                        return True, 'imdb'
    except:
        pass
    return False, None

def try_tmdb(movie_name, filepath):
    """尝试从TMDb搜索下载"""
    try:
        # 搜索电影
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(movie_name)}&language=en-US"
        response = requests.get(search_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('results'):
                poster_path = data['results'][0].get('poster_path')
                if poster_path:
                    img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                    if download_image(img_url, filepath):
                        return True, 'tmdb'
    except:
        pass
    return False, None

def try_omdb(imdb_id, filepath):
    """尝试从OMDb API下载 (需要API key，这里使用公开端点)"""
    try:
        # OMDb需要API key，跳过
        pass
    except:
        pass
    return False, None

def main():
    print("开始下载电影封面...\n")
    
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, movie in enumerate(movies):
        name = movie['name']
        endonym = movie.get('endonym', name)
        link = movie['link']
        
        douban_id = extract_douban_id(link)
        imdb_id = extract_imdb_id(link)
        
        file_id = douban_id or imdb_id or movie['id']
        filepath = POSTERS_DIR / f"{file_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 10000:
            skipped_count += 1
            continue
        
        print(f"[{i+1}/{len(movies)}] {name}")
        
        downloaded = False
        source = None
        
        # 1. 尝试豆瓣
        if douban_id:
            print(f"  尝试豆瓣...")
            downloaded, source = try_douban(douban_id, filepath)
            if downloaded:
                print(f"  ✓ 豆瓣成功")
        
        # 2. 尝试IMDb
        if not downloaded and imdb_id:
            print(f"  尝试IMDb...")
            downloaded, source = try_imdb(imdb_id, filepath)
            if downloaded:
                print(f"  ✓ IMDb成功")
        
        # 3. 尝试TMDb (使用英文名)
        if not downloaded and endonym and endonym != name:
            print(f"  尝试TMDb (英文)...")
            downloaded, source = try_tmdb(endonym, filepath)
            if downloaded:
                print(f"  ✓ TMDb英文成功")
        
        # 4. 尝试TMDb (使用中文名)
        if not downloaded:
            print(f"  尝试TMDb (中文)...")
            downloaded, source = try_tmdb(name, filepath)
            if downloaded:
                print(f"  ✓ TMDb中文成功")
        
        if downloaded:
            filesize = filepath.stat().st_size
            print(f"  文件大小: {filesize} bytes")
            success_count += 1
        else:
            print(f"  ✗ 所有来源都失败")
            failed_count += 1
        
        # 延迟
        if i < len(movies) - 1:
            time.sleep(1)
    
    print("\n" + "="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"失败: {failed_count}")

if __name__ == '__main__':
    main()
