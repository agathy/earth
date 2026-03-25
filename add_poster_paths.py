#!/usr/bin/env python3
import json
import os
import re

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 使用正则表达式提取电影数组
pattern = r'const femaleDirectorsMovies = \[(.*?)\];'
match = re.search(pattern, content, re.DOTALL)

if not match:
    print("❌ 无法找到电影数据数组")
    exit(1)

movies_js = match.group(1)

# 手动解析电影数据
movies = []
movie_blocks = re.findall(r'\{(.*?)\}', movies_js, re.DOTALL)

for block in movie_blocks:
    movie = {}
    # 提取字段
    lines = block.strip().split('\n')
    for line in lines:
        line = line.strip()
        if line and ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().rstrip(',')
            
            # 处理字符串值
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            
            # 处理数组值
            elif value.startswith('[') and value.endswith(']'):
                value = json.loads(value.replace("'", '"'))
            
            # 处理数字值
            elif value.isdigit():
                value = int(value)
            elif re.match(r'^\d+\.\d+$', value):
                value = float(value)
            
            movie[key] = value
    
    if movie:
        movies.append(movie)

print(f"找到 {len(movies)} 部电影")

# 检查海报文件是否存在
posters_dir = 'assets/movie-posters'
poster_files = os.listdir(posters_dir)

# 为每部电影添加poster字段
for movie in movies:
    # 根据ID构建海报文件名
    poster_filename = f"{movie['id']}.jpg"
    
    # 检查文件是否存在
    if poster_filename in poster_files:
        movie['poster'] = f"./{posters_dir}/{poster_filename}"
        print(f"✓ 为 {movie['name']} 添加海报: {poster_filename}")
    else:
        print(f"✗ 未找到 {movie['name']} 的海报: {poster_filename}")

# 生成新的电影数据
new_movies_js = 'const femaleDirectorsMovies = [\n'
for i, movie in enumerate(movies):
    new_movies_js += '  {\n'
    for key, value in movie.items():
        if isinstance(value, str):
            new_movies_js += f'    {key}: "{value}",\n'
        elif isinstance(value, list):
            new_movies_js += f'    {key}: {json.dumps(value, ensure_ascii=False)},\n'
        else:
            new_movies_js += f'    {key}: {value},\n'
    new_movies_js += '  }'
    if i < len(movies) - 1:
        new_movies_js += ','
    new_movies_js += '\n'
new_movies_js += '];\n'

# 替换原文件中的电影数据
new_content = content[:match.start()] + new_movies_js + content[match.end():]

# 写入文件
with open('female-directors-movies-data.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"\n✅ 已为 {len([m for m in movies if 'poster' in m])} 部电影添加海报路径")