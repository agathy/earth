#!/usr/bin/env python3
"""
下载电影封面图 - 使用多种方法
"""

import re
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

# 提取所有电影条目
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
    except:
        pass
    return False

def try_douban_direct(douban_id, filepath):
    """直接尝试豆瓣图片URL"""
    urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    for url in urls:
        if download_image(url, filepath):
            return True, 'douban_direct'
    return False, None

def try_tmdb_api(movie_name, filepath):
    """使用TMDb API搜索"""
    try:
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(movie_name)}&language=en-US&page=1"
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('results') and len(data['results']) > 0:
                poster_path = data['results'][0].get('poster_path')
                if poster_path:
                    img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                    if download_image(img_url, filepath):
                        return True, 'tmdb'
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
        
        # 1. 尝试豆瓣直接
        if douban_id:
            downloaded, _ = try_douban_direct(douban_id, filepath)
            if downloaded:
                print(f"  ✓ 豆瓣直接下载")
        
        # 2. 尝试TMDb (英文名)
        if not downloaded and endonym and endonym != name:
            downloaded, _ = try_tmdb_api(endonym, filepath)
            if downloaded:
                print(f"  ✓ TMDb英文")
        
        # 3. 尝试TMDb (中文名)
        if not downloaded:
            downloaded, _ = try_tmdb_api(name, filepath)
            if downloaded:
                print(f"  ✓ TMDb中文")
        
        if downloaded:
            success_count += 1
        else:
            print(f"  ✗ 失败")
            failed_count += 1
        
        time.sleep(0.5)
    
    print("\n" + "="*50)
    print("完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"失败: {failed_count}")

if __name__ == '__main__':
    main()
