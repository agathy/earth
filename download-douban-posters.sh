#!/bin/bash
# 下载豆瓣电影封面图

POSTERS_DIR="/Users/bbk/Desktop/Projects/earth/assets/movie-posters"
mkdir -p "$POSTERS_DIR"

# 电影数据（从female-directors-movies-data.js中提取的豆瓣链接）
declare -a movies=(
  "34804680|好东西"
  "30282387|春潮"
  "34850561|妈妈！"
  "3077782|我的兄弟姐妹"
  "35158160|再见，少年"
  "36222669|出走的决心"
  "33437152|狗十三"
  "26710369|相爱相亲"
  "1308768|我和爸爸"
  "1316538|一个陌生女人的来信"
  "10741811|致我们终将逝去的青春"
  "26683723|后来的我们"
  "36081094|热辣滚烫"
  "34841067|你好，李焕英"
  "26740566|纪念品：第二部分"
  "34814907|老妇人"
  "35472642|东京贵族女子"
  "30334582|蒂尔"
  "35290372|女人们的谈话"
  "1292263|鲸骑士"
  "24754153|鬼书"
)

echo "开始下载电影封面..."
echo "共 ${#movies[@]} 部电影"
echo ""

success_count=0
failed_count=0

for movie in "${movies[@]}"; do
  IFS='|' read -r id name <<< "$movie"
  filepath="$POSTERS_DIR/$id.jpg"
  
  # 检查是否已存在
  if [ -f "$filepath" ] && [ -s "$filepath" ]; then
    echo "✓ 已存在: $name"
    continue
  fi
  
  echo "[$id] $name"
  
  # 获取豆瓣页面
  html=$(curl -s -L "https://movie.douban.com/subject/$id/" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -H "Accept: text/html,application/xhtml+xml" \
    -H "Accept-Language: zh-CN,zh;q=0.9" \
    --connect-timeout 10 \
    --max-time 30)
  
  # 提取封面图URL
  poster_url=$(echo "$html" | grep -oE 'https://img[0-9]+\.doubanio\.com/view/photo/s_ratio_poster/public/[^"]+' | head -1)
  
  if [ -z "$poster_url" ]; then
    echo "  ✗ 未找到封面URL"
    failed_count=$((failed_count + 1))
    continue
  fi
  
  echo "  下载: $poster_url"
  
  # 下载图片
  curl -s -L "$poster_url" \
    -H "User-Agent: Mozilla/5.0" \
    -H "Referer: https://movie.douban.com/" \
    --connect-timeout 10 \
    --max-time 30 \
    -o "$filepath"
  
  # 检查下载结果
  if [ -f "$filepath" ] && [ -s "$filepath" ]; then
    filesize=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null)
    if [ "$filesize" -gt 1000 ]; then
      echo "  ✓ 成功 ($filesize bytes)"
      success_count=$((success_count + 1))
    else
      echo "  ✗ 文件太小"
      rm -f "$filepath"
      failed_count=$((failed_count + 1))
    fi
  else
    echo "  ✗ 下载失败"
    failed_count=$((failed_count + 1))
  fi
  
  # 延迟，避免请求过快
  sleep 2
done

echo ""
echo "========================================"
echo "下载完成!"
echo "成功: $success_count"
echo "失败: $failed_count"
