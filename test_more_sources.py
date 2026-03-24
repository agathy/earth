#!/usr/bin/env python3
"""
测试更多图片来源
"""

import subprocess
import re
from pathlib import Path
from urllib.parse import quote

POSTERS_DIR = Path('/Users/bbk/Desktop/Projects/earth/assets/movie-posters')
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

movie = {
    'name': '好东西',
    'endonym': 'Her Story',
    'year': '2024',
    'file_id': '34804680'
}

filepath = POSTERS_DIR / f"{movie['file_id']}.jpg"

def curl_download(url, filepath):
    """使用curl下载文件"""
    print(f"    尝试: {url[:60]}...")
    try:
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '-H', 'Accept: image/webp,image/apng,image/*,*/*;q=0.8',
            '--connect-timeout', '30', '--max-time', '90',
            '-o', str(filepath), url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=100)
        
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 10000:
                print(f"    ✓ 成功! {size/1024:.1f} KB")
                return True
            else:
                filepath.unlink()
        return False
    except Exception as e:
        return False

def try_rotten_tomatoes():
    """烂番茄"""
    print("\n[烂番茄]...")
    try:
        search_term = quote(movie['endonym'].lower().replace(' ', '_'))
        url = f"https://www.rottentomatoes.com/m/{search_term}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"image":"(https://resizing\.flixster\.com/[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            if curl_download(img_url, filepath):
                return True, "烂番茄"
        return False, None
    except:
        return False, None

def try_metacritic():
    """Metacritic"""
    print("\n[Metacritic]...")
    try:
        search_term = quote(movie['endonym'].lower().replace(' ', '-'))
        url = f"https://www.metacritic.com/movie/{search_term}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"imageUrl":"(https://static\.metacritic\.com/[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            if curl_download(img_url, filepath):
                return True, "Metacritic"
        return False, None
    except:
        return False, None

def try_letterboxd():
    """Letterboxd"""
    print("\n[Letterboxd]...")
    try:
        search_term = quote(movie['endonym'].lower().replace(' ', '-'))
        url = f"https://letterboxd.com/film/{search_term}/"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片
        match = re.search(r'"image":"(https://a\.ltrbxd\.com/[^"]+)"', html)
        if match:
            img_url = match.group(1).replace('\\u0026', '&')
            if curl_download(img_url, filepath):
                return True, "Letterboxd"
        return False, None
    except:
        return False, None

def try_alternative_search():
    """使用Google图片搜索"""
    print("\n[Google图片搜索]...")
    try:
        search_query = quote(f"{movie['endonym']} {movie['year']} movie poster")
        url = f"https://www.google.com/search?q={search_query}&tbm=isch"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL (Google图片搜索格式)
        matches = re.findall(r'"(https://[^"]+\.(?:jpg|jpeg|png))"', html)
        for img_url in matches[:5]:  # 尝试前5个
            if 'google' not in img_url and 'gstatic' not in img_url:
                if curl_download(img_url, filepath):
                    return True, "Google图片"
        return False, None
    except:
        return False, None

def try_bing_search():
    """使用Bing图片搜索"""
    print("\n[Bing图片搜索]...")
    try:
        search_query = quote(f"{movie['endonym']} {movie['year']} movie poster")
        url = f"https://www.bing.com/images/search?q={search_query}"
        
        cmd = ['curl', '-s', '-L', '--socks5-hostname', '127.0.0.1:7897',
            '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            '--connect-timeout', '20', '--max-time', '45', url]
        
        result = subprocess.run(cmd, capture_output=True, timeout=50)
        html = result.stdout.decode('utf-8', errors='ignore')
        
        # 提取图片URL
        matches = re.findall(r'murl&quot;:&quot;(https://[^&]+\.(?:jpg|jpeg|png))&quot;', html)
        for img_url in matches[:5]:
            if curl_download(img_url, filepath):
                return True, "Bing图片"
        return False, None
    except:
        return False, None

def main():
    print("=" * 60)
    print(f"测试更多来源: {movie['name']} ({movie['endonym']}, {movie['year']})")
    print("=" * 60)
    
    methods = [
        ("烂番茄", try_rotten_tomatoes),
        ("Metacritic", try_metacritic),
        ("Letterboxd", try_letterboxd),
        ("Google图片", try_alternative_search),
        ("Bing图片", try_bing_search),
    ]
    
    for method_name, method_func in methods:
        success, source = method_func()
        if success:
            print("\n" + "=" * 60)
            print(f"✓ 成功! 来源: {source}")
            print(f"  文件: {filepath}")
            print(f"  大小: {filepath.stat().st_size/1024:.1f} KB")
            print("=" * 60)
            return
    
    print("\n" + "=" * 60)
    print("✗ 所有方法都失败")
    print("=" * 60)

if __name__ == '__main__':
    main()
