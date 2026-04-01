// 女性导演电影数据注入脚本
// 在页面加载时替换原始数据

(function() {
  'use strict';

  // 等待页面加载完成
  function init() {
    // 查找rle-app元素
    const app = document.querySelector('rle-app');
    if (!app) {
      console.log('rle-app not found, retrying...');
      setTimeout(init, 100);
      return;
    }

    // 获取当前data-props
    const currentProps = app.getAttribute('data-props');
    if (!currentProps) {
      console.log('No data-props found');
      return;
    }

    try {
      // 解析当前数据
      const data = JSON.parse(currentProps);

      // 修改字符串为电影相关
      data.strings = {
        ...data.strings,
        site_title: "女性导演电影探索",
        site_description: "探索全球女性导演的电影作品",
        no_data: "暂无数据",
        scroll_explore: "滚动探索更多",
        number_of_speakers_title: "票房",
        number_of_speakers_description: "<p>电影在全球的票房收入</p>",
        endonym_title: "原名",
        endonym_description: "<p>电影的原始名称</p>",
        scripts_title: "类型",
        scripts_description: "<p>电影的类型和风格</p>",
        endangerment_title: "评分",
        endangerment_description: "<p>电影的网络评分</p>",
        overview: "概览",
        languages: "电影",
        endonym: "原名",
        number_of_speakers: "票房",
        country_region: "国家/地区",
        countries_regions: "国家/地区",
        countries_regions_description: "<p>电影的制作国家或地区</p>",
        world_overview_title: "探索女性导演的电影世界",
        world_overview_description: "<p>从贾玲到Greta Gerwig，从商业大片到独立艺术电影，发现全球女性导演的精彩作品</p>",
        explore_languages_title: "探索电影",
        explore_languages_description: "<p>点击地图上的点探索不同电影</p>",
        search_placeholder: "搜索电影、导演...",
        search_title: "搜索",
        search_description: "<p>搜索你感兴趣的电影或导演</p>",
        filters_title: "筛选",
        filters_description: "<p>按国家、年份、类型筛选电影</p>",
        status_safe: "商业片",
        status_vulnerable: "独立片",
        status_endangered: "艺术片",
        status_extinct: "纪录片"
      };

      // 替换语言数据为电影数据
      data.languages = [
        {
          id: "cmn",
          name: "你好，李焕英",
          endonym: "你好，李焕英",
          iso639_3: "cmn",
          iso639_1: "zh",
          speakers: "54.13亿人民币",
          status: "safe",
          scripts: ["喜剧", "剧情"],
          countries_regions: ["中国"],
          latitude: 35.0,
          longitude: 105.0
        },
        {
          id: "yue",
          name: "热辣滚烫",
          endonym: "热辣滚烫",
          iso639_3: "yue",
          iso639_1: "zh",
          speakers: "34.6亿人民币",
          status: "safe",
          scripts: ["喜剧", "运动"],
          countries_regions: ["中国"],
          latitude: 35.0,
          longitude: 105.0
        },
        {
          id: "wuu",
          name: "后来的我们",
          endonym: "後來的我們",
          iso639_3: "wuu",
          iso639_1: "zh",
          speakers: "13.61亿人民币",
          status: "safe",
          scripts: ["爱情", "剧情"],
          countries_regions: ["中国", "台湾"],
          latitude: 35.0,
          longitude: 105.0
        },
        {
          id: "hsn",
          name: "好东西",
          endonym: "好东西",
          iso639_3: "hsn",
          iso639_1: "zh",
          speakers: "7.17亿人民币",
          status: "safe",
          scripts: ["喜剧", "剧情"],
          countries_regions: ["中国"],
          latitude: 35.0,
          longitude: 105.0
        },
        {
          id: "barbie",
          name: "芭比",
          endonym: "Barbie",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "14.46亿美元",
          status: "safe",
          scripts: ["喜剧", "奇幻"],
          countries_regions: ["美国"],
          latitude: 39.0,
          longitude: -98.0
        },
        {
          id: "wonder",
          name: "神奇女侠",
          endonym: "Wonder Woman",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "8.22亿美元",
          status: "safe",
          scripts: ["动作", "冒险"],
          countries_regions: ["美国"],
          latitude: 39.0,
          longitude: -98.0
        },
        {
          id: "little",
          name: "小妇人",
          endonym: "Little Women",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "2.18亿美元",
          status: "vulnerable",
          scripts: ["剧情", "爱情"],
          countries_regions: ["美国"],
          latitude: 39.0,
          longitude: -98.0
        },
        {
          id: "lady",
          name: "伯德小姐",
          endonym: "Lady Bird",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "7800万美元",
          status: "vulnerable",
          scripts: ["剧情", "喜剧"],
          countries_regions: ["美国"],
          latitude: 39.0,
          longitude: -98.0
        },
        {
          id: "nomad",
          name: "无依之地",
          endonym: "Nomadland",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "3900万美元",
          status: "vulnerable",
          scripts: ["剧情"],
          countries_regions: ["美国"],
          latitude: 39.0,
          longitude: -98.0
        },
        {
          id: "power",
          name: "犬之力",
          endonym: "The Power of the Dog",
          iso639_3: "eng",
          iso639_1: "en",
          speakers: "1100万美元",
          status: "vulnerable",
          scripts: ["剧情", "西部"],
          countries_regions: ["新西兰", "美国"],
          latitude: -41.0,
          longitude: 174.0
        }
      ];

      // 更新data-props
      app.setAttribute('data-props', JSON.stringify(data));

      // 触发自定义事件通知应用数据已更新
      const event = new CustomEvent('data-updated', { detail: data });
      app.dispatchEvent(event);

      console.log('电影数据注入成功！');
    } catch (e) {
      console.error('数据注入失败:', e);
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
