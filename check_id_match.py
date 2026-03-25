#!/usr/bin/env python3
"""检查数据ID和海报文件名是否匹配"""

import os
import re

# 读取数据文件
with open('/Users/bbk/Desktop/Projects/earth/female-directors-movies-data.js', 'r') as f:
    content = f.read()

# 提取所有ID
id_pattern = r'id:\s*"([^"]+)"'
ids = re.findall(id_pattern, content)

print(f"数据文件中共有 {len(ids)} 个ID")

# 获取实际的海报文件
poster_dir = '/Users/bbk/Desktop/Projects/earth/assets/movie-posters/'
existing_files = set(os.listdir(poster_dir))

print(f"海报目录中有 {len(existing_files)} 个文件")

# 检查每个ID对应的海报是否存在
missing = []
for movie_id in ids:
    expected_file = f"{movie_id}.jpg"
    if expected_file not in existing_files:
        missing.append(movie_id)

if missing:
    print(f"\n✗ 缺失海报的ID ({len(missing)} 个):")
    for m in missing[:20]:
        print(f"  - {m}")
    if len(missing) > 20:
        print(f"  ... 还有 {len(missing) - 20} 个")
else:
    print("\n✓ 所有ID都有对应的海报文件")

# 检查是否有额外的海报文件
extra_files = []
for filename in existing_files:
    if filename.endswith('.jpg'):
        movie_id = filename[:-4]  # 去掉.jpg
        if movie_id not in ids:
            extra_files.append(filename)

if extra_files:
    print(f"\n⚠ 额外的海报文件 ({len(extra_files)} 个):")
    for f in sorted(extra_files)[:10]:
        print(f"  - {f}")
    if len(extra_files) > 10:
        print(f"  ... 还有 {len(extra_files) - 10} 个")
