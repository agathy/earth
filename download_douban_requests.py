#!/usr/bin/env python3
"""
使用 requests 和 BeautifulSoup 下载豆瓣封面图
"""

import re
import time
import requests
from pathlib import Path
from urllib.parse import quote

POSTERS_DIR = Path(__file__).parent / 'assets' / 'movie-posters'
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 设置代理
proxies = {
    'http': 'socks5://127.0.0.1:7897',
    'https': 'socks5://127.0.0.1:7897'
}

# 请求头
headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
}

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

def download_douban_poster(movie):
    """从豆瓣下载封面图"""
    douban_id = extract_douban_id(movie['link'])
    if not douban_id:
        return False, "无豆瓣ID"
    
    filepath = POSTERS_DIR / f"{movie['id']}.jpg"
    
    try:
        # 创建session
        session = requests.Session()
        
        # 先访问豆瓣首页获取cookie
        session.get('https://movie.douban.com/', headers=headers, proxies=proxies, timeout=10)
        time.sleep(1)
        
        # 访问电影页面
        url = f"https://movie.douban.com/subject/{douban_id}/"
        response = session.get(url, headers=headers, proxies=proxies, timeout=15)
        
        if response.status_code != 200:
            return False, f"HTTP {response.status_code}"
        
        html = response.text
        
        # 提取图片URL
        patterns = [
            r'<img[^>]*src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"[^>]*rel="v:image">',
            r'data-pic="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
            r'"image":"(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
        ]
        
        img_url = None
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1).replace('\\/', '/')
                break
        
        if not img_url:
            return False, "未找到图片URL"
        
        # 下载图片
        img_headers = headers.copy()
        img_headers['Referer'] = f"https://movie.douban.com/subject/{douban_id}/"
        
        img_response = session.get(img_url, headers=img_headers, proxies=proxies, timeout=20)
        
        if img_response.status_code == 200:
            content = img_response.content
            if len(content) > 10000:
                with open(filepath, 'wb') as f:
                    f.write(content)
                return True, f"{len(content)/1024:.1f} KB"
            else:
                return False, f"图片太小 ({len(content)} bytes)"
        else:
            return False, f"图片下载失败 HTTP {img_response.status_code}"
    
    except Exception as e:
        return False, str(e)

def main():
    print("\n使用 requests 从豆瓣下载封面...")
    print("=" * 60)
    
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
        
        success, msg = download_douban_poster(movie)
        
        if success:
            print(f"    ✓ 成功 ({msg})")
            success_count += 1
        else:
            print(f"    ✗ 失败: {msg}")
            still_failed.append(movie)
        
        # 延迟避免被封
        time.sleep(3)
    
    print("\n" + "=" * 60)
    print(f"完成!")
    print(f"成功: {success_count}/{len(missing_movies)}")
    print(f"失败: {len(still_failed)}/{len(missing_movies)}")
    
    if still_failed:
        print(f"\n仍然失败的 {len(still_failed)} 部电影:")
        for m in still_failed[:20]:
            print(f"  - {m['name']} ({m['endonym']}, {m['year']})")

if __name__ == '__main__':
    main()
