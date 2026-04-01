#!/usr/bin/env python3
"""
将封面图重命名为数据中的ID格式
"""

import re
import shutil
from pathlib import Path

POSTERS_DIR = Path('/Users/bbk/Desktop/Projects/earth/assets/movie-posters')

# 读取电影数据
with open('/Users/bbk/Desktop/Projects/earth/female-directors-movies-data.js', 'r', encoding='utf-8') as f:
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

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

# 建立文件名到ID的映射
rename_map = {}
for movie in movies:
    douban_id = extract_douban_id(movie['link'])
    imdb_id = extract_imdb_id(movie['link'])
    
    # 当前文件名（基于豆瓣ID或IMDbID）
    current_name = douban_id or imdb_id
    # 目标文件名（数据中的ID）
    target_name = movie['id']
    
    if current_name and current_name != target_name:
        rename_map[current_name] = {
            'target': target_name,
            'name': movie['name']
        }

print(f"需要重命名的文件: {len(rename_map)}")

# 执行重命名
success_count = 0
for current_name, info in rename_map.items():
    source = POSTERS_DIR / f"{current_name}.jpg"
    target = POSTERS_DIR / f"{info['target']}.jpg"
    
    if source.exists():
        try:
            shutil.move(str(source), str(target))
            print(f"✓ {current_name}.jpg -> {info['target']}.jpg ({info['name']})")
            success_count += 1
        except Exception as e:
            print(f"✗ {current_name}.jpg 重命名失败: {e}")
    else:
        print(f"⚠ {current_name}.jpg 不存在")

print(f"\n完成! 成功重命名 {success_count} 个文件")

# 列出所有封面图
print("\n当前封面图列表:")
poster_files = sorted(POSTERS_DIR.glob('*.jpg'))
for f in poster_files:
    size = f.stat().st_size
    print(f"  {f.name} ({size/1024:.1f} KB)")
