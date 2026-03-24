#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import json

# 读取HTML文件
with open('/Users/bbk/Desktop/Projects/earth/language-explorer.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# 尝试提取原始的data-props并解析
pattern = r'(<rle-app data-props=")([^"]*)(")'
match = re.search(pattern, html_content)

if match:
    data_props = match.group(2)
    # 将HTML实体转换回字符
    data_props = data_props.replace('&quot;', '"')
    data_props = data_props.replace('&lt;', '<')
    data_props = data_props.replace('&gt;', '>')
    data_props = data_props.replace('&amp;', '&')
    
    try:
        data = json.loads(data_props)
        print("原始JSON解析成功")
        print(f"原始语言数量: {len(data.get('languages', []))}")
        
        # 只修改标题和描述
        if 'strings' in data:
            data['strings']['site_title'] = '女性导演电影探索'
            data['strings']['site_description'] = '探索全球女性导演的电影作品'
            data['strings']['world_overview_title'] = '探索女性导演的电影世界'
            data['strings']['world_overview_description'] = '<p>从贾玲到Greta Gerwig，从商业大片到独立艺术电影，发现全球女性导演的精彩作品</p>'
            
            # 修改其他相关字符串
            if 'number_of_speakers_title' in data['strings']:
                data['strings']['number_of_speakers_title'] = '票房'
            if 'endonym_title' in data['strings']:
                data['strings']['endonym_title'] = '原名'
            if 'scripts_title' in data['strings']:
                data['strings']['scripts_title'] = '类型'
            if 'languages' in data['strings']:
                data['strings']['languages'] = '电影'
        
        # 重新编码为JSON
        new_data_json = json.dumps(data, ensure_ascii=False)
        new_data_escaped = new_data_json.replace('&', '&amp;')
        new_data_escaped = new_data_escaped.replace('<', '&lt;')
        new_data_escaped = new_data_escaped.replace('>', '&gt;')
        new_data_escaped = new_data_escaped.replace('"', '&quot;')
        
        # 替换原始内容
        new_html = html_content[:match.start()] + '<rle-app data-props="' + new_data_escaped + '"' + html_content[match.end():]
        
        # 保存修改后的HTML
        with open('/Users/bbk/Desktop/Projects/earth/language-explorer.html', 'w', encoding='utf-8') as f:
            f.write(new_html)
        
        print("修改完成！只修改了标题，保留了原始数据结构")
        
    except json.JSONDecodeError as e:
        print(f"JSON解析错误: {e}")
else:
    print("未找到data-props属性")
