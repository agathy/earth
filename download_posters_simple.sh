#!/bin/bash
# 简单下载电影封面图 - 使用占位图服务

POSTERS_DIR="/Users/bbk/Desktop/Projects/earth/assets/movie-posters"
mkdir -p "$POSTERS_DIR"

cd "$POSTERS_DIR"

# 电影列表 (豆瓣ID|电影名|英文名)
declare -a movies=(
  "34804680|好东西|Her Story"
  "30282387|春潮|Spring Tide"
  "34850561|妈妈！|Song of Spring"
  "35158160|再见，少年|Farewell My Lad"
  "36222669|出走的决心|Like a Rolling Stone"
  "33437152|狗十三|Einstein and Einstein"
  "26710369|相爱相亲|Love Education"
  "36081094|热辣滚烫|YOLO"
  "34841067|你好，李焕英|Hi Mom"
  "35472642|东京贵族女子|Tokyo Noble Girl"
)

echo "开始下载电影封面..."
echo ""

for item in "${movies[@]}"; do
  IFS='|' read -r id name en_name <<< "$item"
  
  echo "[$id] $name ($en_name)"
  
  # 使用 placeholder.com 生成占位图
  # 格式: https://via.placeholder.com/300x450.png?text=电影名
  encoded_name=$(echo "$name" | sed 's/ /+/g')
  url="https://via.placeholder.com/300x450.png?text=${encoded_name}"
  
  curl -s -L "$url" \
    --connect-timeout 10 \
    --max-time 30 \
    -o "${id}.jpg"
  
  if [ -f "${id}.jpg" ] && [ -s "${id}.jpg" ]; then
    size=$(stat -f%z "${id}.jpg" 2>/dev/null || stat -c%s "${id}.jpg" 2>/dev/null)
    echo "  ✓ 成功 (${size} bytes)"
  else
    echo "  ✗ 失败"
  fi
  
  sleep 1
done

echo ""
echo "完成!"
