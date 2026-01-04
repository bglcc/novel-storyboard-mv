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
    props: []
  }
};

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
    return defaultData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const addNovel = (title) => {
    const newNovel = { id: uuidv4(), title, createdAt: Date.now(), chapters: [] };
    setData((prev) => ({ ...prev, novels: [...prev.novels, newNovel] }));
  };

  const deleteNovel = (id) => {
    setData((prev) => ({ ...prev, novels: prev.novels.filter((n) => n.id !== id) }));
  };

  const addChapter = (novelId, title) => {
    setData((prev) => ({
      ...prev,
      novels: prev.novels.map((novel) =>
        novel.id === novelId
          ? {
              ...novel,
              chapters: [
                ...novel.chapters,
                {
                  id: uuidv4(),
                  title,
                  status: '仅录入',
                  content: '',
                  storyboards: [],
                  storyboardUpdatedAt: null
                }
              ]
            }
          : novel
      )
    }));
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
      const existing = prev.resources[type].find((r) => r.id === resource.id || r.name === resource.name);
      const updatedList = existing
        ? prev.resources[type].map((r) => (r.id === existing.id ? { ...existing, ...resource } : r))
        : [...prev.resources[type], { ...resource, id: resource.id || uuidv4() }];
      return { ...prev, resources: { ...prev.resources, [type]: updatedList } };
    });
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
        [type]: prev.resources[type].map((r) =>
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
    updateResourceImages
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
