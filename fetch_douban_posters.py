#!/usr/bin/env python3
"""
从豆瓣电影页面获取封面图
"""

import re
import json
import time
import requests
from pathlib import Path
from urllib.parse import urljoin

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
# 匹配每个电影条目
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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def fetch_douban_page(douban_id):
    """获取豆瓣电影页面"""
    url = f"https://movie.douban.com/subject/{douban_id}/"
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200:
            return response.text
    except Exception as e:
        print(f"  请求失败: {e}")
    return None

def extract_poster_url(html):
    """从HTML中提取封面图URL"""
    # 尝试多种模式
    patterns = [
        r'<img[^>]*src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"[^>]*rel="v:image"',
        r'<img[^>]*rel="v:image"[^>]*src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
        r'"image":\s*"(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
        r'<div id="mainpic">[\s\S]*?<img[^>]*src="(https://img\d+\.doubanio\.com/[^"]+)"',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            return match.group(1).replace('\\/', '/')
    return None

def download_image(url, filepath):
    """下载图片"""
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"  下载失败: {e}")
    return False

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
            print(f"[{i+1}/{len(movies)}] ⚠ 跳过: {name} (不是豆瓣链接)")
            continue
        
        filepath = POSTERS_DIR / f"{douban_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 10000:
            print(f"[{i+1}/{len(movies)}] ✓ 已存在: {name}")
            skipped_count += 1
            continue
        
        print(f"[{i+1}/{len(movies)}] {name}")
        print(f"  豆瓣ID: {douban_id}")
        
        # 获取页面
        html = fetch_douban_page(douban_id)
        if not html:
            print(f"  ✗ 无法获取页面")
            failed_count += 1
            continue
        
        # 提取封面URL
        poster_url = extract_poster_url(html)
        if not poster_url:
            print(f"  ✗ 未找到封面URL")
            failed_count += 1
            continue
        
        print(f"  封面URL: {poster_url}")
        
        # 下载封面
        if download_image(poster_url, filepath):
            filesize = filepath.stat().st_size
            print(f"  ✓ 下载成功 ({filesize} bytes)")
            success_count += 1
        else:
            print(f"  ✗ 下载失败")
            failed_count += 1
        
        # 延迟
        if i < len(movies) - 1:
            time.sleep(2)
    
    print("\n" + "="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"失败: {failed_count}")

if __name__ == '__main__':
    main()
