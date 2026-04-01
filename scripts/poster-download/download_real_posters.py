#!/usr/bin/env python3
"""
下载真实的电影封面图
使用多种方法尝试获取真实海报
"""

import re
import json
import time
import requests
from pathlib import Path
from urllib.parse import quote, urlparse
import subprocess

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
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '-H', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
            '--connect-timeout', '15',
            '--max-time', '60',
            '-o', str(filepath)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=70)
        
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 10000:  # 大于10KB认为是有效图片
                return True
            else:
                filepath.unlink()  # 删除小文件
        return False
    except Exception as e:
        print(f"  curl错误: {e}")
        return False

def try_douban_page(douban_id, filepath):
    """尝试从豆瓣页面获取封面图URL"""
    try:
        url = f"https://movie.douban.com/subject/{douban_id}/"
        
        # 使用curl获取页面
        cmd = [
            'curl', '-s', '-L', url,
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            '-H', 'Accept-Language: zh-CN,zh;q=0.9',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取封面图URL
        patterns = [
            r'data-pic="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
            r'<img src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"[^>]*title="[^"]*"[^>]*rel="v:image">',
            r'rel="v:image"[^>]*src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1)
                print(f"  找到豆瓣图片URL: {img_url}")
                if download_with_curl(img_url, filepath):
                    return True
        
        return False
    except Exception as e:
        print(f"  豆瓣页面错误: {e}")
        return False

def try_imdb_page(imdb_id, filepath):
    """尝试从IMDb页面获取封面图"""
    try:
        url = f"https://www.imdb.com/title/{imdb_id}/"
        
        cmd = [
            'curl', '-s', '-L', url,
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '--connect-timeout', '15',
            '--max-time', '30'
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=35)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取封面图URL
        patterns = [
            r'"image":"(https://m\.media-amazon\.com/images/[^"]+)"',
            r'"poster":"(https://m\.media-amazon\.com/images/[^"]+)"',
            r'<img[^>]*src="(https://m\.media-amazon\.com/images/[^"]+)"[^>]*class="[^"]*poster[^"]*"',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1).replace('\\u0026', '&')
                print(f"  找到IMDb图片URL: {img_url}")
                if download_with_curl(img_url, filepath):
                    return True
        
        return False
    except Exception as e:
        print(f"  IMDb页面错误: {e}")
        return False

def main():
    print("开始下载真实电影封面...\n")
    
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
        
        # 检查是否已存在有效文件
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 20000:  # 大于20KB认为是真实图片
                skipped_count += 1
                continue
        
        print(f"[{i+1}/{len(movies)}] {name}")
        if endonym and endonym != name:
            print(f"  英文名: {endonym}")
        
        downloaded = False
        
        # 1. 尝试豆瓣页面
        if douban_id and not downloaded:
            print(f"  尝试豆瓣页面...")
            downloaded = try_douban_page(douban_id, filepath)
            if downloaded:
                print(f"  ✓ 豆瓣下载成功")
        
        # 2. 尝试IMDb页面
        if imdb_id and not downloaded:
            print(f"  尝试IMDb页面...")
            downloaded = try_imdb_page(imdb_id, filepath)
            if downloaded:
                print(f"  ✓ IMDb下载成功")
        
        if downloaded:
            size = filepath.stat().st_size
            print(f"  文件大小: {size/1024:.1f} KB")
            success_count += 1
        else:
            print(f"  ✗ 下载失败")
            failed_count += 1
        
        # 延迟，避免被封
        if i < len(movies) - 1:
            time.sleep(2)
    
    print("\n" + "="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"跳过(已存在): {skipped_count}")
    print(f"失败: {failed_count}")

if __name__ == '__main__':
    main()
