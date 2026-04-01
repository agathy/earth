// 电影交互逻辑
(function() {
  'use strict';

  // 长按交互相关变量
  var pressTimer = null;
  var isLongPressActive = false;
  var LONG_PRESS_DURATION = 650;
  var CIRCLE_LEN = 69;

  // 切换电影观看状态
  window.toggleWatched = function(movieId, isWatched) {
    if (isWatched) {
      localStorage.setItem('watched_' + movieId, 'true');
    } else {
      localStorage.removeItem('watched_' + movieId);
    }
    // 更新统计（使用当前筛选后的电影或全部电影）
    if (window.updateWatchedStats) {
      window.updateWatchedStats(window.currentFilteredMovies);
    }
  };

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
      if (directorSection && window.updateDirectorProgress) {
        window.updateDirectorProgress(directorSection);
      }

      // 更新全局统计
      if (window.updateWatchedStats) {
        window.updateWatchedStats(window.currentFilteredMovies);
      }

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
    if (movieId && window.showMovieDetailModal) {
      window.showMovieDetailModal(movieId);
    }
  };

  // 更新导演区块的进度条和统计
  window.updateDirectorProgress = function(directorSection) {
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
  };

})();