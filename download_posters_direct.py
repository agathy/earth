#!/usr/bin/env python3
"""
直接下载豆瓣电影封面图
使用已知的豆瓣图片URL格式
"""

import re
import time
import requests
from pathlib import Path

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'link': match.group(3)
    })

print(f"解析到 {len(movies)} 部电影")

# 请求头
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://movie.douban.com/',
}

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def try_download_poster(douban_id, filepath):
    """
    尝试多种方式下载封面
    """
    # 方式1: 直接尝试豆瓣图片URL (有些电影的图片ID等于subject_id)
    img_urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img3.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    
    for url in img_urls:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200 and len(response.content) > 5000:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                return True, url
        except:
            continue
    
    return False, None

def main():
    print("开始下载电影封面...\n")
    
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, movie in enumerate(movies):
        name = movie['name']
        link = movie['link']
        
        douban_id = extract_douban_id(link)
        if not douban_id:
            continue
        
        filepath = POSTERS_DIR / f"{douban_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 10000:
            skipped_count += 1
            continue
        
        print(f"[{i+1}/{len(movies)}] {name} (ID: {douban_id})")
        
        # 尝试下载
        success, url = try_download_poster(douban_id, filepath)
        
        if success:
            filesize = filepath.stat().st_size
            print(f"  ✓ 成功 ({filesize} bytes)")
            success_count += 1
        else:
            print(f"  ✗ 无法下载")
            failed_count += 1
        
        # 延迟
        if i < len(movies) - 1:
            time.sleep(0.5)
    
    print("\n" + "="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"失败: {failed_count}")

if __name__ == '__main__':
    main()
