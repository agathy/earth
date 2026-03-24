#!/usr/bin/env python3
"""
从豆瓣电影页面获取封面图URL并下载
"""

import json
import re
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()
    # 提取JSON数据
    match = re.search(r'const femaleDirectorsMovies = (\[.*?\]);', content, re.DOTALL)
    if match:
        movies = json.loads(match.group(1))
    else:
        print("无法解析电影数据")
        exit(1)

def extract_douban_id(url):
    """从豆瓣链接中提取电影ID"""
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def get_poster_url(douban_id):
    """
    尝试构建豆瓣封面图URL
    豆瓣封面图URL格式: https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{photo_id}.jpg
    """
    # 尝试几种常见的封面图URL格式
    base_urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img3.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    return base_urls

def download_image(url, filepath):
    """下载图片"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                with open(filepath, 'wb') as f:
                    f.write(response.read())
                return True
    except Exception as e:
        pass
    return False

def main():
    print(f"开始下载电影封面...")
    print(f"共 {len(movies)} 部电影")
    print()
    
    results = []
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, movie in enumerate(movies):
        name = movie['name']
        link = movie.get('link', '')
        
        douban_id = extract_douban_id(link)
        if not douban_id:
            print(f"✗ 跳过: {name} (无法提取豆瓣ID)")
            failed_count += 1
            continue
        
        # 检查是否已存在
        poster_path = POSTERS_DIR / f"{douban_id}.jpg"
        if poster_path.exists():
            print(f"✓ 已存在: {name}")
            skipped_count += 1
            results.append({
                'name': name,
                'douban_id': douban_id,
                'status': 'skipped',
                'path': str(poster_path)
            })
            continue
        
        # 尝试下载封面
        poster_urls = get_poster_url(douban_id)
        downloaded = False
        
        for url in poster_urls:
            if download_image(url, poster_path):
                print(f"✓ 下载成功: {name}")
                success_count += 1
                results.append({
                    'name': name,
                    'douban_id': douban_id,
                    'status': 'success',
                    'path': str(poster_path),
                    'url': url
                })
                downloaded = True
                break
        
        if not downloaded:
            print(f"✗ 下载失败: {name}")
            failed_count += 1
            results.append({
                'name': name,
                'douban_id': douban_id,
                'status': 'failed',
                'link': link
            })
        
        # 显示进度
        if (i + 1) % 10 == 0:
            print(f"\n进度: {i + 1}/{len(movies)} (成功: {success_count}, 已存在: {skipped_count}, 失败: {failed_count})\n")
        
        # 延迟，避免请求过快
        time.sleep(0.5)
    
    # 保存结果报告
    report_path = Path(__file__).parent / 'poster-download-report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"失败: {failed_count}")
    print(f"详细报告: {report_path}")

if __name__ == '__main__':
    main()
