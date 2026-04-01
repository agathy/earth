// 主应用逻辑
(function() {
  'use strict';

  // 全局变量
  var globalTotalMovies = 0;
  var globalTotalDirectors = 0;
  var currentMovieCardData = null;
  var isMovieCardExpanded = false;
  var movieCardShowTimer = null;
  var movieCardHideTimer = null;
  var isMovieCardVisible = false;

  // 初始化应用
  function initApp() {
    // 启动 Globe
    var canvas = document.getElementById('globe-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    var app = new GlobeApp({ canvas: canvas });
    window.globeApp = app; // 暴露到全局作用域
    app.start();

    // 加载电影海报到地球上
    if (window.femaleDirectorsMovies && window.femaleDirectorsMovies.length > 0) {
      setTimeout(function() {
        console.log('开始加载电影海报...');
        app.setMoviePosters(window.femaleDirectorsMovies);
        updateStats();
        
        // 海报加载完成后，立即应用当前时间轴的筛选
        const timelineEvent = new CustomEvent('applyTimelineFilter', {
          detail: { app: app }
        });
        window.dispatchEvent(timelineEvent);
      }, 2000);
    }

    // 应用配置
    setTimeout(function() {
      if (window.loadConfig && window.applyConfig) {
        var config = window.loadConfig();
        window.applyConfig(config);
        console.log('配置已应用');
      } else {
        console.warn('配置函数未找到，跳过配置应用');
      }
    }, 0);

    // 初始化事件监听
    initEventListeners();
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
  window.updateStats = function(filteredMovies) {
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
  };

  // 更新已看统计
  window.updateWatchedStats = function(filteredMovies) {
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
      
      // 检查 localStorage 中的已看记录
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
  };

  // 初始化事件监听
  function initEventListeners() {
    // 监听已看比例变化
    window.addEventListener('watched-ratio-change', function() {
      setTimeout(function() {
        updateWatchedStats(window.currentFilteredMovies);
      }, 100);
    });
    
    window.addEventListener('refresh-random-seed', function() {
      setTimeout(function() {
        updateWatchedStats(window.currentFilteredMovies);
      }, 100);
    });

    // 国家悬停标签
    var labelEl = document.getElementById('globe-country-label');
    var currentCountryName = '';

    new MutationObserver(function () {
      currentCountryName = document.body.getAttribute('globe-hover-country') || '';
      labelEl.textContent = currentCountryName;
      if (currentCountryName) {
        labelEl.style.display = 'block';
      } else {
        labelEl.style.display = 'none';
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['globe-hover-country'] });
  }

  // 页面加载完成后初始化应用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();