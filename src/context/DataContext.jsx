import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getImageById, storeImageData } from '../utils/imageStore';

const DataContext = createContext();
const STORAGE_KEY = 'novel-storyboard-data';

const defaultData = {
  novels: [],
  resources: {
    characters: [],
    expressions: [],
    scenes: [],
    props: [],
    animations: [],
    music: [],
    voiceovers: []
  },
  rules: []
};

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...defaultData,
          ...parsed,
          resources: { ...defaultData.resources, ...(parsed.resources || {}) },
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
            chapters: (novel.chapters || []).map((chapter) => ({
              id: chapter.id,
              title: chapter.title,
              status: chapter.status || '未录入',
              content: chapter.content || '',
              storyboards: chapter.storyboards || [],
              storyboardUpdatedAt: chapter.storyboardUpdatedAt || null,
              summaryText: chapter.summaryText || '',
              summaryTasks: chapter.summaryTasks || [],
              summaryTasksComplete: chapter.summaryTasksComplete || false,
              summaryUpdatedAt: chapter.summaryUpdatedAt || null,
              finalPackageDownloadedAt: chapter.finalPackageDownloadedAt || null,
              detailOutlineId: chapter.detailOutlineId || ''
            }))
          }))
        };
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
    return defaultData;
  });

  const hasIdbRef = (value) => typeof value === 'string' && value.startsWith('idb:');
  const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

  const replaceImagesWithRefs = async (value) => {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => replaceImagesWithRefs(entry)));
    }
    if (value && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await replaceImagesWithRefs(entry)])
      );
      return Object.fromEntries(entries);
    }
    if (isDataUrl(value)) {
      const ref = await storeImageData(value);
      return ref;
    }
    return value;
  };

  const hydrateImagesFromRefs = async (value) => {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => hydrateImagesFromRefs(entry)));
    }
    if (value && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [key, await hydrateImagesFromRefs(entry)])
      );
      return Object.fromEntries(entries);
    }
    if (hasIdbRef(value)) {
      const imageId = value.replace('idb:', '');
      const stored = await getImageById(imageId);
      return stored || value;
    }
    return value;
  };

  useEffect(() => {
    let cancelled = false;
    const persist = async () => {
      const dataForStorage = await replaceImagesWithRefs(data);
      if (cancelled) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataForStorage));
      } catch (error) {
        console.warn('Failed to persist data to localStorage', error);
      }
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
      if (!cancelled) {
        setData(hydrated);
      }
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
    setData((prev) => ({ ...prev, novels: prev.novels.filter((n) => n.id !== id) }));
  };

  const updateNovel = (novelId, updates) => {
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) => (novel.id === novelId ? { ...novel, ...updates } : novel))
    }));
  };

  const addChapter = (novelId, title, content) => {
    const newChapter = {
      id: uuidv4(),
      title,
      status: '未录入',
      content: content || '',
      storyboards: [],
      storyboardUpdatedAt: null,
      summaryText: '',
      summaryTasks: [],
      summaryTasksComplete: false,
      summaryUpdatedAt: null,
      finalPackageDownloadedAt: null,
      detailOutlineId: ''
    };
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) =>
        novel.id === novelId
          ? {
              ...novel,
              chapters: [...novel.chapters, newChapter]
            }
          : novel
      )
    }));
    return newChapter.id;
  };

  const updateChapter = (novelId, chapterId, updates) => {
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) =>
        novel.id === novelId
          ? {
              ...novel,
              chapters: novel.chapters.map((chapter) =>
                chapter.id === chapterId ? { ...chapter, ...updates } : chapter
              )
            }
          : novel
      )
    }));
  };

  const upsertResource = (type, resource) => {
    setData((prev) => {
      const collection = prev.resources[type] || [];
      const existing = collection.find((r) => r.id === resource.id || r.name === resource.name);
      const updatedList = existing
        ? collection.map((r) => (r.id === existing.id ? { ...existing, ...resource } : r))
        : [...collection, { ...resource, id: resource.id || uuidv4() }];
      return { ...prev, resources: { ...prev.resources, [type]: updatedList } };
    });
  };

  const upsertRule = (rule) => {
    setData((prev) => {
      const rules = prev.rules || [];
      const existing = rules.find((r) => r.id === rule.id || r.tool === rule.tool);
      const updatedRules = existing
        ? rules.map((r) => {
            if (r.id !== existing.id) return r;
            const nextVersion = (r.version || 1) + 1;
            const history = [...(r.history || []), { version: r.version || 1, snapshot: { ...r } }];
            return { ...r, ...rule, id: r.id, version: nextVersion, history };
          })
        : [...rules, { ...rule, id: rule.id || uuidv4(), version: 1, history: [] }];
      return { ...prev, rules: updatedRules };
    });
  };

  const deleteRule = (ruleId) => {
    setData((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) }));
  };

  const importRules = (rules) => {
    if (!Array.isArray(rules)) return;
    setData((prev) => ({ ...prev, rules: rules.map((r) => ({ ...r, id: r.id || uuidv4() })) }));
  };

  const ensurePlaceholderResources = (missing, novelId = '') => {
    missing.forEach((item) => {
      const basePayload = {
        name: item.name,
        description: item.description || '占位资源，待补齐',
        isAvailable: false,
        status: '待补齐',
        images: [],
        ...(item.type === 'characters' && novelId ? { novelId } : {})
      };
      const typePayloads = {
        characters: {
          meta: {
            persona: '待补齐：角色性格与人设推理',
            appearance: '待补齐：外貌特征（发型/服饰/标识）',
            reference: '待补齐：参考人物/原型',
            relationships: '待补齐：人际关系推理',
            expressionUnlock: '待补齐：表情解锁规则',
            personalitySetting: '待补齐：性格设定',
            growthTrajectory: '待补齐：成长轨迹',
            characterGrowthHistory: []
          },
          aliases: [],
          priorityPin: false,
          form: [],
          action: [],
          assets: []
        },
        scenes: {
          meta: {
            sceneSettings: {
              time: '',
              weather: '',
              season: '',
              style: ''
            },
            sceneLayout: {
              elements: []
            },
            sceneNotes: '待补齐：场景搭建元素、镜头参考、材质说明'
          }
        },
        expressions: {
          meta: {
            emotionType: '',
            emotionValue: '',
            background: '',
            templateSuggestion: '待补齐：填写参考动漫/角色/表情描述，用于图生图复刻',
            expressionGrouping: 'group',
            category: '自定义',
            scope: 'universal',
            riskLevel: 'mid',
            strategy: '',
            templateAnime: '',
            templateCharacter: '',
            templateExpression: '',
            shotRecommendation: ['closeup', 'medium'],
            prohibitions: '',
            expressionAssets: [],
            expressionRules: [],
            expressionHistory: [],
            expressionTransferRequests: []
          }
        }
      };
      upsertResource(item.type, {
        ...basePayload,
        ...(typePayloads[item.type] || {})
      });
    });
  };

  const deleteResource = (type, resourceId) => {
    setData((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        [type]: (prev.resources[type] || []).filter((r) => r.id !== resourceId)
      }
    }));
  };

  const updateResourceImages = (type, resourceId, images) => {
    setData((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        [type]: (prev.resources[type] || []).map((r) =>
          r.id === resourceId
            ? {
                ...r,
                images,
                isAvailable: images.length > 0,
                status: images.length > 0 ? '已完成' : '待补齐'
              }
            : r
        )
      }
    }));
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
