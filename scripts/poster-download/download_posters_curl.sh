#!/bin/bash
# 使用curl下载电影封面图

POSTERS_DIR="/Users/bbk/Desktop/Projects/earth/assets/movie-posters"
mkdir -p "$POSTERS_DIR"

cd "$POSTERS_DIR"

# 豆瓣电影封面URL列表 (格式: subject_id|电影名)
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
  "1291835|迷失东京"
  "1291843|黑客帝国"
  "1292226|处女之死"
  "1419936|绝代艳后"
  "1578714|神奇女侠"
  "1917161|苹果"
  "2028645|拆弹部队"
  "24733981|黄金时代"
  "26348103|小妇人"
  "26588314|伯德小姐"
  "26683723|后来的我们"
  "26877106|相爱相亲"
  "26990609|骑士"
  "27059160|脸庞，村庄"
  "30211998|燃烧女子的肖像"
  "30458949|无依之地"
  "3077668|天水围的日与夜"
  "33437152|犬之力"
  "34841067|你好，李焕英"
  "35235502|小妈妈"
  "3530403|云图"
  "36081094|热辣滚烫"
  "4195678|观音山"
  "5964718|桃姐"
)

echo "开始下载电影封面..."
echo "共 ${#movies[@]} 部电影"
echo ""

success=0
failed=0

for item in "${movies[@]}"; do
  IFS='|' read -r id name <<< "$item"
  
  echo "[$id] $name"
  
  # 尝试豆瓣图片URL
  for img_server in img9 img1 img2 img3; do
    url="https://${img_server}.doubanio.com/view/photo/s_ratio_poster/public/p${id}.jpg"
    
    curl -s -L "$url" \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
      -H "Referer: https://movie.douban.com/" \
      --connect-timeout 10 \
      --max-time 30 \
      -o "${id}.jpg"
    
    # 检查文件大小
    if [ -f "${id}.jpg" ]; then
      size=$(stat -f%z "${id}.jpg" 2>/dev/null || stat -c%s "${id}.jpg" 2>/dev/null)
      if [ "$size" -gt 5000 ]; then
        echo "  ✓ 成功 (${size} bytes)"
        success=$((success + 1))
        break
      else
        rm -f "${id}.jpg"
      fi
    fi
  done
  
  if [ ! -f "${id}.jpg" ]; then
    echo "  ✗ 失败"
    failed=$((failed + 1))
  fi
  
  sleep 1
done

echo ""
echo "========================================"
echo "下载完成!"
echo "成功: $success"
echo "失败: $failed"
