export const ResourceStatusLabelDict = {
  version: 'v1',
  labels: {
    recycle_soft_deleted: '已移入回收站（待恢复/待替换）',
    pending: '待补齐',
    completed: '已完善',
    archived: '已归档',
    temp: '临时',
    uploaded: '已上传',
    missing: '待补齐'
  },
  getLabel: (key, lang = 'zh-CN') => {
    void lang;
    return ResourceStatusLabelDict.labels[key] || key;
  }
};

export const getResourceStatusLabel = (key, lang = 'zh-CN') => ResourceStatusLabelDict.getLabel(key, lang);