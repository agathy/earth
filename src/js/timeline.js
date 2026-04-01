// ===== 时间轴年份UI =====
// 初始化时间轴年份范围（全局变量）
window.timelineStartYear = 1950;
window.timelineEndYear = 2024;

// 时间轴年份UI管理
const TimelineYearUI = {
  container: null,
  yearLabels: [],
  minYear: 1950,
  maxYear: 2024,
  isVisible: false,

  init() {
    this.container = document.getElementById('timeline-years-container');
    this.generateYearLabels();
  },
  
  generateYearLabels() {
    // 生成关键年份：起始、结束和中间每10年
    const years = [];
    for (let year = this.minYear; year <= this.maxYear; year += 10) {
      years.push(year);
    }
    if (years[years.length - 1] !== this.maxYear) {
      years.push(this.maxYear);
    }
    
    // 清空容器
    this.container.innerHTML = '';
    this.yearLabels = [];
    
    years.forEach((year, index) => {
      const label = document.createElement('div');
      label.className = 'timeline-year-label';
      label.textContent = year;
      
      if (index === 0) {
        label.classList.add('start');
      } else if (index === years.length - 1) {
        label.classList.add('end');
      } else {
        label.classList.add('middle');
      }
      
      this.container.appendChild(label);
      this.yearLabels.push({ element: label, year, index });
    });
  },
  
  // 更新年份位置 - 基于3D环的投影坐标
  updatePositions(screenPoints) {
    if (!this.isVisible || !screenPoints || screenPoints.length === 0) {
      console.log('updatePositions skipped:', { isVisible: this.isVisible, screenPointsLength: screenPoints?.length });
      return;
    }

    // console.log('updatePositions called with', screenPoints.length, 'points');

    this.yearLabels.forEach((item, index) => {
      if (screenPoints[index]) {
        const point = screenPoints[index];
        // 只显示在屏幕范围内的年份
        if (point.visible) {
          item.element.style.left = point.x + 'px';
          item.element.style.top = point.y + 'px';
          item.element.style.opacity = point.opacity || 1;
          item.element.style.display = 'block';
          // console.log('Updated label', item.year, 'to position:', point.x, point.y);
        } else {
          item.element.style.opacity = 0;
          item.element.style.display = 'none';
        }
      }
    });
  },
  
  show() {
    this.isVisible = true;
    this.container.style.opacity = '1';
  },
  
  hide() {
    this.isVisible = false;
    this.container.style.opacity = '0';
  }
};

// 初始化
TimelineYearUI.init();
console.log('TimelineYearUI initialized, container:', TimelineYearUI.container);
// 默认显示年份标签
TimelineYearUI.show();
console.log('TimelineYearUI shown, yearLabels count:', TimelineYearUI.yearLabels.length);

// 监听3D环投影坐标更新
window.addEventListener('timeline-ring-projected', (e) => {
  const { screenPoints } = e.detail;
  // console.log('Received timeline-ring-projected event:', screenPoints.length, 'points');
  TimelineYearUI.updatePositions(screenPoints);
});
