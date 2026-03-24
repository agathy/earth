#!/usr/bin/env python3
"""
下载电影封面图
支持豆瓣和IMDb链接
"""

import json
import re
import os
import time
import requests
from pathlib import Path
from urllib.parse import urlparse

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据 - 使用正则表达式提取
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
pattern = r'\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)".*?link:\s*"([^"]+)"'
matches = re.findall(pattern, content, re.DOTALL)

# 更完整的解析
entry_pattern = r'\{\s*id:\s*"([^"]+)"[^}]+name:\s*"([^"]+)"[^}]+link:\s*"([^"]+)"[^}]*\}'
for match in re.finditer(entry_pattern, content):
    movie_id = match.group(1)
    name = match.group(2)
    link = match.group(3)
    movies.append({
        'id': movie_id,
        'name': name,
        'link': link
    })

print(f"解析到 {len(movies)} 部电影")

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

def extract_id(url):
    """从链接中提取ID"""
    if 'douban.com' in url:
        match = re.search(r'subject/(\d+)', url)
        return ('douban', match.group(1)) if match else (None, None)
    elif 'imdb.com' in url:
        match = re.search(r'title/(tt\d+)', url)
        return ('imdb', match.group(1)) if match else (None, None)
    return (None, None)

def download_from_douban(douban_id, filepath):
    """尝试从豆瓣下载封面"""
    # 豆瓣图片URL格式
    img_urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
        f"https://img3.doubanio.com/view/photo/s_ratio_poster/public/p{douban_id}.jpg",
    ]
    
    for url in img_urls:
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200 and len(response.content) > 1000:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                return True
        except:
            continue
    return False

def download_from_imdb(imdb_id, filepath):
    """尝试从IMDb下载封面"""
    try:
        # IMDb页面
        url = f"https://www.imdb.com/title/{imdb_id}/"
        headers_imdb = {
            **headers,
            'Accept-Language': 'en-US,en;q=0.9',
        }
        response = requests.get(url, headers=headers_imdb, timeout=30)
        
        if response.status_code == 200:
            # 尝试从HTML中提取封面图URL
            patterns = [
                r'"image":"(https://m\.media-amazon\.com/images/[^"]+)"',
                r'"poster":"(https://m\.media-amazon\.com/images/[^"]+)"',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, response.text)
                if match:
                    img_url = match.group(1).replace('\\u0026', '&')
                    img_response = requests.get(img_url, headers=headers, timeout=30)
                    if img_response.status_code == 200:
                        with open(filepath, 'wb') as f:
                            f.write(img_response.content)
                        return True
    except Exception as e:
        pass
    return False

def create_placeholder(movie_name, filepath):
    """创建占位符图片（使用纯色背景+文字）"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        # 创建纯色背景
        img = Image.new('RGB', (300, 450), color=(200, 200, 200))
        draw = ImageDraw.Draw(img)
        
        # 尝试使用系统字体
        try:
            font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 24)
        except:
            font = ImageFont.load_default()
        
        # 绘制文字
        text = movie_name[:10] + "..." if len(movie_name) > 10 else movie_name
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (300 - text_width) / 2
        y = (450 - text_height) / 2
        
        draw.text((x, y), text, fill=(50, 50, 50), font=font)
        img.save(filepath)
        return True
    except:
        return False

def main():
    print(f"开始下载电影封面...")
    print(f"共 {len(movies)} 部电影")
    print()
    
    results = []
    success_count = 0
    failed_count = 0
    skipped_count = 0
    placeholder_count = 0
    
    for i, movie in enumerate(movies):
        name = movie['name']
        link = movie.get('link', '')
        
        source_type, source_id = extract_id(link)
        
        if not source_id:
            print(f"⚠ 跳过: {name} (无法识别链接)")
            failed_count += 1
            continue
        
        # 检查是否已存在
        poster_path = POSTERS_DIR / f"{source_id}.jpg"
        if poster_path.exists():
            print(f"✓ 已存在: {name}")
            skipped_count += 1
            results.append({
                'name': name,
                'id': source_id,
                'status': 'skipped',
                'path': str(poster_path)
            })
            continue
        
        downloaded = False
        
        # 根据来源尝试下载
        if source_type == 'douban':
            downloaded = download_from_douban(source_id, poster_path)
        elif source_type == 'imdb':
            downloaded = download_from_imdb(source_id, poster_path)
        
        if downloaded:
            print(f"✓ 下载成功: {name}")
            success_count += 1
            results.append({
                'name': name,
                'id': source_id,
                'status': 'success',
                'path': str(poster_path)
            })
        else:
            # 创建占位符
            if create_placeholder(name, poster_path):
                print(f"⚠ 占位符: {name}")
                placeholder_count += 1
                results.append({
                    'name': name,
                    'id': source_id,
                    'status': 'placeholder',
                    'path': str(poster_path)
                })
            else:
                print(f"✗ 失败: {name}")
                failed_count += 1
                results.append({
                    'name': name,
                    'id': source_id,
                    'status': 'failed',
                    'link': link
                })
        
        # 显示进度
        if (i + 1) % 10 == 0 or i == len(movies) - 1:
            print(f"\n进度: {i + 1}/{len(movies)}")
            print(f"  成功: {success_count}, 已存在: {skipped_count}, 占位符: {placeholder_count}, 失败: {failed_count}")
            print()
        
        # 延迟
        time.sleep(1)
    
    # 保存结果报告
    report_path = Path(__file__).parent / 'poster-download-report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("="*50)
    print("下载完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"占位符: {placeholder_count}")
    print(f"失败: {failed_count}")
    print(f"详细报告: {report_path}")

if __name__ == '__main__':
    main()
