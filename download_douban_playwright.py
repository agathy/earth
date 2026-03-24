#!/usr/bin/env python3
"""
使用 Playwright 模拟浏览器访问豆瓣下载封面图
"""

import re
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 读取电影数据
with open('female-directors-movies-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

movies = []
entry_pattern = r'\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?endonym:\s*"([^"]+)"[\s\S]*?year:\s*(\d+)[\s\S]*?link:\s*"([^"]+)"'
for match in re.finditer(entry_pattern, content):
    movies.append({
        'id': match.group(1),
        'name': match.group(2),
        'endonym': match.group(3),
        'year': match.group(4),
        'link': match.group(5)
    })

# 找出缺少封面图的电影
missing_movies = []
for movie in movies:
    filepath = POSTERS_DIR / f"{movie['id']}.jpg"
    if not filepath.exists() or filepath.stat().st_size < 15000:
        missing_movies.append(movie)

print(f"缺少封面图: {len(missing_movies)}/{len(movies)}")

def extract_douban_id(url):
    match = re.search(r'subject/(\d+)', url)
    return match.group(1) if match else None

async def download_douban_poster(movie, browser):
    """从豆瓣下载封面图"""
    douban_id = extract_douban_id(movie['link'])
    if not douban_id:
        return False, "无豆瓣ID"
    
    filepath = POSTERS_DIR / f"{movie['id']}.jpg"
    
    try:
        context = await browser.new_context(
            proxy={"server": "socks5://127.0.0.1:7897"}
        )
        page = await context.new_page()
        
        # 访问豆瓣电影页面
        url = f"https://movie.douban.com/subject/{douban_id}/"
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        # 等待图片加载
        await page.wait_for_selector('img[src*="doubanio.com"]', timeout=10000)
        
        # 获取图片URL
        img_url = await page.eval_on_selector(
            'img[src*="doubanio.com/view/photo/s_ratio_poster/public/"]',
            'el => el.src'
        )
        
        if img_url:
            # 下载图片
            response = await page.goto(img_url)
            if response:
                content = await response.body()
                if len(content) > 10000:
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    await context.close()
                    return True, f"{len(content)/1024:.1f} KB"
        
        await context.close()
        return False, "未找到图片"
    except Exception as e:
        return False, str(e)

async def main():
    print("\n使用 Playwright 从豆瓣下载封面...")
    print("=" * 60)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        success_count = 0
        still_failed = []
        
        for i, movie in enumerate(missing_movies):
            name = movie['name']
            douban_id = extract_douban_id(movie['link'])
            
            print(f"\n[{i+1}/{len(missing_movies)}] {name}")
            print(f"    豆瓣ID: {douban_id}")
            
            if not douban_id:
                print(f"    ✗ 无豆瓣ID")
                still_failed.append(movie)
                continue
            
            success, msg = await download_douban_poster(movie, browser)
            
            if success:
                print(f"    ✓ 成功 ({msg})")
                success_count += 1
            else:
                print(f"    ✗ 失败: {msg}")
                still_failed.append(movie)
            
            # 延迟避免被封
            await asyncio.sleep(2)
        
        await browser.close()
    
    print("\n" + "=" * 60)
    print(f"完成!")
    print(f"成功: {success_count}/{len(missing_movies)}")
    print(f"失败: {len(still_failed)}/{len(missing_movies)}")

if __name__ == '__main__':
    asyncio.run(main())
