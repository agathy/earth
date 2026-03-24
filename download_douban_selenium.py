#!/usr/bin/env python3
"""
使用 Selenium 模拟浏览器访问豆瓣下载封面图
"""

import re
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

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

def create_driver():
    """创建Chrome浏览器实例"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # 设置代理
    chrome_options.add_argument('--proxy-server=socks5://127.0.0.1:7897')
    
    driver = webdriver.Chrome(options=chrome_options)
    return driver

def download_douban_poster(movie, driver):
    """从豆瓣下载封面图"""
    douban_id = extract_douban_id(movie['link'])
    if not douban_id:
        return False, "无豆瓣ID"
    
    filepath = POSTERS_DIR / f"{movie['id']}.jpg"
    
    try:
        # 访问豆瓣电影页面
        url = f"https://movie.douban.com/subject/{douban_id}/"
        driver.get(url)
        
        # 等待图片加载
        wait = WebDriverWait(driver, 10)
        img_element = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'img[src*="doubanio.com/view/photo/s_ratio_poster/public/"]'))
        )
        
        # 获取图片URL
        img_url = img_element.get_attribute('src')
        
        if img_url:
            # 下载图片
            driver.get(img_url)
            
            # 获取图片数据
            canvas = driver.execute_script("""
                var img = document.querySelector('img');
                if (img) {
                    var canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    return canvas.toDataURL('image/jpeg').split(',')[1];
                }
                return null;
            """)
            
            if canvas:
                import base64
                image_data = base64.b64decode(canvas)
                if len(image_data) > 10000:
                    with open(filepath, 'wb') as f:
                        f.write(image_data)
                    return True, f"{len(image_data)/1024:.1f} KB"
        
        return False, "未找到图片"
    except Exception as e:
        return False, str(e)

def main():
    print("\n使用 Selenium 从豆瓣下载封面...")
    print("=" * 60)
    
    try:
        driver = create_driver()
        
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
            
            success, msg = download_douban_poster(movie, driver)
            
            if success:
                print(f"    ✓ 成功 ({msg})")
                success_count += 1
            else:
                print(f"    ✗ 失败: {msg}")
                still_failed.append(movie)
            
            # 延迟避免被封
            time.sleep(2)
        
        driver.quit()
    except Exception as e:
        print(f"Selenium错误: {e}")
        return
    
    print("\n" + "=" * 60)
    print(f"完成!")
    print(f"成功: {success_count}/{len(missing_movies)}")
    print(f"失败: {len(still_failed)}/{len(missing_movies)}")

if __name__ == '__main__':
    main()
