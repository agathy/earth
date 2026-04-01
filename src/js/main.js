// ===== 主初始化模块 =====
// 导入核心3D模块，然后初始化地球应用

  import './my-particle-globe.js';
  import './my-atmosphere.js';
  import './my-bloom-effect.js';
  import './my-globe-app.js';

// module 是 defer 的，load 事件可能已触发，用 requestAnimationFrame 确保 DOM 就绪
requestAnimationFrame(function () {
  // 启动 Globe
  var canvas = document.getElementById('globe-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  var app = new GlobeApp({ canvas: canvas });
  window.globeApp = app; // 暴露到全局作用域，供统计函数使用
  app.start();

  // 默认贴图设置已移到文件上传相关代码块中，确保变量已声明

  // 加载电影海报到地球上
  if (window.femaleDirectorsMovies && window.femaleDirectorsMovies.length > 0) {
    // 延迟加载海报，确保地球和国家数据完全初始化
    setTimeout(function() {
      console.log('开始加载电影海报...');
      app.setMoviePosters(window.femaleDirectorsMovies);
      // 更新统计数据
      updateStats();
      
      // 海报加载完成后，立即应用当前时间轴的筛选
      // 获取当前时间轴的年份范围并触发筛选
      const timelineEvent = new CustomEvent('applyTimelineFilter', {
        detail: { app: app }
      });
      window.dispatchEvent(timelineEvent);
    }, 2000);
  }

  // 数字滚动动画函数
  function animateNumber(element, targetValue, duration) {
    if (!element) {
      console.log('[animateNumber] 元素为空');
      return;
    }
    // 取消该元素正在进行的动画
    if (element._animationFrame) {
      cancelAnimationFrame(element._animationFrame);
    }
    var startValue = parseInt(element.textContent) || 0;
    var startTime = null;
    
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      
      // 使用 easeOutCubic 缓动
      var easeProgress = 1 - Math.pow(1 - progress, 3);
      var currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        element._animationFrame = requestAnimationFrame(step);
      } else {
        element.textContent = targetValue;
        element._animationFrame = null;
      }
    }
    
    element._animationFrame = requestAnimationFrame(step);
  }
  
  // 更新统计数据的函数
  // filteredMovies: 可选，传入筛选后的电影数组，用于时间轴筛选时更新统计
  function updateStats(filteredMovies) {
    if (!window.femaleDirectorsMovies) return;
    
    // 使用传入的筛选后电影数组，或默认使用全部电影
    var movies = filteredMovies || window.femaleDirectorsMovies;
    var totalMovies = movies.length;
    
    // 统计导演数（基于筛选后的电影）
    var directors = new Set();
    movies.forEach(function(m) {
      if (m.director) directors.add(m.director);
    });
    var totalDirectors = directors.size;
    
    // 保存全局统计数据
    globalTotalMovies = totalMovies;
    globalTotalDirectors = totalDirectors;
    
    // 更新左侧统计（带动画）
    animateNumber(document.getElementById('total-movies'), totalMovies, 1500);
    animateNumber(document.getElementById('total-directors'), totalDirectors, 1500);
    
    // 更新右侧统计（已看数）- 传入筛选后的电影
    setTimeout(function() {
      updateWatchedStats(filteredMovies);
    }, 500);
  }
  // 暴露到全局作用域
  window.updateStats = updateStats;
  
  // 更新已看统计
  // filteredMovies: 可选，传入筛选后的电影数组
  function updateWatchedStats(filteredMovies) {
    if (!window.femaleDirectorsMovies) return;
    
    // 使用传入的筛选后电影数组，或默认使用全部电影
    var movies = filteredMovies || window.femaleDirectorsMovies;
    var totalMovies = movies.length;
    
    // 计算已看数量（基于筛选后的电影）
    var watchedCount = 0;
    var globeApp = window.globeApp;
    movies.forEach(function(movie) {
      var movieId = movie.id || (movie.name || movie.title || '').replace(/\s+/g, '_');
      var isWatched = false;
      
      // 检查 globeApp 的已看记录
      if (globeApp && globeApp._shouldShowAsWatched && globeApp._shouldShowAsWatched(movie.id)) {
        isWatched = true;
      }
      
      // 检查 localStorage 中的已看记录（toggleWatched 使用的格式）
      if (!isWatched && localStorage.getItem('watched_' + movieId) === 'true') {
        isWatched = true;
      }
      
      if (isWatched) {
        watchedCount++;
      }
    });
    
    var ratio = totalMovies > 0 ? Math.round((watchedCount / totalMovies) * 100) : 0;
    
    // 带动画更新
    animateNumber(document.getElementById('watched-count'), watchedCount, 1000);
    
    // 百分比也做动画
    var ratioElement = document.getElementById('watched-ratio');
    if (!ratioElement) return;
    
    var startRatio = 0;
    var startTime = null;
    var duration = 1000;
    
    function animateRatio(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var easeProgress = 1 - Math.pow(1 - progress, 3);
      var currentRatio = Math.floor(startRatio + (ratio - startRatio) * easeProgress);
      ratioElement.textContent = currentRatio + '%';
      
      if (progress < 1) {
        requestAnimationFrame(animateRatio);
      } else {
        ratioElement.textContent = ratio + '%';
      }
    }
    requestAnimationFrame(animateRatio);
  }
  // 暴露到全局作用域
  window.updateWatchedStats = updateWatchedStats;
  
  // 监听已看比例变化
  window.addEventListener('watched-ratio-change', function() {
    setTimeout(function() {
      // 使用当前筛选后的电影，如果没有则使用全部
      updateWatchedStats(window.currentFilteredMovies);
    }, 100);
  });
  window.addEventListener('refresh-random-seed', function() {
    setTimeout(function() {
      updateWatchedStats(window.currentFilteredMovies);
    }, 100);
  });

  // 同步代码执行完成后立即应用配置（0ms = 当前脚本执行完即触发，GlobeApp 必然已就绪）
  setTimeout(function() {
    var config = loadConfig();
    applyConfig(config);
    console.log('配置已应用');
  }, 0);

  // 国家悬停标签 - 显示在屏幕中间固定位置
  var labelEl = document.getElementById('globe-country-label');
  var currentCountryName = '';

  // 监听国家变化
  new MutationObserver(function () {
    currentCountryName = document.body.getAttribute('globe-hover-country') || '';
    labelEl.textContent = currentCountryName;
    if (currentCountryName) {
      labelEl.style.display = 'block';
    } else {
      labelEl.style.display = 'none';
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['globe-hover-country'] });

  // 信息面板（已弃用，保留兼容）
  var panel       = document.getElementById('info-panel');
  var panelCountry = document.getElementById('panel-country');
  var statMovies  = document.getElementById('stat-movies');
  var statDirectors = document.getElementById('stat-directors');
  var statWatched = document.getElementById('stat-watched');
  var directorList = document.getElementById('director-list');
  var moviesList  = document.getElementById('movies-list');
  
  // 新的两侧面板元素
  var selectedCountryLabel = document.getElementById('selected-country-label');
  var moviesLabel = document.getElementById('movies-label');
  var directorsLabel = document.getElementById('directors-label');
  var totalMoviesEl = document.getElementById('total-movies');
  var totalDirectorsEl = document.getElementById('total-directors');
  var countryListsSection = document.getElementById('country-lists-section');
  var directorMoviesList = document.getElementById('director-movies-list');
  
  // 保存全局统计数据
  var globalTotalMovies = 0;
  var globalTotalDirectors = 0;

  // 海报详情卡片
  var movieCardOverlay = document.getElementById('movie-card-overlay');
  var movieCard = document.getElementById('movie-card');
  // 暴露到window对象，供外部调用
  window.movieCard = movieCard;
  var movieCardImg = document.getElementById('movie-card-img');
  var movieCardTitle = document.getElementById('movie-card-title');
  var movieCardRating = document.getElementById('movie-card-rating');
  var movieCardYear = document.getElementById('movie-card-year');
  var movieCardDirector = document.getElementById('movie-card-director');
  var movieCardCountry = document.getElementById('movie-card-country');

  // 用于防止闪烁的定时器
  var movieCardShowTimer = null;
  var movieCardHideTimer = null;
  var isMovieCardVisible = false;

  // 当前显示的电影数据（用于点击展开）
  var currentMovieCardData = null;
  var isMovieCardExpanded = false;

  // 显示海报卡片
  window.showMovieCard = function(movie, x, y) {
    if (!movie) return;

    // 清除隐藏定时器
    if (movieCardHideTimer) {
      clearTimeout(movieCardHideTimer);
      movieCardHideTimer = null;
    }

    // 如果已经展开，不响应hover
    if (isMovieCardExpanded) return;

    // 保存当前电影数据
    currentMovieCardData = movie;

    // 填充数据（每次都更新，实现跟随效果）
    movieCardImg.src = movie.poster || '';
    movieCardTitle.textContent = movie.name || movie.title || '';
    movieCardRating.textContent = '★ ' + (movie.rating || 'N/A');
    movieCardYear.textContent = movie.year || '';
    movieCardDirector.textContent = '导演: ' + (movie.director || '');
    movieCardCountry.textContent = movie.countries_regions ? movie.countries_regions.join(', ') : '';

    // 显示卡片
    movieCardOverlay.style.display = 'block';

    // 计算位置 - 卡片显示在海报下方
    var cardWidth = 200;
    var cardHeight = 320;
    var padding = 20;

    // 水平居中于海报
    var left = x - cardWidth / 2;
    // 显示在海报下方
    var top = y + padding;

    // 右边界检查
    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }
    // 左边界检查
    if (left < padding) {
      left = padding;
    }
    // 下边界检查
    if (top + cardHeight > window.innerHeight - padding) {
      // 如果下方空间不够，显示在海报上方
      top = y - cardHeight - padding;
    }

    movieCard.style.left = left + 'px';
    movieCard.style.top = top + 'px';

    // 触发动画（只在第一次显示时）
    if (!isMovieCardVisible) {
      requestAnimationFrame(function() {
        movieCard.style.transform = 'scale(1)';
        movieCard.style.opacity = '1';
      });
    }
    isMovieCardVisible = true;
    isMovieCardExpanded = false;
  };

  // 隐藏海报卡片
  window.hideMovieCard = function() {
    console.log('[Hide] 调用 hideMovieCard, isMovieCardExpanded:', isMovieCardExpanded);
    // 如果已经展开，不隐藏
    if (isMovieCardExpanded) {
      console.log('[Hide] 卡片已展开，不隐藏');
      return;
    }
    
    // 清除显示定时器
    if (movieCardShowTimer) {
      clearTimeout(movieCardShowTimer);
      movieCardShowTimer = null;
    }

    // 立即隐藏（不延迟，以便快速切换到其他海报）
    console.log('[Hide] 执行隐藏动画');
    movieCard.style.transform = 'scale(0.9)';
    movieCard.style.opacity = '0';
    isMovieCardVisible = false;
    
    // 动画完成后隐藏并重置样式
    setTimeout(function() {
      movieCardOverlay.style.display = 'none';
      
      // 重置卡片样式为初始状态
      movieCard.style.width = '200px';
      movieCard.style.display = 'block';
      movieCard.style.flexDirection = 'column';
      movieCard.style.padding = '16px';
      movieCard.style.boxShadow = '';
      movieCard.style.left = '';
      movieCard.style.top = '';
      movieCard.style.transformStyle = '';
      
      // 重置海报样式
      var posterDiv = document.getElementById('movie-card-poster');
      if (posterDiv) {
        posterDiv.style.width = '100%';
        posterDiv.style.flexShrink = '1';
        posterDiv.style.marginBottom = '12px';
        posterDiv.style.marginRight = '0';
      }
      
      // 重置info样式
      var infoDiv = document.getElementById('movie-card-info');
      if (infoDiv) {
        infoDiv.style.flex = 'none';
      }
      
      // 隐藏简介
      var introDiv = document.getElementById('movie-card-intro');
      if (introDiv) {
        introDiv.style.display = 'none';
        introDiv.style.opacity = '0';
      }
      
      // 重置遮罩
      movieCardOverlay.style.background = 'transparent';
      movieCardOverlay.style.backdropFilter = 'none';
      movieCardOverlay.style.pointerEvents = 'none';
      movieCardOverlay.style.perspective = '';
    }, 200);
  };

  // 鼠标进入卡片时取消隐藏
  movieCard.addEventListener('mouseenter', function() {
    if (movieCardHideTimer) {
      clearTimeout(movieCardHideTimer);
      movieCardHideTimer = null;
    }
  });

  // 鼠标离开卡片时延迟隐藏（只有在未展开状态下）
  movieCard.addEventListener('mouseleave', function() {
    if (!isMovieCardExpanded) {
      // 增加延迟，避免地球旋转时闪烁
      movieCardHideTimer = setTimeout(function() {
        window.hideMovieCard();
      }, 300);
    }
  });

  // 点击卡片展开到中间
  movieCard.addEventListener('click', function(e) {
    e.stopPropagation();
    console.log('[Tooltip Click] tooltip被点击, isMovieCardExpanded:', isMovieCardExpanded, 'currentMovieCardData:', currentMovieCardData);
    if (!isMovieCardExpanded && currentMovieCardData) {
      console.log('[Tooltip Click] 调用 expandMovieCardToCenter');
      expandMovieCardToCenter(currentMovieCardData);
    } else {
      console.log('[Tooltip Click] 条件不满足，不展开');
    }
  });

  // 点击遮罩关闭（只有在未展开状态下）
  movieCardOverlay.addEventListener('click', function(e) {
    if (e.target === movieCardOverlay) {
      if (isMovieCardExpanded) {
        collapseMovieCard();
      } else {
        window.hideMovieCard();
      }
    }
  });

  // 保存tooltip原始位置（用于关闭时的回溯动画）
  var movieCardOriginalRect = null;

  // 展开卡片到屏幕中间
  // 新策略：直接动画 #movie-detail-modal 内容，从 tooltip 位置展开
  // 使用纯 CSS left/top/width/height transition，彻底避免 FLIP 的 transform-origin 问题
  function expandMovieCardToCenter(movie) {
    isMovieCardExpanded = true;

    if (movieCardHideTimer) { clearTimeout(movieCardHideTimer); movieCardHideTimer = null; }

    // 记录 tooltip 当前位置（用于展开起点 & 关闭回溯）
    movieCardOriginalRect = movieCard.getBoundingClientRect();

    // 填充 modal 内容
    document.getElementById('movie-detail-poster').src = movie.poster || '';
    // 先设置标题文本（无动画）
    var titleText = movie.name || movie.title || '';
    var titleEl = document.getElementById('movie-detail-title');
    titleEl.textContent = titleText;
    
    document.getElementById('movie-detail-rating').textContent = movie.rating ? '★ ' + movie.rating : '';
    document.getElementById('movie-detail-year').textContent = movie.year || '';
    document.getElementById('movie-detail-intro').textContent = movie.intro || movie.description || '暂无简介';

    // 填充导演和国家信息
    var directorEl = document.getElementById('movie-detail-director');
    var countryEl = document.getElementById('movie-detail-country');
    var directorText = movie.director || '';
    var countryText = movie.countries_regions ? movie.countries_regions.join('、') : '';
    directorEl.textContent = directorText ? '导演: ' + directorText : '';
    countryEl.textContent = countryText ? '国家/地区: ' + countryText : '';

    // 填充标签
    var genresContainer = document.getElementById('movie-detail-genres');
    genresContainer.innerHTML = '';
    if (movie.scripts && movie.scripts.length > 0) {
      movie.scripts.forEach(function(genre) {
        var tag = document.createElement('span');
        tag.textContent = genre;
        tag.style.cssText = 'padding:3px 10px;background:rgba(255,255,255,0.08);border-radius:4px;font-size:12px;color:rgba(255,255,255,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-weight:400;letter-spacing:0.02em;';
        genresContainer.appendChild(tag);
      });
    }

    var modal = document.getElementById('movie-detail-modal');
    var content = document.getElementById('movie-detail-content');
    var right = document.getElementById('movie-detail-right');

    // 右侧面板先隐藏（展开完成后再淡入）
    right.style.transition = 'none';
    right.style.opacity = '0';

    // 计算展开后的居中像素坐标
    var expandedW = Math.min(680, window.innerWidth - 48);
    var expandedH = Math.min(380, window.innerHeight - 80);
    var finalLeft = Math.round((window.innerWidth - expandedW) / 2);
    var finalTop  = Math.round((window.innerHeight - expandedH) / 2);

    // 将 content 瞬间设置到 tooltip 的位置/尺寸（无过渡）
    content.style.transition = 'none';
    content.style.transform  = 'none';
    content.style.left        = movieCardOriginalRect.left   + 'px';
    content.style.top         = movieCardOriginalRect.top    + 'px';
    content.style.width       = movieCardOriginalRect.width  + 'px';
    content.style.height      = movieCardOriginalRect.height + 'px';
    content.style.borderRadius = '16px';
    content.style.opacity     = '1';

    // 显示遮罩层（先透明）
    modal.style.display    = 'block';
    modal.style.opacity    = '0';
    modal.style.transition = 'none';

    // tooltip 同步淡出
    movieCard.style.transition = 'opacity 0.15s ease';
    movieCard.style.opacity    = '0';
    isMovieCardVisible = false;

    // 强制 reflow，让上面的 none-transition 状态生效
    content.offsetHeight;

    // 开启 CSS transition，动画到展开状态
    var ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
    content.style.transition = [
      'left 0.48s '   + ease,
      'top 0.48s '    + ease,
      'width 0.48s '  + ease,
      'height 0.42s ' + ease,
      'border-radius 0.4s ease',
    ].join(', ');
    modal.style.transition = 'opacity 0.3s ease';

    requestAnimationFrame(function() {
      content.style.left         = finalLeft   + 'px';
      content.style.top          = finalTop    + 'px';
      content.style.width        = expandedW   + 'px';
      content.style.height       = expandedH   + 'px';
      content.style.borderRadius = '20px';
      modal.style.opacity        = '1';

      // 弹窗显示后开始标题字符动画
      setTimeout(function() {
        var titleEl = document.getElementById('movie-detail-title');
        var titleText = titleEl.textContent;
        titleEl.innerHTML = Array.from(titleText).map(function(char, i) {
          return '<span class="char" style="animation-delay: ' + (i * 0.04) + 's">' + (char === ' ' ? '\u00A0' : char) + '</span>';
        }).join('');
      }, 100);

      // 展开完成后淡入右侧详情面板
      setTimeout(function() {
        right.style.transition = 'opacity 0.3s ease';
        right.style.opacity    = '1';
      }, 370);
    });
  }

  // 收起卡片（点击遮罩时调用）
  function collapseMovieCard() {
    closeMovieDetailModal();
  }

  // 国家代码到国家名称的映射
  var countryCodeToName = {
    'cn': '中国', 'us': '美国', 'gb': '英国', 'fr': '法国', 'de': '德国',
    'jp': '日本', 'kr': '韩国', 'in': '印度', 'it': '意大利', 'es': '西班牙',
    'ru': '俄罗斯', 'br': '巴西', 'ca': '加拿大', 'au': '澳大利亚', 'mx': '墨西哥',
    'ar': '阿根廷', 'za': '南非', 'eg': '埃及', 'ng': '尼日利亚', 'ke': '肯尼亚',
    'id': '印度尼西亚', 'th': '泰国', 'vn': '越南', 'ph': '菲律宾', 'my': '马来西亚',
    'tr': '土耳其', 'ir': '伊朗', 'sa': '沙特阿拉伯', 'il': '以色列', 'pk': '巴基斯坦',
    'bd': '孟加拉国', 'pl': '波兰', 'ua': '乌克兰', 'se': '瑞典', 'no': '挪威',
    'dk': '丹麦', 'fi': '芬兰', 'nl': '荷兰', 'be': '比利时', 'ch': '瑞士',
    'at': '奥地利', 'cz': '捷克', 'hu': '匈牙利', 'ro': '罗马尼亚', 'gr': '希腊',
    'pt': '葡萄牙', 'ie': '爱尔兰', 'nz': '新西兰', 'sg': '新加坡', 'hk': '香港'
  };

  // 反向映射：国家名称到代码
  var countryNameToCode = {};
  for (var code in countryCodeToName) {
    countryNameToCode[countryCodeToName[code]] = code;
  }

  // 英文国家名称到中文的映射
  var countryNameEnToCn = {
    'aruba': '阿鲁巴', 'afghanistan': '阿富汗', 'angola': '安哥拉', 'anguilla': '安圭拉',
    'albania': '阿尔巴尼亚', 'aland': '奥兰', 'andorra': '安道尔', 'united arab emirates': '阿联酋',
    'argentina': '阿根廷', 'armenia': '亚美尼亚', 'american samoa': '美属萨摩亚', 'antarctica': '南极洲',
    'ashmore and cartier islands': '阿什莫尔和卡捷岛', 'french southern and antarctic lands': '法属南部领地',
    'antigua and barbuda': '安提瓜和巴布达', 'australia': '澳大利亚', 'austria': '奥地利', 'azerbaijan': '阿塞拜疆',
    'burundi': '布隆迪', 'belgium': '比利时', 'benin': '贝宁', 'burkina faso': '布基纳法索',
    'bangladesh': '孟加拉国', 'bulgaria': '保加利亚', 'bahrain': '巴林', 'bahamas': '巴哈马',
    'bosnia and herzegovina': '波黑', 'belarus': '白俄罗斯', 'belize': '伯利兹', 'bermuda': '百慕大',
    'bolivia': '玻利维亚', 'brazil': '巴西', 'barbados': '巴巴多斯', 'brunei': '文莱',
    'bhutan': '不丹', 'botswana': '博茨瓦纳', 'central african republic': '中非', 'canada': '加拿大',
    'switzerland': '瑞士', 'chile': '智利', 'china': '中国', 'ivory coast': '科特迪瓦',
    'cameroon': '喀麦隆', 'democratic republic of the congo': '刚果（金）', 'republic of the congo': '刚果（布）',
    'cook islands': '库克群岛', 'colombia': '哥伦比亚', 'comoros': '科摩罗', 'cape verde': '佛得角',
    'costa rica': '哥斯达黎加', 'cuba': '古巴', 'curacao': '库拉索', 'cayman islands': '开曼群岛',
    'northern cyprus': '北塞浦路斯', 'cyprus': '塞浦路斯', 'czech republic': '捷克', 'germany': '德国',
    'djibouti': '吉布提', 'dominica': '多米尼克', 'denmark': '丹麦', 'dominican republic': '多米尼加',
    'algeria': '阿尔及利亚', 'ecuador': '厄瓜多尔', 'egypt': '埃及', 'eritrea': '厄立特里亚',
    'spain': '西班牙', 'estonia': '爱沙尼亚', 'ethiopia': '埃塞俄比亚', 'finland': '芬兰',
    'fiji': '斐济', 'falkland islands': '福克兰群岛', 'france': '法国', 'faroe islands': '法罗群岛',
    'micronesia': '密克罗尼西亚', 'gabon': '加蓬', 'united kingdom': '英国', 'georgia': '格鲁吉亚',
    'guernsey': '根西岛', 'ghana': '加纳', 'guinea': '几内亚', 'gambia': '冈比亚',
    'guinea bissau': '几内亚比绍', 'equatorial guinea': '赤道几内亚', 'greece': '希腊', 'grenada': '格林纳达',
    'greenland': '格陵兰', 'guatemala': '危地马拉', 'guam': '关岛', 'guyana': '圭亚那',
    'hong kong': '香港', 'honduras': '洪都拉斯', 'croatia': '克罗地亚', 'haiti': '海地',
    'hungary': '匈牙利', 'indonesia': '印度尼西亚', 'isle of man': '马恩岛', 'india': '印度',
    'ireland': '爱尔兰', 'iran': '伊朗', 'iraq': '伊拉克', 'iceland': '冰岛',
    'israel': '以色列', 'italy': '意大利', 'jamaica': '牙买加', 'jersey': '泽西岛',
    'jordan': '约旦', 'japan': '日本', 'kazakhstan': '哈萨克斯坦', 'kenya': '肯尼亚',
    'kyrgyzstan': '吉尔吉斯斯坦', 'cambodia': '柬埔寨', 'kiribati': '基里巴斯', 'saint kitts and nevis': '圣基茨和尼维斯',
    'south korea': '韩国', 'kosovo': '科索沃', 'kuwait': '科威特', 'laos': '老挝',
    'lebanon': '黎巴嫩', 'liberia': '利比里亚', 'libya': '利比亚', 'saint lucia': '圣卢西亚',
    'liechtenstein': '列支敦士登', 'sri lanka': '斯里兰卡', 'lesotho': '莱索托', 'lithuania': '立陶宛',
    'luxembourg': '卢森堡', 'latvia': '拉脱维亚', 'morocco': '摩洛哥', 'monaco': '摩纳哥',
    'moldova': '摩尔多瓦', 'madagascar': '马达加斯加', 'maldives': '马尔代夫', 'mexico': '墨西哥',
    'marshall islands': '马绍尔群岛', 'north macedonia': '北马其顿', 'mali': '马里', 'malta': '马耳他',
    'myanmar': '缅甸', 'montenegro': '黑山', 'mongolia': '蒙古', 'mozambique': '莫桑比克',
    'mauritania': '毛里塔尼亚', 'mauritius': '毛里求斯', 'malawi': '马拉维', 'malaysia': '马来西亚',
    'namibia': '纳米比亚', 'new caledonia': '新喀里多尼亚', 'niger': '尼日尔', 'nigeria': '尼日利亚',
    'nicaragua': '尼加拉瓜', 'niue': '纽埃', 'netherlands': '荷兰', 'norway': '挪威',
    'nepal': '尼泊尔', 'nauru': '瑙鲁', 'new zealand': '新西兰', 'oman': '阿曼',
    'pakistan': '巴基斯坦', 'panama': '巴拿马', 'pitcairn islands': '皮特凯恩群岛', 'peru': '秘鲁',
    'philippines': '菲律宾', 'palau': '帕劳', 'papua new guinea': '巴布亚新几内亚', 'poland': '波兰',
    'puerto rico': '波多黎各', 'north korea': '朝鲜', 'portugal': '葡萄牙', 'paraguay': '巴拉圭',
    'palestine': '巴勒斯坦', 'qatar': '卡塔尔', 'romania': '罗马尼亚', 'russia': '俄罗斯',
    'rwanda': '卢旺达', 'saudi arabia': '沙特阿拉伯', 'sudan': '苏丹', 'senegal': '塞内加尔',
    'singapore': '新加坡', 'solomon islands': '所罗门群岛', 'sierra leone': '塞拉利昂', 'el salvador': '萨尔瓦多',
    'san marino': '圣马力诺', 'somalia': '索马里', 'saint pierre and miquelon': '圣皮埃尔和密克隆',
    'serbia': '塞尔维亚', 'south sudan': '南苏丹', 'sao tome and principe': '圣多美和普林西比',
    'suriname': '苏里南', 'slovakia': '斯洛伐克', 'slovenia': '斯洛文尼亚', 'sweden': '瑞典',
    'eswatini': '斯威士兰', 'sint maarten': '荷属圣马丁', 'seychelles': '塞舌尔', 'syria': '叙利亚',
    'turks and caicos islands': '特克斯和凯科斯群岛', 'chad': '乍得', 'togo': '多哥', 'thailand': '泰国',
    'tajikistan': '塔吉克斯坦', 'tokelau': '托克劳', 'turkmenistan': '土库曼斯坦', 'timor leste': '东帝汶',
    'tonga': '汤加', 'trinidad and tobago': '特立尼达和多巴哥', 'tunisia': '突尼斯', 'turkey': '土耳其',
    'tuvalu': '图瓦卢', 'taiwan': '台湾', 'tanzania': '坦桑尼亚', 'uganda': '乌干达',
    'ukraine': '乌克兰', 'uruguay': '乌拉圭', 'united states': '美国', 'uzbekistan': '乌兹别克斯坦',
    'vatican': '梵蒂冈', 'saint vincent and the grenadines': '圣文森特和格林纳丁斯', 'venezuela': '委内瑞拉',
    'british virgin islands': '英属维尔京群岛', 'vietnam': '越南', 'vanuatu': '瓦努阿图',
    'wallis and futuna': '瓦利斯和富图纳', 'samoa': '萨摩亚', 'kosovo': '科索沃', 'yemen': '也门',
    'south africa': '南非', 'zambia': '赞比亚', 'zimbabwe': '津巴布韦'
  };

  function showMoviesForCountry(code) {
    // code 可能是 ISO 代码、国家名称（英文或中文）
    var countryName = countryCodeToName[code.toLowerCase()] || 
                      countryNameEnToCn[code.toLowerCase()] || 
                      code;
    console.log('showMoviesForCountry:', code, '->', countryName);
    console.log('total movies:', window.femaleDirectorsMovies ? window.femaleDirectorsMovies.length : 0);

    // 先按国家筛选
    var movies = (window.femaleDirectorsMovies || []).filter(function (m) {
      // 检查 countries_regions 数组
      if (m.countries_regions && Array.isArray(m.countries_regions)) {
        var match = m.countries_regions.some(function(c) {
          var cLower = c.toLowerCase();
          var nameLower = countryName.toLowerCase();
          var codeLower = code.toLowerCase();
          // 匹配国家名称或代码
          return cLower === nameLower ||
                 cLower.includes(nameLower) ||
                 cLower === codeLower ||
                 cLower.includes(codeLower);
        });
        if (match) return true;
      }
      // 兼容旧字段
      return (m.country_code || '').toLowerCase() === code.toLowerCase() ||
             (m.country || '').toLowerCase().includes(code.toLowerCase()) ||
             (m.country || '').toLowerCase() === countryName.toLowerCase();
    });
    
    // 再按年份筛选（与地球上海报一致）
    var filterStart = window.timelineStartYear;
    var filterEnd = window.timelineEndYear;
    movies = movies.filter(function(m) {
      var movieYear = parseInt(m.year) || 0;
      return movieYear >= filterStart && movieYear <= filterEnd;
    });
    
    console.log('matched movies:', movies.length);
    if (!movies.length) return false;
    
    // 统计导演
    var directors = {};
    var totalRating = 0;
    var ratingCount = 0;
    
    movies.forEach(function(m) {
      if (m.director) {
        directors[m.director] = (directors[m.director] || 0) + 1;
      }
      if (m.rating) {
        totalRating += parseFloat(m.rating);
        ratingCount++;
      }
    });
    
    var directorNames = Object.keys(directors).sort(function(a, b) {
      return directors[b] - directors[a];
    });
    
    // 计算已观看数量
    var watchedCount = movies.filter(function(m) {
      var movieId = m.id || (m.name || m.title || '').replace(/\s+/g, '_');
      return localStorage.getItem('watched_' + movieId) === 'true';
    }).length;

    // 更新左侧面板 - 显示国家名称，数字变为该国家的数据（带动画）
    // 国家名称逐个字符浮现动画
    selectedCountryLabel.innerHTML = Array.from(countryName).map(function(char, i) {
      return '<span class="char" style="animation-delay: ' + (i * 0.06) + 's">' + char + '</span>';
    }).join('');
    // 先强制重绘，然后添加 show class 触发动画
    void selectedCountryLabel.offsetWidth;
    selectedCountryLabel.classList.add('show');
    moviesLabel.textContent = '电影';
    directorsLabel.textContent = '导演';
    // 数字变化动效（延迟一点，等国家名称动画开始）
    setTimeout(function() {
      totalMoviesEl.classList.add('updating');
      totalDirectorsEl.classList.add('updating');
      animateNumber(totalMoviesEl, movies.length, 500);
      animateNumber(totalDirectorsEl, directorNames.length, 500);
      setTimeout(function() {
        totalMoviesEl.classList.remove('updating');
        totalDirectorsEl.classList.remove('updating');
      }, 300);
    }, 200);
    
    // 更新右侧面板 - 显示导演和电影列表
    countryListsSection.style.maxHeight = '50vh';
    countryListsSection.style.opacity = '1';
    countryListsSection.style.overflowY = 'auto';
    
    // 检查是否需要显示滑动查看更多提示（内容超出容器时才显示）
    requestAnimationFrame(function() {
      var scrollHint = document.getElementById('scroll-hint');
      if (scrollHint) {
        // 如果内容高度大于容器高度，显示提示
        if (countryListsSection.scrollHeight > countryListsSection.clientHeight) {
          scrollHint.style.opacity = '1';
        }
        // 否则保持 opacity: 0（不显示）
      }
    });
    
    // 扩展右侧面板宽度以容纳4个海报
    var rightStats = document.getElementById('right-stats');
    if (rightStats) rightStats.classList.add('expanded');
    
    // 移动上下部分，为导演区块腾出空间
    var rightStatsTop = document.getElementById('right-stats-top');
    var rightStatsBottom = document.getElementById('right-stats-bottom');
    if (rightStatsTop) rightStatsTop.style.transform = 'translateY(-10px)';
    if (rightStatsBottom) rightStatsBottom.style.transform = 'translateY(10px)';

    // 更新右侧面板的已看电影数量和百分比
    var watchedCountEl = document.getElementById('watched-count');
    var watchedRatioEl = document.getElementById('watched-ratio');
    if (watchedCountEl) {
      animateNumber(watchedCountEl, watchedCount, 500);
    }
    if (watchedRatioEl && movies.length > 0) {
      var ratio = Math.round((watchedCount / movies.length) * 100);
      watchedRatioEl.textContent = ratio + '%';
    }

    // 构建导演+电影组合列表HTML - 方案4：导演主导的分组布局
    directorMoviesList.innerHTML = directorNames.slice(0, 6).map(function(dir, index) {
      var movieCount = directors[dir];
      // 获取该导演的电影
      var directorMovies = movies.filter(function(m) { return m.director === dir; });
      // 计算该导演的已看数量
      var dirWatchedCount = directorMovies.filter(function(m) {
        var movieId = m.id || (m.name || m.title || '').replace(/\s+/g, '_');
        return localStorage.getItem('watched_' + movieId) === 'true';
      }).length;
      var watchRatio = directorMovies.length > 0 ? (dirWatchedCount / directorMovies.length) : 0;
      var fillPercent = Math.round(watchRatio * 100);
      var delay = index * 0.1;

      // 构建该导演的电影海报HTML（显示所有电影，每行3个）
      var moviePostersHtml = directorMovies.map(function(m, mIndex) {
        var movieId = m.id || (m.name || m.title || '').replace(/\s+/g, '_');
        var isWatched = localStorage.getItem('watched_' + movieId) === 'true';
        var mDelay = (index * 0.1) + (mIndex * 0.05);
        var cardFilter = isWatched ? 'none' : 'grayscale(80%)';
        var borderStyle = 'border: 1px solid rgba(255,255,255,0.1);';
        var isWatchedStatus = isWatched ? 'true' : 'false';
        var posterOpacity = isWatched ? '1' : '0.4';
        return '<div class="movie-card ' + (isWatched ? 'seen' : '') + '" style="animation-delay: ' + mDelay + 's; position: relative; border-radius: 3px; overflow: hidden; cursor: pointer; ' + borderStyle + ' filter: ' + cardFilter + '; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);" data-movie-id="' + movieId + '" data-movie-title="' + (m.name || m.title || '') + '" data-director-name="' + dir + '" data-watched="' + isWatchedStatus + '" onmousedown="handleMoviePressStart(event, this)" onmouseup="handleMoviePressEnd(this)" ontouchstart="handleMoviePressStart(event, this)" ontouchend="handleMoviePressEnd(this)" onclick="handleMovieClick(this)">' +
          (m.poster ? '<img src="' + m.poster + '" style="width: 100%; height: 100%; object-fit: cover; opacity: ' + posterOpacity + ';" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />' : '') +
          '<div style="display: ' + (m.poster ? 'none' : 'flex') + '; width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); flex-direction: column; align-items: center; justify-content: center; padding: 4px; text-align: center;">' +
            '<div style="font-size: 8px; color: #ffffff; font-weight: 500; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">' + (m.name || m.title || '') + '</div>' +
            '<div style="font-size: 7px; color: #888888; margin-top: 1px;">' + (m.year || '') + '</div>' +
          '</div>' +
          '<div class="circular-progress-container">' +
            '<svg class="circular-svg" viewBox="0 0 30 30">' +
              '<circle class="circle-bg" cx="15" cy="15" r="11"></circle>' +
              '<circle class="circle-bar" cx="15" cy="15" r="11"></circle>' +
            '</svg>' +
          '</div>' +
          '<div class="hint-gradient-bg"></div>' +
          '<div class="long-press-hint">' + (isWatched ? '长按取消' : '长按标记') + '</div>' +
        '</div>';
      }).join('');

      // 构建导演区块HTML - 使用data-delay存储延迟时间，卡片整体逐个入场
      return '<div class="director-section" data-delay="' + delay + '" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 8px; position: relative; overflow: hidden; text-align: left; opacity: 0; transform: translateY(20px); transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);">' +
        // 进度条背景
        '<div class="director-progress-bar" style="position: absolute; top: 0; left: 0; height: 3px; width: ' + fillPercent + '%; background: linear-gradient(90deg, rgba(200,200,200,0.9) 0%, rgba(255,255,255,0.9) 100%); transition: width 0.5s ease;"></div>' +
        // 导演信息头部 - 名字和已看数量分行展示
        '<div style="margin-bottom: 8px; padding-left: 4px;">' +
          '<div style="font-size: 14px; color: #ffffff; font-weight: 500; margin-bottom: 2px;">' + dir + '</div>' +
          '<div class="director-meta" data-director-name="' + dir + '" style="font-size: 10px; color: #888888;">' + movieCount + ' 部 · 已看 ' + dirWatchedCount + '</div>' +
        '</div>' +
        // 电影海报网格排列（每行3个，自动换行）
        '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; justify-content: center; justify-items: center;">' + moviePostersHtml + '</div>' +
      '</div>';
    }).join('');
    
    // 触发动画 - 逐个显示导演卡片
    var sections = directorMoviesList.querySelectorAll('.director-section');
    sections.forEach(function(section, idx) {
      var delay = parseFloat(section.getAttribute('data-delay')) || 0;
      setTimeout(function() {
        section.style.opacity = '1';
        section.style.transform = 'translateY(0)';
      }, delay * 1000);
    });
    
    // 同时更新旧面板（保持兼容）
    panelCountry.textContent = countryName;
    statMovies.textContent = movies.length;
    statDirectors.textContent = directorNames.length;
    statWatched.textContent = watchedCount;
    directorList.innerHTML = directorNames.slice(0, 10).map(function(dir, index) {
      var delay = Math.min(index * 0.05, 0.5);
      var initial = dir.charAt(0).toUpperCase();
      var movieCount = directors[dir];
      return '<div class="director-card" style="animation-delay: ' + delay + 's">' +
        '<div class="director-avatar">' + initial + '</div>' +
        '<div class="director-info">' +
          '<div class="director-name">' + dir + '</div>' +
          '<div class="director-movies">' + movieCount + ' 部电影</div>' +
        '</div>' +
      '</div>';
    }).join('');
    moviesList.innerHTML = movies.slice(0, 15).map(function(m, index) {
      var delay = 0.2 + Math.min(index * 0.06, 0.8);
      var movieId = m.id || (m.name || m.title || '').replace(/\s+/g, '_');
      var isWatched = localStorage.getItem('watched_' + movieId) === 'true';
      return '<div class="movie-item" style="animation-delay: ' + delay + 's" data-movie-id="' + movieId + '">' +
        (m.poster ? '<div class="movie-poster"><img src="' + m.poster + '" loading="lazy" onerror="this.style.display=\'none\'" /></div>' : '<div class="movie-poster"></div>') +
        '<div class="movie-info">' +
          '<div class="movie-title">' + (m.name || m.title || '') + '</div>' +
          '<div class="movie-meta">' +
            (m.year || '') +
            (m.rating ? ' <span class="score">★ ' + m.rating + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<label class="watched-checkbox">' +
          '<input type="checkbox" ' + (isWatched ? 'checked' : '') + ' onchange="toggleWatched(\'' + movieId + '\', this.checked)">' +
          '<span>已看</span>' +
        '</label>' +
      '</div>';
    }).join('');
    
    return true;
  }

  function showMovieByName(name) {
    var movie = (window.femaleDirectorsMovies || []).find(function (m) {
      return (m.name || m.title || '') === name;
    });
    if (!movie) return false;

    var movieId = movie.id || (movie.name || movie.title || '').replace(/\s+/g, '_');
    var isWatched = localStorage.getItem('watched_' + movieId) === 'true';

    panelCountry.textContent = movie.name || movie.title || '';
    statMovies.textContent = '1';
    statDirectors.textContent = movie.director || '-';
    statWatched.textContent = isWatched ? '1' : '0';

    directorList.innerHTML = movie.director ? '<span class="director-tag">' + movie.director + '</span>' : '';

    moviesList.innerHTML =
      '<div class="movie-item" data-movie-id="' + movieId + '">' +
        (movie.poster ? '<div class="movie-poster"><img src="' + movie.poster + '" onerror="this.style.display=\'none\'" /></div>' : '<div class="movie-poster"></div>') +
        '<div class="movie-info">' +
          '<div class="movie-title">' + (movie.name || movie.title || '') + '</div>' +
          '<div class="movie-meta">' +
            (movie.year || '') +
            (movie.rating ? ' <span class="score">★ ' + movie.rating + '</span>' : '') +
            (movie.countries_regions ? ' | ' + movie.countries_regions.join('、') : '') +
          '</div>' +
        '</div>' +
        '<label class="watched-checkbox">' +
          '<input type="checkbox" ' + (isWatched ? 'checked' : '') + ' onchange="toggleWatched(\'' + movieId + '\', this.checked)">' +
          '<span>已看</span>' +
        '</label>' +
      '</div>';
    return true;
  }

  // 切换电影观看状态
  window.toggleWatched = function(movieId, isWatched) {
    if (isWatched) {
      localStorage.setItem('watched_' + movieId, 'true');
    } else {
      localStorage.removeItem('watched_' + movieId);
    }
    // 更新统计（使用当前筛选后的电影或全部电影）
    updateWatchedStats(window.currentFilteredMovies);
  };

  // 长按交互相关变量
  var pressTimer = null;
  var isLongPressActive = false;
  var LONG_PRESS_DURATION = 650;
  var CIRCLE_LEN = 69;

  // 处理电影卡片长按开始
  window.handleMoviePressStart = function(e, card) {
    isLongPressActive = false;

    var circle = card.querySelector('.circle-bar');
    if (!circle) return;

    // 设置进度环动画
    circle.style.transition = 'stroke-dashoffset ' + LONG_PRESS_DURATION + 'ms linear';
    circle.style.strokeDashoffset = '0';

    // 启动定时器
    pressTimer = setTimeout(function() {
      isLongPressActive = true;

      var movieId = card.getAttribute('data-movie-id');
      var isCurrentlyWatched = localStorage.getItem('watched_' + movieId) === 'true';
      var newWatchedStatus = !isCurrentlyWatched;

      // 切换观看状态
      if (newWatchedStatus) {
        localStorage.setItem('watched_' + movieId, 'true');
      } else {
        localStorage.removeItem('watched_' + movieId);
      }

      // 触觉反馈
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(30);
      }

      // 更新卡片样式
      card.classList.toggle('seen', newWatchedStatus);
      card.style.filter = newWatchedStatus ? 'none' : 'grayscale(80%)';
      card.setAttribute('data-watched', newWatchedStatus ? 'true' : 'false');

      // 更新海报图片透明度
      var posterImg = card.querySelector('img');
      if (posterImg) {
        posterImg.style.opacity = newWatchedStatus ? '1' : '0.4';
      }

      // 更新提示文字
      var hint = card.querySelector('.long-press-hint');
      if (hint) {
        hint.textContent = newWatchedStatus ? '长按取消' : '长按标记';
      }

      // 更新导演区块的进度条和统计
      var directorSection = card.closest('.director-section');
      if (directorSection) {
        updateDirectorProgress(directorSection);
      }

      // 更新全局统计
      updateWatchedStats(window.currentFilteredMovies);

      // 重置进度环
      circle.style.transition = 'none';
      circle.style.strokeDashoffset = CIRCLE_LEN;
    }, LONG_PRESS_DURATION);
  };

  // 处理电影卡片长按结束
  window.handleMoviePressEnd = function(card) {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    // 重置进度环
    var circle = card.querySelector('.circle-bar');
    if (circle) {
      circle.style.transition = 'stroke-dashoffset 0.25s ease-out';
      circle.style.strokeDashoffset = CIRCLE_LEN;
    }

    // 延迟重置 isLongPressActive，确保点击事件能正常触发
    if (isLongPressActive) {
      setTimeout(function() {
        isLongPressActive = false;
      }, 100);
    }
  };

  // 处理电影卡片点击
  window.handleMovieClick = function(card) {
    // 如果长按被激活，不执行点击
    if (isLongPressActive) {
      isLongPressActive = false;
      return;
    }

    var movieId = card.getAttribute('data-movie-id');
    if (movieId) {
      showMovieDetailModal(movieId);
    }
  };

  // 更新导演区块的进度条和统计
  function updateDirectorProgress(directorSection) {
    var cards = directorSection.querySelectorAll('.movie-card');
    var totalMovies = cards.length;
    var watchedMovies = 0;
    
    cards.forEach(function(card) {
      if (card.getAttribute('data-watched') === 'true') {
        watchedMovies++;
      }
    });
    
    var watchRatio = totalMovies > 0 ? (watchedMovies / totalMovies) : 0;
    var fillPercent = Math.round(watchRatio * 100);
    
    // 更新进度条
    var progressBar = directorSection.querySelector('.director-progress-bar');
    if (progressBar) {
      progressBar.style.width = fillPercent + '%';
    }
    
    // 更新统计文字
    var metaDiv = directorSection.querySelector('.director-meta');
    if (metaDiv) {
      var directorName = metaDiv.getAttribute('data-director-name') || '';
      metaDiv.textContent = totalMovies + ' 部 · 已看 ' + watchedMovies;
    }
  }

  // 显示电影详情弹窗
  window.showMovieDetailModal = function(movieId) {
    // 查找电影数据
    var movie = null;
    if (window.femaleDirectorsMovies) {
      movie = window.femaleDirectorsMovies.find(function(m) {
        var id = m.id || (m.name || m.title || '').replace(/\s+/g, '_');
        return id === movieId;
      });
    }
    if (!movie) return;

    // 填充弹窗内容
    document.getElementById('movie-detail-poster').src = movie.poster || '';

    // 先设置标题文本（无动画）
    var titleText = movie.name || movie.title || '';
    var titleEl = document.getElementById('movie-detail-title');
    titleEl.textContent = titleText;
    
    document.getElementById('movie-detail-rating').textContent = movie.rating ? '★ ' + movie.rating : '';
    document.getElementById('movie-detail-year').textContent = movie.year || '';
    document.getElementById('movie-detail-intro').textContent = movie.intro || movie.description || '暂无简介';

    // 填充导演和国家信息
    var directorEl = document.getElementById('movie-detail-director');
    var countryEl = document.getElementById('movie-detail-country');
    var directorText = movie.director || '';
    var countryText = movie.countries_regions ? movie.countries_regions.join('、') : '';
    directorEl.textContent = directorText ? '导演: ' + directorText : '';
    countryEl.textContent = countryText ? '国家/地区: ' + countryText : '';

    // 填充标签
    var genresContainer = document.getElementById('movie-detail-genres');
    genresContainer.innerHTML = '';
    if (movie.scripts && movie.scripts.length > 0) {
      movie.scripts.forEach(function(genre) {
        var tag = document.createElement('span');
        tag.textContent = genre;
        tag.style.cssText = 'padding:3px 10px;background:rgba(255,255,255,0.08);border-radius:4px;font-size:12px;color:rgba(255,255,255,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-weight:400;letter-spacing:0.02em;';
        genresContainer.appendChild(tag);
      });
    }

    var modal = document.getElementById('movie-detail-modal');
    var content = document.getElementById('movie-detail-content');
    var right = document.getElementById('movie-detail-right');

    right.style.transition = 'none';
    right.style.opacity = '0';

    // 计算居中像素坐标
    var expandedW = Math.min(680, window.innerWidth - 48);
    var expandedH = Math.min(380, window.innerHeight - 80);
    var finalLeft = Math.round((window.innerWidth - expandedW) / 2);
    var finalTop  = Math.round((window.innerHeight - expandedH) / 2);

    // 从略小的尺寸开始（居中淡入缩放效果）
    var startW = Math.round(expandedW * 0.82);
    var startH = Math.round(expandedH * 0.82);

    content.style.transition   = 'none';
    content.style.transform    = 'none';
    content.style.left         = Math.round((window.innerWidth - startW) / 2) + 'px';
    content.style.top          = Math.round((window.innerHeight - startH) / 2) + 'px';
    content.style.width        = startW + 'px';
    content.style.height       = startH + 'px';
    content.style.borderRadius = '20px';
    content.style.opacity      = '0';

    modal.style.display    = 'block';
    modal.style.opacity    = '0';
    modal.style.transition = 'none';

    content.offsetHeight;

    var ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
    content.style.transition = [
      'left 0.4s '   + ease,
      'top 0.4s '    + ease,
      'width 0.4s '  + ease,
      'height 0.36s ' + ease,
      'opacity 0.3s ease',
    ].join(', ');
    modal.style.transition = 'opacity 0.3s ease';

    requestAnimationFrame(function() {
      content.style.left    = finalLeft + 'px';
      content.style.top     = finalTop  + 'px';
      content.style.width   = expandedW + 'px';
      content.style.height  = expandedH + 'px';
      content.style.opacity = '1';
      modal.style.opacity   = '1';

      // 弹窗显示后开始标题字符动画
      setTimeout(function() {
        var titleEl = document.getElementById('movie-detail-title');
        var titleText = titleEl.textContent;
        titleEl.innerHTML = Array.from(titleText).map(function(char, i) {
          return '<span class="char" style="animation-delay: ' + (i * 0.04) + 's">' + (char === ' ' ? '\u00A0' : char) + '</span>';
        }).join('');
      }, 100);

      setTimeout(function() {
        right.style.transition = 'opacity 0.3s ease';
        right.style.opacity    = '1';
      }, 250);
    });
  };

  // 关闭电影详情弹窗
  window.closeMovieDetailModal = function() {
    isMovieCardExpanded = false;

    var modal = document.getElementById('movie-detail-modal');
    var content = document.getElementById('movie-detail-content');
    var right = document.getElementById('movie-detail-right');

    // 先快速淡出右侧内容
    right.style.transition = 'opacity 0.15s ease';
    right.style.opacity    = '0';

    var easeIn = 'cubic-bezier(0.4, 0, 0.6, 1)';

    if (movieCardOriginalRect) {
      // 从 tooltip 展开的：回溯到 tooltip 原始位置
      content.style.transition = [
        'left 0.38s '   + easeIn,
        'top 0.38s '    + easeIn,
        'width 0.38s '  + easeIn,
        'height 0.32s ' + easeIn,
        'opacity 0.28s ease',
        'border-radius 0.3s ease',
      ].join(', ');
      content.style.left         = movieCardOriginalRect.left   + 'px';
      content.style.top          = movieCardOriginalRect.top    + 'px';
      content.style.width        = movieCardOriginalRect.width  + 'px';
      content.style.height       = movieCardOriginalRect.height + 'px';
      content.style.borderRadius = '16px';
      content.style.opacity      = '0';
    } else {
      // 从列表面板直接打开的：居中淡出缩小
      content.style.transition = 'transform 0.3s ' + easeIn + ', opacity 0.28s ease';
      content.style.transform  = 'scale(0.88)';
      content.style.opacity    = '0';
    }

    modal.style.transition = 'opacity 0.32s ease';
    modal.style.opacity    = '0';

    setTimeout(function() {
      modal.style.display      = 'none';
      content.style.transform  = 'none';
      content.style.opacity    = '1';
      movieCardOriginalRect    = null;
    }, 400);
  };

  // 点击背景关闭弹窗
  document.getElementById('movie-detail-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeMovieDetailModal();
    }
  });

  window.addEventListener('rle-selection-change', function (e) {
    var type = e.detail && e.detail.type;
    var value = e.detail && e.detail.value;
    console.log('rle-selection-change:', type, value);
    if (!value) { 
      // 取消选择时恢复全局统计
      selectedCountryLabel.classList.remove('show');
      setTimeout(function() {
        selectedCountryLabel.innerHTML = '';
      }, 400);
      moviesLabel.textContent = '电影';
      directorsLabel.textContent = '导演';
      // 数字变化动效
      totalMoviesEl.classList.add('updating');
      totalDirectorsEl.classList.add('updating');
      setTimeout(function() {
        totalMoviesEl.classList.remove('updating');
        totalDirectorsEl.classList.remove('updating');
      }, 300);
      animateNumber(totalMoviesEl, globalTotalMovies, 500);
      animateNumber(totalDirectorsEl, globalTotalDirectors, 500);
      // 收起中间区块
      countryListsSection.style.maxHeight = '0';
      countryListsSection.style.opacity = '0';
      countryListsSection.style.overflowY = 'hidden';
      // 隐藏滑动查看更多提示
      var scrollHint = document.getElementById('scroll-hint');
      if (scrollHint) scrollHint.style.opacity = '0';
      // 恢复右侧面板宽度
      var rightStats = document.getElementById('right-stats');
      if (rightStats) rightStats.classList.remove('expanded');
      // 恢复上下部分位置
      var rightStatsTop = document.getElementById('right-stats-top');
      var rightStatsBottom = document.getElementById('right-stats-bottom');
      if (rightStatsTop) rightStatsTop.style.transform = 'translateY(0)';
      if (rightStatsBottom) rightStatsBottom.style.transform = 'translateY(0)';
      panel.classList.remove('open'); 
      return; 
    }
    var shown = type === 'language'
      ? (showMovieByName(value) || showMoviesForCountry(value))
      : showMoviesForCountry(value);
    console.log('showMoviesForCountry result:', shown);
    // 不再打开旧面板，信息已显示在两侧
    // panel.classList.toggle('open', !!shown);
  });

  document.getElementById('panel-close').addEventListener('click', function () {
    panel.classList.remove('open');
    // 发送事件通知地球恢复自转
    window.dispatchEvent(new CustomEvent('country-deselect'));
  });

  // 控制面板事件
  var colorPicker = document.getElementById('border-color-picker');
  var widthSlider = document.getElementById('border-width-slider');
  var widthValue = document.getElementById('width-value');
  var panelToggle = document.getElementById('panel-toggle');
  var controlPanel = document.getElementById('control-panel');

  // 保存配置到 localStorage
  function saveConfig() {
    var config = {
      bgColor: bgColorPicker.value,
      borderColor: colorPicker.value,
      borderColorEmpty: borderColorEmptyPicker.value,
      borderWidth: widthSlider.value,
      floatSpeed: speedSlider.value,
      textureImage: currentTextureUrl,
      textureImageName: currentTextureName,
      textureOffsetX: textureOffsetX.value,
      textureOpacity: textureOpacitySlider.value,
      atmosphereBrightness: brightnessSlider.value,
      atmosphereDensity: densitySlider.value,
      atmosphereHeight: heightSlider.value,
      atmosphereColor: atmosphereColorPicker.value,
      fresnelWidth: fresnelSlider.value,
      floatHeight: floatHeightSlider.value,
      glowColor: glowColorPicker.value,
      highlightColor: highlightColorPicker.value,
      particleRadiusOffset: particleRadiusSlider.value,
      rotateSpeed: rotateSpeedSlider.value,
      posterSize: posterSizeSlider.value,
      posterHeight: posterHeightSlider.value,
      watchedRatio: watchedRatioSlider.value,
      bloomEnabled: bloomEnabledCheckbox.checked,
      bloomStrength: bloomStrengthSlider.value,
      bloomThreshold: bloomThresholdSlider.value,
      bloomRadius: bloomRadiusSlider.value,
      borderGlowIntensity: borderGlowIntensitySlider.value,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('globeConfig', JSON.stringify(config));
  }

  // 从 localStorage 加载配置
  // 内置默认配置（与 globe-config-1775029372779.json 保持一致）
  var DEFAULT_CONFIG = {
    bgColor: "#000000",
    borderColor: "#949494",
    borderColorEmpty: "#545454",
    borderWidth: "1.5",
    floatSpeed: "800",
    textureImage: "assets/earth-terrain-hd.png",
    textureImageName: "地球地形",
    textureOffsetX: "-0.25",
    textureOpacity: "1",
    atmosphereBrightness: "0.7",
    atmosphereDensity: "80",
    atmosphereHeight: "1.04",
    atmosphereColor: "#000000",
    fresnelWidth: "1.5",
    floatHeight: "1.07",
    glowColor: "#474747",
    highlightColor: "#b8b8b8",
    particleRadiusOffset: "5",
    rotateSpeed: "1",
    posterSize: "20",
    posterHeight: "1.05",
    watchedRatio: "80",
    bloomEnabled: true,
    bloomStrength: "10",
    bloomThreshold: "0.4",
    bloomRadius: "0.4",
    borderGlowIntensity: "0"
  };

  function loadConfig() {
    var saved = localStorage.getItem('globeConfig');
    if (!saved) return DEFAULT_CONFIG;
    try {
      return JSON.parse(saved);
    } catch(e) {
      return DEFAULT_CONFIG;
    }
  }

  // 导出配置为 JSON 文件
  function exportConfig() {
    var config = {
      bgColor: bgColorPicker.value,
      borderColor: colorPicker.value,
      borderColorEmpty: borderColorEmptyPicker.value,
      borderWidth: widthSlider.value,
      floatSpeed: speedSlider.value,
      textureImage: currentTextureUrl,
      textureImageName: currentTextureName,
      textureOffsetX: textureOffsetX.value,
      textureOpacity: textureOpacitySlider.value,
      atmosphereBrightness: brightnessSlider.value,
      atmosphereDensity: densitySlider.value,
      atmosphereHeight: heightSlider.value,
      atmosphereColor: atmosphereColorPicker.value,
      fresnelWidth: fresnelSlider.value,
      floatHeight: floatHeightSlider.value,
      glowColor: glowColorPicker.value,
      highlightColor: highlightColorPicker.value,
      particleRadiusOffset: particleRadiusSlider.value,
      rotateSpeed: rotateSpeedSlider.value,
      posterSize: posterSizeSlider.value,
      posterHeight: posterHeightSlider.value,
      watchedRatio: watchedRatioSlider.value,
      bloomEnabled: bloomEnabledCheckbox.checked,
      bloomStrength: bloomStrengthSlider.value,
      bloomThreshold: bloomThresholdSlider.value,
      bloomRadius: bloomRadiusSlider.value,
      borderGlowIntensity: borderGlowIntensitySlider.value,
      timestamp: new Date().toISOString()
    };
    
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'globe-config-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 导入配置
  function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var config = JSON.parse(e.target.result);
        applyConfig(config);
        saveConfig();
        alert('配置导入成功！');
      } catch(err) {
        alert('配置导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // 应用配置
  function applyConfig(config) {
    if (!config) return;

    // 应用背景颜色
    if (config.bgColor) {
      bgColorPicker.value = config.bgColor;
      bgColorHex.value = config.bgColor;
      document.body.style.backgroundColor = config.bgColor;
    }

    // 应用边线颜色 - 有电影的国家
    if (config.borderColor) {
      colorPicker.value = config.borderColor;
      borderColorHex.value = config.borderColor;
      window.dispatchEvent(new CustomEvent('border-color-change', {
        detail: { color: config.borderColor, type: 'hasMovies' }
      }));
    }

    // 应用边线颜色 - 无电影的国家
    if (config.borderColorEmpty) {
      borderColorEmptyPicker.value = config.borderColorEmpty;
      borderColorEmptyHex.value = config.borderColorEmpty;
      window.dispatchEvent(new CustomEvent('border-color-change', {
        detail: { color: config.borderColorEmpty, type: 'noMovies' }
      }));
    }

    // 应用边线粗细
    if (config.borderWidth) {
      widthSlider.value = config.borderWidth;
      widthValue.textContent = config.borderWidth;
      window.dispatchEvent(new CustomEvent('border-width-change', {
        detail: { width: parseFloat(config.borderWidth) }
      }));
    }

    // 应用浮起速度
    if (config.floatSpeed) {
      speedSlider.value = config.floatSpeed;
      speedValue.textContent = config.floatSpeed;
      window.dispatchEvent(new CustomEvent('float-speed-change', {
        detail: { speed: parseInt(config.floatSpeed) }
      }));
    }

    // 应用贴图偏移
    if (config.textureOffsetX !== undefined) {
      textureOffsetX.value = config.textureOffsetX;
      offsetXValue.textContent = parseFloat(config.textureOffsetX).toFixed(2);
      window.dispatchEvent(new CustomEvent('texture-offset-change', {
        detail: { offsetX: parseFloat(config.textureOffsetX), offsetY: 0 }
      }));
    }

    // 应用大气亮度
    if (config.atmosphereBrightness !== undefined) {
      brightnessSlider.value = config.atmosphereBrightness;
      brightnessValue.textContent = parseFloat(config.atmosphereBrightness).toFixed(1);
      window.dispatchEvent(new CustomEvent('atmosphere-brightness-change', {
        detail: { brightness: parseFloat(config.atmosphereBrightness) }
      }));
    }

    // 应用大气密度
    if (config.atmosphereDensity !== undefined) {
      densitySlider.value = config.atmosphereDensity;
      densityValue.textContent = config.atmosphereDensity;
      window.dispatchEvent(new CustomEvent('atmosphere-density-change', {
        detail: { density: parseInt(config.atmosphereDensity) }
      }));
    }

    // 应用大气高度
    if (config.atmosphereHeight !== undefined) {
      heightSlider.value = config.atmosphereHeight;
      heightValue.textContent = parseFloat(config.atmosphereHeight).toFixed(2);
      window.dispatchEvent(new CustomEvent('atmosphere-height-change', {
        detail: { height: parseFloat(config.atmosphereHeight) }
      }));
    }

    // 应用大气颜色
    if (config.atmosphereColor) {
      atmosphereColorPicker.value = config.atmosphereColor;
      atmosphereColorHex.value = config.atmosphereColor;
      window.dispatchEvent(new CustomEvent('atmosphere-color-change', {
        detail: { color: config.atmosphereColor }
      }));
    }

    // 应用菲涅尔边缘宽度
    if (config.fresnelWidth !== undefined) {
      fresnelSlider.value = config.fresnelWidth;
      fresnelValue.textContent = parseFloat(config.fresnelWidth).toFixed(1);
      window.dispatchEvent(new CustomEvent('fresnel-width-change', {
        detail: { width: parseFloat(config.fresnelWidth) }
      }));
    }

    // 应用浮起高度
    if (config.floatHeight !== undefined) {
      floatHeightSlider.value = config.floatHeight;
      floatHeightValue.textContent = parseFloat(config.floatHeight).toFixed(3);
      window.dispatchEvent(new CustomEvent('float-height-change', {
        detail: { height: parseFloat(config.floatHeight) }
      }));
    }

    // 应用发光颜色
    if (config.glowColor) {
      glowColorPicker.value = config.glowColor;
      glowColorHex.value = config.glowColor;
      window.dispatchEvent(new CustomEvent('glow-color-change', {
        detail: { color: config.glowColor }
      }));
    }

    // 应用浮起颜色
    if (config.highlightColor) {
      highlightColorPicker.value = config.highlightColor;
      highlightColorHex.value = config.highlightColor;
      window.dispatchEvent(new CustomEvent('highlight-color-change', {
        detail: { color: config.highlightColor }
      }));
    }

    // 应用粒子半径偏移
    if (config.particleRadiusOffset !== undefined) {
      particleRadiusSlider.value = config.particleRadiusOffset;
      particleRadiusValue.textContent = config.particleRadiusOffset;
      window.dispatchEvent(new CustomEvent('particle-radius-change', {
        detail: { radiusOffset: parseInt(config.particleRadiusOffset) }
      }));
    }

    // 应用选中旋转速度
    if (config.rotateSpeed !== undefined) {
      rotateSpeedSlider.value = config.rotateSpeed;
      rotateSpeedValue.textContent = parseFloat(config.rotateSpeed).toFixed(1);
      window.dispatchEvent(new CustomEvent('rotate-speed-change', {
        detail: { speed: parseFloat(config.rotateSpeed) }
      }));
    }

    // 应用电影海报大小
    if (config.posterSize !== undefined) {
      posterSizeSlider.value = config.posterSize;
      posterSizeValue.textContent = config.posterSize;
      window.dispatchEvent(new CustomEvent('poster-size-change', {
        detail: { size: parseInt(config.posterSize) }
      }));
    }

    // 应用海报高度
    if (config.posterHeight !== undefined) {
      posterHeightSlider.value = config.posterHeight;
      posterHeightValue.textContent = parseFloat(config.posterHeight).toFixed(2);
      window.dispatchEvent(new CustomEvent('poster-height-change', {
        detail: { height: parseFloat(config.posterHeight) }
      }));
    }

    // 应用已看比例
    if (config.watchedRatio !== undefined) {
      watchedRatioSlider.value = config.watchedRatio;
      watchedRatioValue.textContent = config.watchedRatio + '%';
      window.dispatchEvent(new CustomEvent('watched-ratio-change', {
        detail: { ratio: parseInt(config.watchedRatio) / 100 }
      }));
    }

    // 应用贴图透明度
    if (config.textureOpacity !== undefined) {
      textureOpacitySlider.value = config.textureOpacity;
      textureOpacityValue.textContent = parseFloat(config.textureOpacity).toFixed(2);
      window.dispatchEvent(new CustomEvent('texture-opacity-change', {
        detail: { opacity: parseFloat(config.textureOpacity) }
      }));
    }

    // 应用 Bloom 参数
    if (config.bloomEnabled !== undefined) {
      bloomEnabledCheckbox.checked = config.bloomEnabled;
      window.dispatchEvent(new CustomEvent('bloom-enabled-change', {
        detail: { enabled: config.bloomEnabled }
      }));
    }

    if (config.bloomStrength !== undefined) {
      bloomStrengthSlider.value = config.bloomStrength;
      bloomStrengthValue.textContent = parseFloat(config.bloomStrength).toFixed(1);
      window.dispatchEvent(new CustomEvent('bloom-strength-change', {
        detail: { strength: parseFloat(config.bloomStrength) }
      }));
    }

    if (config.bloomThreshold !== undefined) {
      bloomThresholdSlider.value = config.bloomThreshold;
      bloomThresholdValue.textContent = parseFloat(config.bloomThreshold).toFixed(2);
      window.dispatchEvent(new CustomEvent('bloom-threshold-change', {
        detail: { threshold: parseFloat(config.bloomThreshold) }
      }));
    }

    if (config.bloomRadius !== undefined) {
      bloomRadiusSlider.value = config.bloomRadius;
      bloomRadiusValue.textContent = parseFloat(config.bloomRadius).toFixed(2);
      window.dispatchEvent(new CustomEvent('bloom-radius-change', {
        detail: { radius: parseFloat(config.bloomRadius) }
      }));
    }

    if (config.borderGlowIntensity !== undefined) {
      borderGlowIntensitySlider.value = config.borderGlowIntensity;
      borderGlowIntensityValue.textContent = parseFloat(config.borderGlowIntensity).toFixed(1);
      window.dispatchEvent(new CustomEvent('border-glow-intensity-change', {
        detail: { intensity: parseFloat(config.borderGlowIntensity) }
      }));
    }

    // 应用贴图 - 只有当配置中有自定义贴图时才应用，不要覆盖默认贴图
    if (config.textureImage && config.textureImage !== 'assets/earth-terrain-hd.png') {
      currentTextureUrl = config.textureImage;
      currentTextureName = config.textureImageName || '已导入贴图';
      textureFilename.textContent = currentTextureName;
      textureOffsetRow.style.display = 'flex';
      window.dispatchEvent(new CustomEvent('globe-texture-change', {
        detail: { imageUrl: config.textureImage }
      }));
    }
    // 注意：不处理 config.textureImage === null 的情况，保留默认贴图
  }

  // 背景颜色选择
  var bgColorPicker = document.getElementById('bg-color-picker');
  var bgColorHex = document.getElementById('bg-color-hex');
  bgColorPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    bgColorHex.value = color;
    document.body.style.backgroundColor = color;
    saveConfig();
  });
  bgColorHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      bgColorPicker.value = color;
      document.body.style.backgroundColor = color;
      saveConfig();
    }
  });

  // 颜色选择 - 有电影的国家
  var borderColorHex = document.getElementById('border-color-hex');
  colorPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    borderColorHex.value = color;
    window.dispatchEvent(new CustomEvent('border-color-change', {
      detail: { color: color, type: 'hasMovies' }
    }));
    saveConfig();
  });
  borderColorHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      colorPicker.value = color;
      window.dispatchEvent(new CustomEvent('border-color-change', {
        detail: { color: color, type: 'hasMovies' }
      }));
      saveConfig();
    }
  });

  // 颜色选择 - 无电影的国家
  var borderColorEmptyPicker = document.getElementById('border-color-empty-picker');
  var borderColorEmptyHex = document.getElementById('border-color-empty-hex');
  borderColorEmptyPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    borderColorEmptyHex.value = color;
    window.dispatchEvent(new CustomEvent('border-color-change', {
      detail: { color: color, type: 'noMovies' }
    }));
    saveConfig();
  });
  borderColorEmptyHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      borderColorEmptyPicker.value = color;
      window.dispatchEvent(new CustomEvent('border-color-change', {
        detail: { color: color, type: 'noMovies' }
      }));
      saveConfig();
    }
  });

  // 浮起颜色选择
  var highlightColorPicker = document.getElementById('highlight-color-picker');
  var highlightColorHex = document.getElementById('highlight-color-hex');
  highlightColorPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    highlightColorHex.value = color;
    window.dispatchEvent(new CustomEvent('highlight-color-change', {
      detail: { color: color }
    }));
    saveConfig();
  });
  highlightColorHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      highlightColorPicker.value = color;
      window.dispatchEvent(new CustomEvent('highlight-color-change', {
        detail: { color: color }
      }));
      saveConfig();
    }
  });

  // 电影海报显示/隐藏按钮
  var togglePostersBtn = document.getElementById('toggle-posters-btn');
  var postersVisible = true;
  togglePostersBtn.addEventListener('click', function() {
    postersVisible = !postersVisible;
    togglePostersBtn.textContent = postersVisible ? '👁️ 显示海报' : '🙈 隐藏海报';
    togglePostersBtn.style.background = postersVisible ? 'rgba(100,200,100,0.3)' : 'rgba(200,100,100,0.3)';
    togglePostersBtn.style.borderColor = postersVisible ? 'rgba(100,200,100,0.5)' : 'rgba(200,100,100,0.5)';
    window.dispatchEvent(new CustomEvent('toggle-posters', {
      detail: { visible: postersVisible }
    }));
    saveConfig();
  });

  // 粗细滑块
  widthSlider.addEventListener('input', function(e) {
    var width = parseFloat(e.target.value);
    widthValue.textContent = width;
    window.dispatchEvent(new CustomEvent('border-width-change', {
      detail: { width: width }
    }));
    saveConfig();
  });

  // 面板折叠/展开
  panelToggle.addEventListener('click', function() {
    controlPanel.classList.toggle('collapsed');
    panelToggle.textContent = controlPanel.classList.contains('collapsed') ? '+' : '−';
  });

  // 浮起速度滑块
  var speedSlider = document.getElementById('float-speed-slider');
  var speedValue = document.getElementById('speed-value');
  speedSlider.addEventListener('input', function(e) {
    var speed = parseInt(e.target.value);
    speedValue.textContent = speed;
    window.dispatchEvent(new CustomEvent('float-speed-change', {
      detail: { speed: speed }
    }));
    saveConfig();
  });

  // 大气亮度滑块
  var brightnessSlider = document.getElementById('atmosphere-brightness');
  var brightnessValue = document.getElementById('brightness-value');
  brightnessSlider.addEventListener('input', function(e) {
    var brightness = parseFloat(e.target.value);
    brightnessValue.textContent = brightness.toFixed(1);
    window.dispatchEvent(new CustomEvent('atmosphere-brightness-change', {
      detail: { brightness: brightness }
    }));
    saveConfig();
  });

  // 大气密度滑块
  var densitySlider = document.getElementById('atmosphere-density');
  var densityValue = document.getElementById('density-value');
  densitySlider.addEventListener('input', function(e) {
    var density = parseInt(e.target.value);
    densityValue.textContent = density;
    window.dispatchEvent(new CustomEvent('atmosphere-density-change', {
      detail: { density: density }
    }));
    saveConfig();
  });

  // 大气高度滑块
  var heightSlider = document.getElementById('atmosphere-height');
  var heightValue = document.getElementById('height-value');
  heightSlider.addEventListener('input', function(e) {
    var height = parseFloat(e.target.value);
    heightValue.textContent = height.toFixed(2);
    window.dispatchEvent(new CustomEvent('atmosphere-height-change', {
      detail: { height: height }
    }));
    saveConfig();
  });

  // 大气颜色选择
  var atmosphereColorPicker = document.getElementById('atmosphere-color');
  var atmosphereColorHex = document.getElementById('atmosphere-color-hex');
  atmosphereColorPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    atmosphereColorHex.value = color;
    window.dispatchEvent(new CustomEvent('atmosphere-color-change', {
      detail: { color: color }
    }));
    saveConfig();
  });
  atmosphereColorHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      atmosphereColorPicker.value = color;
      window.dispatchEvent(new CustomEvent('atmosphere-color-change', {
        detail: { color: color }
      }));
      saveConfig();
    }
  });

  // 菲涅尔边缘宽度滑块
  var fresnelSlider = document.getElementById('fresnel-width');
  var fresnelValue = document.getElementById('fresnel-value');
  fresnelSlider.addEventListener('input', function(e) {
    var width = parseFloat(e.target.value);
    fresnelValue.textContent = width.toFixed(1);
    window.dispatchEvent(new CustomEvent('fresnel-width-change', {
      detail: { width: width }
    }));
    saveConfig();
  });

  // 海报大小滑块
  var posterSizeSlider = document.getElementById('poster-size-slider');
  var posterSizeValue = document.getElementById('poster-size-value');
  posterSizeSlider.addEventListener('input', function(e) {
    var size = parseInt(e.target.value);
    posterSizeValue.textContent = size;
    window.dispatchEvent(new CustomEvent('poster-size-change', {
      detail: { size: size }
    }));
    saveConfig();
  });

  // 海报高度偏移滑块
  var posterHeightSlider = document.getElementById('poster-height-slider');
  var posterHeightValue = document.getElementById('poster-height-value');
  posterHeightSlider.addEventListener('input', function(e) {
    var offset = parseFloat(e.target.value);
    posterHeightValue.textContent = offset.toFixed(2);
    window.dispatchEvent(new CustomEvent('poster-height-change', {
      detail: { offset: offset }
    }));
    saveConfig();
  });

  // 浮起高度滑块
  var floatHeightSlider = document.getElementById('float-height');
  var floatHeightValue = document.getElementById('float-height-value');
  floatHeightSlider.addEventListener('input', function(e) {
    var height = parseFloat(e.target.value);
    floatHeightValue.textContent = height.toFixed(3);
    window.dispatchEvent(new CustomEvent('float-height-change', {
      detail: { height: height }
    }));
    saveConfig();
  });

  // 已看电影比例滑块
  var watchedRatioSlider = document.getElementById('watched-ratio-slider');
  var watchedRatioValue = document.getElementById('watched-ratio-value');
  watchedRatioSlider.addEventListener('input', function(e) {
    var ratio = parseInt(e.target.value);
    watchedRatioValue.textContent = ratio + '%';
    window.dispatchEvent(new CustomEvent('watched-ratio-change', {
      detail: { ratio: ratio / 100 }
    }));
    saveConfig();
  });

  // 刷新随机种子按钮
  var refreshRandomBtn = document.getElementById('refresh-random-btn');
  refreshRandomBtn.addEventListener('click', function() {
    window.dispatchEvent(new CustomEvent('refresh-random-seed'));
  });

  // 发光颜色选择
  var glowColorPicker = document.getElementById('glow-color');
  var glowColorHex = document.getElementById('glow-color-hex');
  glowColorPicker.addEventListener('input', function(e) {
    var color = e.target.value;
    glowColorHex.value = color;
    window.dispatchEvent(new CustomEvent('glow-color-change', {
      detail: { color: color }
    }));
    saveConfig();
  });
  glowColorHex.addEventListener('change', function(e) {
    var color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      glowColorPicker.value = color;
      window.dispatchEvent(new CustomEvent('glow-color-change', {
        detail: { color: color }
      }));
      saveConfig();
    }
  });

  // 粒子半径偏移滑块
  var particleRadiusSlider = document.getElementById('particle-radius-offset');
  var particleRadiusValue = document.getElementById('particle-radius-value');
  particleRadiusSlider.addEventListener('input', function(e) {
    var offset = parseInt(e.target.value);
    particleRadiusValue.textContent = offset;
    window.dispatchEvent(new CustomEvent('particle-radius-change', {
      detail: { radiusOffset: offset }
    }));
    saveConfig();
  });

  // 选中旋转速度滑块
  var rotateSpeedSlider = document.getElementById('rotate-speed');
  var rotateSpeedValue = document.getElementById('rotate-speed-value');
  rotateSpeedSlider.addEventListener('input', function(e) {
    var speed = parseFloat(e.target.value);
    rotateSpeedValue.textContent = speed.toFixed(1);
    window.dispatchEvent(new CustomEvent('rotate-speed-change', {
      detail: { speed: speed }
    }));
    saveConfig();
  });

  // 海报大小滑块
  var posterSizeSlider = document.getElementById('poster-size');
  var posterSizeValue = document.getElementById('poster-size-value');
  posterSizeSlider.addEventListener('input', function(e) {
    var size = parseInt(e.target.value);
    posterSizeValue.textContent = size;
    window.dispatchEvent(new CustomEvent('poster-size-change', {
      detail: { size: size }
    }));
    saveConfig();
  });

  // 贴图透明度滑块
  var textureOpacitySlider = document.getElementById('texture-opacity');
  var textureOpacityValue = document.getElementById('texture-opacity-value');
  textureOpacitySlider.addEventListener('input', function(e) {
    var opacity = parseFloat(e.target.value);
    textureOpacityValue.textContent = opacity.toFixed(2);
    window.dispatchEvent(new CustomEvent('texture-opacity-change', {
      detail: { opacity: opacity }
    }));
    saveConfig();
  });

  // Bloom 强度滑块
  var bloomStrengthSlider = document.getElementById('bloom-strength');
  var bloomStrengthValue = document.getElementById('bloom-strength-value');
  bloomStrengthSlider.addEventListener('input', function(e) {
    var strength = parseFloat(e.target.value);
    bloomStrengthValue.textContent = strength.toFixed(1);
    window.dispatchEvent(new CustomEvent('bloom-strength-change', {
      detail: { strength: strength }
    }));
    saveConfig();
  });

  // Bloom 阈值滑块
  var bloomThresholdSlider = document.getElementById('bloom-threshold');
  var bloomThresholdValue = document.getElementById('bloom-threshold-value');
  bloomThresholdSlider.addEventListener('input', function(e) {
    var threshold = parseFloat(e.target.value);
    bloomThresholdValue.textContent = threshold.toFixed(2);
    window.dispatchEvent(new CustomEvent('bloom-threshold-change', {
      detail: { threshold: threshold }
    }));
    saveConfig();
  });

  // Bloom 半径滑块
  var bloomRadiusSlider = document.getElementById('bloom-radius');
  var bloomRadiusValue = document.getElementById('bloom-radius-value');
  bloomRadiusSlider.addEventListener('input', function(e) {
    var radius = parseFloat(e.target.value);
    bloomRadiusValue.textContent = radius.toFixed(2);
    window.dispatchEvent(new CustomEvent('bloom-radius-change', {
      detail: { radius: radius }
    }));
    saveConfig();
  });

  // Bloom 开关
  var bloomEnabledCheckbox = document.getElementById('bloom-enabled');
  bloomEnabledCheckbox.addEventListener('change', function(e) {
    window.dispatchEvent(new CustomEvent('bloom-enabled-change', {
      detail: { enabled: e.target.checked }
    }));
    saveConfig();
  });

  // 边界发光强度滑块
  var borderGlowIntensitySlider = document.getElementById('border-glow-intensity');
  var borderGlowIntensityValue = document.getElementById('border-glow-intensity-value');
  borderGlowIntensitySlider.addEventListener('input', function(e) {
    var intensity = parseFloat(e.target.value);
    borderGlowIntensityValue.textContent = intensity.toFixed(1);
    window.dispatchEvent(new CustomEvent('border-glow-intensity-change', {
      detail: { intensity: intensity }
    }));
    saveConfig();
  });

  // 时间轴亮度滑块
  var timelineBrightnessSlider = document.getElementById('timeline-brightness');
  var timelineBrightnessValue = document.getElementById('timeline-brightness-value');
  timelineBrightnessSlider.addEventListener('input', function(e) {
    var brightness = parseFloat(e.target.value);
    timelineBrightnessValue.textContent = brightness.toFixed(1);
    window.dispatchEvent(new CustomEvent('timeline-brightness-change', {
      detail: { brightness: brightness }
    }));
    saveConfig();
  });

  // 运动暂停按钮
  var pauseMotionBtn = document.getElementById('pause-motion-btn');
  var isMotionPaused = false;
  pauseMotionBtn.addEventListener('click', function() {
    isMotionPaused = !isMotionPaused;
    pauseMotionBtn.textContent = isMotionPaused ? '▶️ 继续' : '⏸️ 暂停';
    pauseMotionBtn.style.background = isMotionPaused 
      ? 'rgba(100,200,100,0.3)' 
      : 'rgba(255,100,100,0.3)';
    pauseMotionBtn.style.borderColor = isMotionPaused 
      ? 'rgba(100,200,100,0.5)' 
      : 'rgba(255,100,100,0.5)';
    window.dispatchEvent(new CustomEvent('motion-pause-change', {
      detail: { paused: isMotionPaused }
    }));
  });

  // 贴图上传
  var textureUpload = document.getElementById('texture-upload');
  var textureFilename = document.getElementById('texture-filename');
  var resetTextureBtn = document.getElementById('reset-texture');
  var uploadBtn = document.querySelector('.upload-btn');
  var textureOffsetRow = document.getElementById('texture-offset-row');
  var textureOffsetX = document.getElementById('texture-offset-x');
  var offsetXValue = document.getElementById('offset-x-value');
  
  // 保存当前贴图URL和文件名
  var currentTextureUrl = null;
  var currentTextureName = '未选择文件';

  // 设置默认地球贴图
  var defaultTextureUrl = 'assets/earth-terrain-hd.png';
  currentTextureUrl = defaultTextureUrl;
  currentTextureName = '地球地形';
  if (textureFilename) textureFilename.textContent = currentTextureName;
  if (textureOffsetRow) textureOffsetRow.style.display = 'flex';
  // 延迟加载贴图，确保地球初始化完成
  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('globe-texture-change', {
      detail: { imageUrl: defaultTextureUrl }
    }));
  }, 500);

  // 点击按钮触发文件选择
  uploadBtn.addEventListener('click', function() {
    textureUpload.click();
  });

  textureUpload.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    textureFilename.textContent = file.name;
    currentTextureName = file.name;
    textureOffsetRow.style.display = 'flex';
    
    var reader = new FileReader();
    reader.onload = function(event) {
      currentTextureUrl = event.target.result;
      window.dispatchEvent(new CustomEvent('globe-texture-change', {
        detail: { imageUrl: event.target.result }
      }));
      saveConfig();
    };
    reader.readAsDataURL(file);
  });

  // 恢复默认贴图
  resetTextureBtn.addEventListener('click', function() {
    textureUpload.value = '';
    textureFilename.textContent = '未选择文件';
    currentTextureName = '未选择文件';
    currentTextureUrl = null;
    textureOffsetRow.style.display = 'none';
    textureOffsetX.value = 0;
    offsetXValue.textContent = '0';
    window.dispatchEvent(new CustomEvent('globe-texture-change', {
      detail: { imageUrl: null }
    }));
    saveConfig();
  });

  // 贴图水平偏移
  textureOffsetX.addEventListener('input', function(e) {
    var offsetX = parseFloat(e.target.value);
    offsetXValue.textContent = offsetX.toFixed(2);
    window.dispatchEvent(new CustomEvent('texture-offset-change', {
      detail: { offsetX: offsetX, offsetY: 0 }
    }));
    saveConfig();
  });

  // 保存配置按钮 - 保存到 localStorage
  var saveConfigBtn = document.getElementById('save-config');
  saveConfigBtn.addEventListener('click', function() {
    saveConfig();
    alert('配置已保存到浏览器！');
  });

  // 导出配置按钮
  var exportConfigBtn = document.getElementById('export-config');
  exportConfigBtn.addEventListener('click', function() {
    exportConfig();
  });

  // 导入配置按钮
  var importConfigFile = document.getElementById('import-config-file');
  importConfigFile.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (file) {
      importConfig(file);
    }
    // 清空 input，允许重复导入同一文件
    e.target.value = '';
  });

});
