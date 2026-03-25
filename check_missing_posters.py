#!/usr/bin/env python3
"""检查缺失的海报文件"""

import os
import re

# 读取数据文件
with open('/Users/bbk/Desktop/Projects/earth/female-directors-movies-data.js', 'r') as f:
    content = f.read()

# 提取所有poster路径
poster_pattern = r'poster:\s*"([^"]+)"'
posters = re.findall(poster_pattern, content)

print(f"总共 {len(posters)} 部电影需要海报")

# 检查哪些文件存在
existing_files = set()
missing_files = []

for poster_path in posters:
    # 从路径中提取文件名
    filename = os.path.basename(poster_path)
    full_path = f'/Users/bbk/Desktop/Projects/earth/assets/movie-posters/{filename}'

    if os.path.exists(full_path):
        existing_files.add(filename)
    else:
        missing_files.append(filename)

print(f"\n✓ 存在的海报: {len(existing_files)} 个")
print(f"✗ 缺失的海报: {len(missing_files)} 个")

if missing_files:
    print("\n缺失的海报文件:")
    for f in sorted(missing_files)[:20]:  # 只显示前20个
        print(f"  - {f}")
    if len(missing_files) > 20:
        print(f"  ... 还有 {len(missing_files) - 20} 个")
