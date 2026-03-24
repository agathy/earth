#!/usr/bin/env python3
"""
生成电影封面占位图
使用电影名称和导演信息生成简洁的封面图
"""

import re
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# 创建保存目录
POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取所有电影条目
movies = []
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?director:\s*"([^"]+)"[\s\S]*?year:\s*(\d+)[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'director': match.group(3),
        'year': match.group(4),
        'link': match.group(5)
    })

print(f"解析到 {len(movies)} 部电影")

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

def extract_imdb_id(url):
    match = re.search(r'title/(tt\d+)', url)
    return match.group(1) if match else None

def generate_poster(movie, filepath):
    """生成电影封面图"""
    # 创建图片 (2:3 比例，适合电影海报)
    width, height = 300, 450
    
    # 使用柔和的背景色
    import random
    random.seed(movie['name'])
    hue = random.randint(0, 360)
    
    # 创建渐变背景
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    
    # 添加一些装饰性元素
    for i in range(0, height, 20):
        alpha = int(255 * (1 - i / height) * 0.1)
        draw.line([(0, i), (width, i)], fill=(200, 200, 200), width=1)
    
    # 尝试加载字体
    try:
        # macOS 系统字体
        title_font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 28)
        director_font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 18)
        year_font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 16)
    except:
        try:
            title_font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 28)
            director_font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 18)
            year_font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 16)
        except:
            title_font = ImageFont.load_default()
            director_font = ImageFont.load_default()
            year_font = ImageFont.load_default()
    
    # 绘制电影名称
    name = movie['name']
    if len(name) > 8:
        name = name[:7] + "..."
    
    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), name, font=title_font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) / 2
    y = height / 2 - 40
    
    # 绘制文字阴影
    draw.text((x+2, y+2), name, fill=(100, 100, 100), font=title_font)
    draw.text((x, y), name, fill=(50, 50, 50), font=title_font)
    
    # 绘制导演
    director_text = f"导演: {movie['director']}"
    if len(director_text) > 15:
        director_text = director_text[:14] + "..."
    bbox = draw.textbbox((0, 0), director_text, font=director_font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) / 2
    draw.text((x, y + 50), director_text, fill=(100, 100, 100), font=director_font)
    
    # 绘制年份
    year_text = str(movie['year'])
    bbox = draw.textbbox((0, 0), year_text, font=year_font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) / 2
    draw.text((x, y + 80), year_text, fill=(150, 150, 150), font=year_font)
    
    # 保存图片
    img.save(filepath, 'JPEG', quality=90)
    return True

def main():
    print("开始生成电影封面...\n")
    
    success_count = 0
    skipped_count = 0
    
    for i, movie in enumerate(movies):
        douban_id = extract_douban_id(movie['link'])
        imdb_id = extract_imdb_id(movie['link'])
        file_id = douban_id or imdb_id or movie['id']
        
        filepath = POSTERS_DIR / f"{file_id}.jpg"
        
        # 检查是否已存在
        if filepath.exists() and filepath.stat().st_size > 10000:
            skipped_count += 1
            continue
        
        print(f"[{i+1}/{len(movies)}] {movie['name']}")
        
        try:
            if generate_poster(movie, filepath):
                print(f"  ✓ 生成成功")
                success_count += 1
            else:
                print(f"  ✗ 生成失败")
        except Exception as e:
            print(f"  ✗ 错误: {e}")
    
    print("\n" + "="*50)
    print("完成!")
    print(f"成功: {success_count}")
    print(f"已存在: {skipped_count}")
    print(f"\n封面图保存在: {POSTERS_DIR}")

if __name__ == '__main__':
    main()
