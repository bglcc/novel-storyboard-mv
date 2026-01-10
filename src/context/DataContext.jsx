import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
            chapters: (novel.chapters || []).map((chapter) => ({
              id: chapter.id,
              title: chapter.title,
              status: chapter.status || '仅录入',
              content: chapter.content || '',
              storyboards: chapter.storyboards || [],
              storyboardUpdatedAt: chapter.storyboardUpdatedAt || null
            }))
          }))
        };
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
    return defaultData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addNovel = (title, cover = '') => {
    const newNovel = { id: uuidv4(), title, cover, createdAt: Date.now(), chapters: [] };
    setData((prev) => ({ ...prev, novels: [...prev.novels, newNovel] }));
    return newNovel.id;
  };

  const deleteNovel = (id) => {
    setData((prev) => ({ ...prev, novels: prev.novels.filter((n) => n.id !== id) }));
  };

  const addChapter = (novelId, title, content) => {
    const newChapter = {
      id: uuidv4(),
      title,
      status: '仅录入',
      content: content || '',
      storyboards: [],
      storyboardUpdatedAt: null
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

  const ensurePlaceholderResources = (missing) => {
    missing.forEach((item) => {
      upsertResource(item.type, {
        name: item.name,
        description: item.description || '占位资源，待补齐',
        isAvailable: false,
        status: '待补齐',
        images: []
      });
    });
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
    addChapter,
    updateChapter,
    upsertResource,
    ensurePlaceholderResources,
    updateResourceImages,
    upsertRule,
    deleteRule,
    importRules
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
