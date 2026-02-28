const RESOURCE_CATEGORY_TABS = [
  { key: 'characters', label: '角色' },
  { key: 'props', label: '道具' },
  { key: 'scenes', label: '场景' },
  { key: 'expression2d', label: '2D 颜艺' },
  { key: 'moodBackgrounds', label: '情绪背景' },
  { key: 'symbols2d', label: '2D 符号' },
  { key: 'dynamicLines', label: '动态线条' },
  { key: 'chineseElements', label: '国风元素' },
  { key: 'onomatopoeia', label: '视觉化拟声词' },
  { key: 'qVersion', label: 'Q 版变形库' }
];

const LEGACY_RESOURCE_KEYS = ['expressions', 'animations', 'music', 'voiceovers'];

const DEFAULT_RESOURCE_KEYS = [
  ...RESOURCE_CATEGORY_TABS.map((tab) => tab.key),
  ...LEGACY_RESOURCE_KEYS
];

export { DEFAULT_RESOURCE_KEYS, LEGACY_RESOURCE_KEYS, RESOURCE_CATEGORY_TABS };