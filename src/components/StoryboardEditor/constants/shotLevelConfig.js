export const SHOT_LEVEL_CONFIG = {
  L1: {
    requiredFields: ['title', 'shotType', 'cameraAngle'],
    resourceRequirements: { anyOf: [{ type: 'scenes', min: 1 }, { type: 'characters', min: 1 }] },
    requiredAssets: []
  },
  L2: {
    requiredFields: ['title', 'shotType'],
    resourceRequirements: { allOf: [{ type: 'scenes', min: 1 }, { type: 'characters', min: 1 }] },
    requiredAssets: []
  },
  L3: {
    requiredFields: ['title', 'shotType', 'duration', 'editMethod'],
    resourceRequirements: {
      allOf: [
        { type: 'characters', min: 1 },
        { type: 'scenes', min: 1 }
      ]
    },
    requiredAssets: []
  },
  L4: {
    requiredFields: ['title', 'shotType', 'duration', 'visualDescription', 'editMethod'],
    resourceRequirements: { allOf: [{ type: 'characters', min: 2 }, { type: 'scenes', min: 1 }] },
    requiredAssets: []
  }
};

export const FIELD_LABELS = {
  title: '标题',
  shotType: '镜头类型',
  cameraAngle: '机位角度',
  duration: '镜头时长',
  visualDescription: '画面描述',
  editMethod: '剪辑手法',
  imageAsset: '图片素材',
  videoAsset: '视频素材'
};
