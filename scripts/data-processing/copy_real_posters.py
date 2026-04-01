#!/usr/bin/env python3
"""
将真实的封面图从 posters 目录复制到 assets/movie-posters/
并按豆瓣ID或IMDbID重命名
"""

import re
import shutil
from pathlib import Path

# 路径设置
SOURCE_DIR = Path('/Users/bbk/Desktop/Projects/earth/posters')
TARGET_DIR = Path('/Users/bbk/Desktop/Projects/earth/assets/movie-posters')

# 确保目标目录存在
TARGET_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('/Users/bbk/Desktop/Projects/earth/female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
# 匹配每个电影对象
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'link': match.group(3)
    })

print(f"解析到 {len(movies)} 部电影")

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

# 获取所有源文件（按文件名排序）
source_files = sorted(SOURCE_DIR.glob('*.jpg'))
print(f"找到 {len(source_files)} 个源文件")

# 复制文件
success_count = 0
for i, movie in enumerate(movies):
    if i >= len(source_files):
        print(f"[{i+1}/{len(movies)}] {movie['name']} - 没有更多源文件")
        continue
    
    # 确定目标文件名
    douban_id = extract_douban_id(movie['link'])
    imdb_id = extract_imdb_id(movie['link'])
    file_id = douban_id or imdb_id or movie['id']
    
    source_file = source_files[i]
    target_file = TARGET_DIR / f"{file_id}.jpg"
    
    # 检查目标文件是否已存在且有效
    if target_file.exists():
        target_size = target_file.stat().st_size
        if target_size > 10000:  # 大于10KB认为是有效文件
            print(f"[{i+1}/{len(movies)}] {movie['name']} - 已存在 ({target_size} bytes)")
            success_count += 1
            continue
    
    # 检查源文件大小
    source_size = source_file.stat().st_size
    if source_size < 10000:  # 小于10KB可能是占位图
        print(f"[{i+1}/{len(movies)}] {movie['name']} - 源文件太小 ({source_size} bytes)，跳过")
        continue
    
    # 复制文件
    try:
        shutil.copy2(source_file, target_file)
        print(f"[{i+1}/{len(movies)}] {movie['name']} - 复制成功 ({source_size} bytes)")
        success_count += 1
    except Exception as e:
        print(f"[{i+1}/{len(movies)}] {movie['name']} - 复制失败: {e}")

print(f"\n完成! 成功复制 {success_count}/{len(movies)} 个封面图")
