// UI组件逻辑
(function() {
  'use strict';

  // 全局变量
  var movieCardOverlay = document.getElementById('movie-card-overlay');
  var movieCard = document.getElementById('movie-card');
  var movieCardImg = document.getElementById('movie-card-img');
  var movieCardTitle = document.getElementById('movie-card-title');
  var movieCardRating = document.getElementById('movie-card-rating');
  var movieCardYear = document.getElementById('movie-card-year');
  var movieCardDirector = document.getElementById('movie-card-director');
  var movieCardCountry = document.getElementById('movie-card-country');

  var movieCardShowTimer = null;
  var movieCardHideTimer = null;
  var isMovieCardVisible = false;
  var currentMovieCardData = null;
  var isMovieCardExpanded = false;
  var movieCardOriginalRect = null;

  // 暴露到window对象，供外部调用
  window.movieCard = movieCard;

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

  // 展开卡片到屏幕中间
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
    window.closeMovieDetailModal();
  }

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
      content.style.transition = [
        'opacity 0.3s ease',
        'transform 0.3s ease',
      ].join(', ');
      content.style.opacity = '0';
      content.style.transform = 'scale(0.9)';
    }

    modal.style.transition = 'opacity 0.3s ease';
    modal.style.opacity = '0';

    // 动画完成后隐藏
    setTimeout(function() {
      modal.style.display = 'none';
      content.style.transition = 'none';
      content.style.transform = 'none';
      content.style.left = '0';
      content.style.top = '0';
      content.style.width = '200px';
      content.style.height = '300px';
      content.style.opacity = '0';
      
      // 重置标题为普通文本（移除动画字符）
      var titleEl = document.getElementById('movie-detail-title');
      if (titleEl) {
        titleEl.innerHTML = titleEl.textContent;
      }
    }, 300);
  };

  // 显示电影详情弹窗（直接打开，不经过tooltip）
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

})();