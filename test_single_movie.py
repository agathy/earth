#!/usr/bin/env python3
"""
测试单部电影封面下载 - 使用《好东西》作为测试
"""

import subprocess
import re
from pathlib import Path
from urllib.parse import quote

POSTERS_DIR = Path('/Users/bbk/Desktop/Projects/earth/assets/movie-posters')
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

# 测试电影信息
movie = {
    'name': '好东西',
    'endonym': 'Her Story',
    'year': '2024',
    'douban_id': '34804680',
    'imdb_id': None,
    'file_id': '34804680'
}

filepath = POSTERS_DIR / f"{movie['file_id']}.jpg"

def curl_download(url, filepath, use_proxy=True, referer=None):
    """使用curl下载文件"""
    print(f"    下载: {url[:70]}...")
    try:
        cmd = ['curl', '-s', '-L', '--http1.1',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '--connect-timeout', '30', '--max-time', '90',
            '-o', str(filepath)]
        
        if use_proxy:
            cmd.extend(['--socks5-hostname', '127.0.0.1:7897'])
        
        if referer:
            cmd.extend(['-H', f'Referer: {referer}'])
        
        cmd.append(url)
        result = subprocess.run(cmd, capture_output=True, timeout=100)
        
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 10000:
                print(f"    ✓ 成功! 文件大小: {size/1024:.1f} KB")
                return True
            else:
                print(f"    ✗ 文件太小: {size} bytes")
                filepath.unlink()
                return False
        print(f"    ✗ 文件未创建")
        return False
    except Exception as e:
        print(f"    ✗ 错误: {e}")
        return False

def try_douban_direct():
    """方法1: 直接尝试豆瓣图片URL"""
    print("\n[方法1] 豆瓣直接图片URL...")
    urls = [
        f"https://img9.doubanio.com/view/photo/s_ratio_poster/public/p{movie['douban_id']}.jpg",
        f"https://img1.doubanio.com/view/photo/s_ratio_poster/public/p{movie['douban_id']}.jpg",
        f"https://img2.doubanio.com/view/photo/s_ratio_poster/public/p{movie['douban_id']}.jpg",
    ]
    for url in urls:
        if curl_download(url, filepath, referer="https://movie.douban.com/"):
            return True, "豆瓣直接"
    return False, None

def try_douban_page():
    """方法2: 从豆瓣页面提取图片URL"""
    print("\n[方法2] 豆瓣页面提取...")
    try:
        url = f"https://movie.douban.com/subject/{movie['douban_id']}/"
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        patterns = [
            r'data-pic="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"',
            r'<img[^>]*src="(https://img\d+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+)"[^>]*rel="v:image">',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html)
            if match:
                img_url = match.group(1)
                print(f"    找到图片URL: {img_url}")
                if curl_download(img_url, filepath, referer="https://movie.douban.com/"):
                    return True, "豆瓣页面"
        print("    未找到图片URL")
        return False, None
    except Exception as e:
        print(f"    错误: {e}")
        return False, None

def try_wikipedia():
    """方法3: Wikipedia"""
    print("\n[方法3] Wikipedia...")
    try:
        search_term = quote(movie['endonym'].replace(' ', '_'))
        wiki_url = f"https://en.wikipedia.org/wiki/{search_term}_(2024_film)"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', wiki_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取infobox图片
        match = re.search(r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"', html)
        if match:
            img_url = 'https:' + match.group(1)
            if curl_download(img_url, filepath):
                return True, "Wikipedia"
        
        # 尝试不带年份
        wiki_url = f"https://en.wikipedia.org/wiki/{search_term}_(film)"
        result = subprocess.run(cmd[:-1] + [wiki_url], capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        match = re.search(r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/[^"]+)"[^>]*class="[^"]*infobox[^"]*"', html)
        if match:
            img_url = 'https:' + match.group(1)
            if curl_download(img_url, filepath):
                return True, "Wikipedia"
        
        print("    未找到Wikipedia图片")
        return False, None
    except Exception as e:
        print(f"    错误: {e}")
        return False, None

def try_wikimedia_commons():
    """方法4: Wikimedia Commons"""
    print("\n[方法4] Wikimedia Commons...")
    try:
        search_term = quote(f"{movie['endonym']} 2024 film poster")
        search_url = f"https://commons.wikimedia.org/w/index.php?search={search_term}&title=Special:MediaSearch&type=image"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', search_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取第一张图片
        match = re.search(r'src="(//upload\.wikimedia\.org/wikipedia/commons/thumb/[^"]+)"', html)
        if match:
            img_url = 'https:' + match.group(1)
            if curl_download(img_url, filepath):
                return True, "Wikimedia Commons"
        
        print("    未找到Wikimedia图片")
        return False, None
    except Exception as e:
        print(f"    错误: {e}")
        return False, None

def try_tmdb():
    """方法5: TMDB"""
    print("\n[方法5] TMDB API...")
    try:
        import json
        search_url = f"https://api.themoviedb.org/3/search/movie?query={quote(movie['endonym'])}&year={movie['year']}&language=en-US"
        
        cmd = ['curl', '-s', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', search_url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        
        try:
            data = json.loads(result.stdout.decode('utf-8'))
        except:
            print("    API返回无效JSON")
            return False, None
        
        if data.get('results') and len(data['results']) > 0:
            poster_path = data['results'][0].get('poster_path')
            if poster_path:
                img_url = f"https://image.tmdb.org/t/p/w500{poster_path}"
                if curl_download(img_url, filepath):
                    return True, "TMDB"
        
        print("    未找到TMDB图片")
        return False, None
    except Exception as e:
        print(f"    错误: {e}")
        return False, None

def main():
    print("=" * 60)
    print(f"测试下载: {movie['name']} ({movie['endonym']}, {movie['year']})")
    print("=" * 60)
    
    # 尝试各种方法
    methods = [
        ("豆瓣直接URL", try_douban_direct),
        ("豆瓣页面", try_douban_page),
        ("Wikipedia", try_wikipedia),
        ("Wikimedia Commons", try_wikimedia_commons),
        ("TMDB", try_tmdb),
    ]
    
    for method_name, method_func in methods:
        success, source = method_func()
        if success:
            print("\n" + "=" * 60)
            print(f"✓ 成功! 来源: {source}")
            print(f"  电影: {movie['name']}")
            print(f"  文件: {filepath}")
            print(f"  大小: {filepath.stat().st_size/1024:.1f} KB")
            print("=" * 60)
            return
    
    print("\n" + "=" * 60)
    print("✗ 所有方法都失败")
    print("=" * 60)

if __name__ == '__main__':
    main()
