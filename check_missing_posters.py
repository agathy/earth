#!/usr/bin/env python3
"""
检查哪些电影还缺少封面图
"""

import re
from pathlib import Path

POSTERS_DIR = Path('/Users/bbk/Desktop/Projects/earth/assets/movie-posters')

# 读取电影数据
with open('/Users/bbk/Desktop/Projects/earth/female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?director:\s*"([^"]+)"[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'director': match.group(3),
        'link': match.group(4)
    })

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

# 检查每个电影的封面图
missing = []
has_cover = []

for movie in movies:
    douban_id = extract_douban_id(movie['link'])
    imdb_id = extract_imdb_id(movie['link'])
    file_id = douban_id or imdb_id or movie['id']
    
    poster_file = POSTERS_DIR / f"{file_id}.jpg"
    
    if poster_file.exists():
        size = poster_file.stat().st_size
        if size > 10000:
            has_cover.append(movie)
        else:
            missing.append({**movie, 'reason': f'文件太小 ({size} bytes)'})
    else:
        missing.append({**movie, 'reason': '文件不存在'})

print(f"统计结果:")
print(f"  有封面图: {len(has_cover)}/{len(movies)}")
print(f"  缺少封面图: {len(missing)}/{len(movies)}")
print()

if missing:
    print("缺少封面图的电影列表:")
    print("-" * 80)
    for i, movie in enumerate(missing, 1):
        print(f"{i}. {movie['name']} ({movie['director']}, {movie.get('year', 'N/A')})")
        print(f"   链接: {movie['link']}")
        print(f"   原因: {movie['reason']}")
        print()
