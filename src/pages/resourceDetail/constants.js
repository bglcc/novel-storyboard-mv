const typeLabels = {
  characters: '角色',
  props: '道具',
  scenes: '场景',
  expression2d: '2D 颜艺',
  moodBackgrounds: '情绪背景',
  symbols2d: '2D 符号',
  dynamicLines: '动态线条',
  chineseElements: '国风元素',
  onomatopoeia: '视觉化拟声词',
  qVersion: 'Q 版变形库',
  // legacy keys (for backward compatibility)
  expressions: '表情',
  animations: '动画',
  music: '背景音乐',
  voiceovers: '角色配音'
};

const expressionTabs = [
  { key: 'base', label: '基础信息' },
  { key: 'assets', label: '参考图 & 素材' },
  { key: 'transfer', label: '导出/导入' }
];

const scopeOptions = [
  { value: 'chibi', label: 'Q版' },
  { value: 'normal', label: '普通比例' },
  { value: 'universal', label: '通用' }
];

const riskOptions = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' }
];

const strategyOptions = [
  { value: 'direct_generate', label: '直接生图' },
  { value: 'img2img_character', label: '图生图' },
  { value: 'hybrid', label: '混合' }
];

export { expressionTabs, riskOptions, scopeOptions, strategyOptions, typeLabels };