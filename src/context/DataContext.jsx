import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getImageById, storeImageData } from '../utils/imageStore';

const DataContext = createContext();
const STORAGE_KEY = 'novel-storyboard-data';

const defaultResources = {
  characters: [],
  expressions: [],
  scenes: [],
  props: [],
  animations: [],
  music: [],
  voiceovers: []
};

const defaultData = {
  novels: [],
  resources: defaultResources,
  rules: []
};

const createDefaultChapter = ({ id, title, content = '' } = {}) => ({
  id: id || uuidv4(),
  title: title || '未命名章节',
  status: '细纲处理中',
  content,
  detailOutlineId: '',
  storyboardUpdatedAt: null,
  finalPackageDownloadedAt: null,
  storyboardOutlineItems: [],
  storyboardOutlineUpdatedAt: null,
  storyboardShots: [],
  storyboardLevelGuide: {
    L1: '单一图层静态镜头：补齐资源->下载生图->上传图片',
    L2: '资源拟动镜头：补齐资源后即可完成',
    L3: '复杂独立动作镜头：补齐资源->生图->生视频',
    L4: '多人动态交互镜头：补齐双人交互资源后即可完成'
  },
  editingWorkflow: {
    clipExportReady: false,
    clipScriptText: '',
    clipScriptUpdatedAt: null
  }
});

const normalizeShotResource = (resource) => ({
  id: resource.id || uuidv4(),
  type: resource.type || 'characters',
  name: resource.name || '未命名资源',
  subType: resource.subType || '',
  status: resource.status || 'missing',
  fileName: resource.fileName || '',
  localPath: resource.localPath || '',
  remoteUrl: resource.remoteUrl || '',
  prompt: resource.prompt || '',
  preview: resource.preview || '',
  owner: resource.owner || '',
  updatedAt: resource.updatedAt || null
});

const normalizeShot = (shot, index) => ({
  id: shot.id || uuidv4(),
  shotNumber: shot.shotNumber || `${index + 1}`,
  outlineIndex: Number.isFinite(shot.outlineIndex) ? shot.outlineIndex : index,
  title: shot.title || `镜 ${index + 1}`,
  synopsis: shot.synopsis || shot.description || '',
  level: ['L1', 'L2', 'L3', 'L4'].includes(shot.level) ? shot.level : 'L1',
  shotType: shot.shotType || '',
  cameraAngle: shot.cameraAngle || '',
  sceneDescription: shot.sceneDescription || '',
  shotTime: shot.shotTime || '',
  visualDescription: shot.visualDescription || '',
  editMethod: shot.editMethod || '',
  keyframesEnabled: Boolean(shot.keyframesEnabled),
  keyframes: Array.isArray(shot.keyframes) ? shot.keyframes : [],
  resources: Array.isArray(shot.resources) ? shot.resources.map(normalizeShotResource) : [],
  imageAsset: shot.imageAsset || { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  videoAsset: shot.videoAsset || { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  completed: Boolean(shot.completed),
  completedAt: shot.completedAt || null
});

const normalizeChapter = (chapter) => {
  const base = createDefaultChapter(chapter);
  const shots = Array.isArray(chapter.storyboardShots)
    ? chapter.storyboardShots.map(normalizeShot)
    : Array.isArray(chapter.storyboards)
      ? chapter.storyboards.map((shot, index) =>
          normalizeShot(
            {
              ...shot,
              synopsis: shot.description || '',
              visualDescription: shot.sceneDescription || '',
              editMethod: '',
              resources: [
                ...(shot.scene ? [{ type: 'scenes', name: shot.scene, status: 'uploaded' }] : []),
                ...((shot.characters || []).map((name) => ({ type: 'characters', name, status: 'uploaded' })) || []),
                ...((shot.props || []).map((name) => ({ type: 'props', name, status: 'uploaded' })) || [])
              ]
            },
            index
          )
        )
      : [];

  return {
    ...base,
    ...chapter,
    storyboardOutlineItems: Array.isArray(chapter.storyboardOutlineItems)
      ? chapter.storyboardOutlineItems
      : [],
    storyboardShots: shots,
    editingWorkflow: {
      ...base.editingWorkflow,
      ...(chapter.editingWorkflow || {})
    }
  };
};

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultData;
    try {
      const parsed = JSON.parse(stored);
      return {
        ...defaultData,
        ...parsed,
        resources: { ...defaultResources, ...(parsed.resources || {}) },
        rules: parsed.rules || [],
        novels: (parsed.novels || []).map((novel) => ({
          ...novel,
          cover: novel.cover ?? '',
          outlinePrompt: novel.outlinePrompt || '',
          outlineText: novel.outlineText || '',
          outlineGeneratedAt: novel.outlineGeneratedAt || null,
          outlineUpdatedAt: novel.outlineUpdatedAt || null,
          outlineStatus: novel.outlineStatus || '',
          outlineVersions: novel.outlineVersions || [],
          outlineSelectionHistory: novel.outlineSelectionHistory || [],
          relationshipGraph: novel.relationshipGraph || { nodes: [], relations: [] },
          worldviewText: novel.worldviewText || '',
          foreshadows: novel.foreshadows || [],
          detailOutlineChapters: novel.detailOutlineChapters || [],
          detailOutlineUpdatedAt: novel.detailOutlineUpdatedAt || null,
          chapters: (novel.chapters || []).map(normalizeChapter)
        }))
      };
    } catch (error) {
      console.error('Failed to parse stored data', error);
      return defaultData;
    }
  });

  const hasIdbRef = (value) => typeof value === 'string' && value.startsWith('idb:');
  const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

  const replaceImagesWithRefs = async (value) => {
    if (Array.isArray(value)) return Promise.all(value.map((entry) => replaceImagesWithRefs(entry)));
    if (value && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await replaceImagesWithRefs(entry)])
      );
      return Object.fromEntries(entries);
    }
    if (isDataUrl(value)) return storeImageData(value);
    return value;
  };

  const hydrateImagesFromRefs = async (value) => {
    if (Array.isArray(value)) return Promise.all(value.map((entry) => hydrateImagesFromRefs(entry)));
    if (value && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await hydrateImagesFromRefs(entry)])
      );
      return Object.fromEntries(entries);
    }
    if (hasIdbRef(value)) {
      const storedImage = await getImageById(value.replace('idb:', ''));
      return storedImage || value;
    }
    return value;
  };

  useEffect(() => {
    let cancelled = false;
    const persist = async () => {
      const payload = await replaceImagesWithRefs(data);
      if (cancelled) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    };
    persist();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const containsRefs = JSON.stringify(data).includes('"idb:');
      if (!containsRefs) return;
      const hydrated = await hydrateImagesFromRefs(data);
      if (!cancelled) setData(hydrated);
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const addNovel = (title, cover = '') => {
    const newNovel = {
      id: uuidv4(),
      title,
      cover,
      createdAt: Date.now(),
      chapters: [],
      outlinePrompt: '',
      outlineText: '',
      outlineGeneratedAt: null,
      outlineUpdatedAt: null,
      outlineStatus: '未生成',
      outlineVersions: [],
      outlineSelectionHistory: [],
      relationshipGraph: { nodes: [], relations: [] },
      worldviewText: '',
      foreshadows: [],
      detailOutlineChapters: [],
      detailOutlineUpdatedAt: null
    };
    setData((prev) => ({ ...prev, novels: [...prev.novels, newNovel] }));
    return newNovel.id;
  };

  const deleteNovel = (id) => {
    setData((prev) => ({ ...prev, novels: prev.novels.filter((novel) => novel.id !== id) }));
  };

  const updateNovel = (novelId, updates) => {
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) => (novel.id === novelId ? { ...novel, ...updates } : novel))
    }));
  };

  const addChapter = (novelId, title, content) => {
    const chapter = createDefaultChapter({ title, content });
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) =>
        novel.id === novelId ? { ...novel, chapters: [...novel.chapters, chapter] } : novel
      )
    }));
    return chapter.id;
  };

  const updateChapter = (novelId, chapterId, updates) => {
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) =>
        novel.id === novelId
          ? {
              ...novel,
              chapters: novel.chapters.map((chapter) => {
                if (chapter.id !== chapterId) return chapter;
                const resolvedUpdates = typeof updates === 'function' ? updates(chapter) : updates;
                return normalizeChapter({ ...chapter, ...(resolvedUpdates || {}) });
              })
            }
          : novel
      )
    }));
  };

  const upsertResource = (type, resource) => {
    setData((prev) => {
      const current = prev.resources[type] || [];
      const existing = current.find((item) => item.id === resource.id || item.name === resource.name);
      const next = existing
        ? current.map((item) => (item.id === existing.id ? { ...existing, ...resource } : item))
        : [...current, { ...resource, id: resource.id || uuidv4() }];
      return { ...prev, resources: { ...prev.resources, [type]: next } };
    });
  };

  const deleteResource = (type, resourceId) => {
    setData((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        [type]: (prev.resources[type] || []).filter((resource) => resource.id !== resourceId)
      }
    }));
  };

  const updateResourceImages = (type, resourceId, images) => {
    setData((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        [type]: (prev.resources[type] || []).map((resource) =>
          resource.id === resourceId
            ? {
                ...resource,
                images,
                isAvailable: images.length > 0,
                status: images.length > 0 ? '已完成' : '待补齐'
              }
            : resource
        )
      }
    }));
  };

  const ensurePlaceholderResources = (missing, novelId = '') => {
    missing.forEach((item) => {
      upsertResource(item.type, {
        name: item.name,
        description: item.description || '占位资源，待补齐',
        isAvailable: false,
        status: '待补齐',
        images: [],
        ...(item.type === 'characters' && novelId ? { novelId } : {})
      });
    });
  };

  const upsertRule = (rule) => {
    setData((prev) => {
      const existing = (prev.rules || []).find((entry) => entry.id === rule.id || entry.tool === rule.tool);
      const nextRules = existing
        ? prev.rules.map((entry) =>
            entry.id === existing.id
              ? {
                  ...entry,
                  ...rule,
                  id: existing.id,
                  version: (entry.version || 1) + 1,
                  history: [...(entry.history || []), { version: entry.version || 1, snapshot: { ...entry } }]
                }
              : entry
          )
        : [...(prev.rules || []), { ...rule, id: rule.id || uuidv4(), version: 1, history: [] }];
      return { ...prev, rules: nextRules };
    });
  };

  const deleteRule = (ruleId) => {
    setData((prev) => ({ ...prev, rules: prev.rules.filter((rule) => rule.id !== ruleId) }));
  };

  const importRules = (rules) => {
    if (!Array.isArray(rules)) return;
    setData((prev) => ({ ...prev, rules: rules.map((rule) => ({ ...rule, id: rule.id || uuidv4() })) }));
  };

  const value = {
    data,
    addNovel,
    deleteNovel,
    updateNovel,
    addChapter,
    updateChapter,
    upsertResource,
    ensurePlaceholderResources,
    updateResourceImages,
    deleteResource,
    upsertRule,
    deleteRule,
    importRules
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
