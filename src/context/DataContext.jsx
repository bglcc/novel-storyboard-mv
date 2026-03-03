import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getImageById, storeImageData } from '../utils/imageStore';
import { DEFAULT_RESOURCE_KEYS } from '../config/resourceCategories';
import {
  ensureWorkspaceDirs,
  formatDateKey,
  hydrateWorkspaceHandle,
  isWorkspaceApiSupported,
  pickWorkspaceHandle,
  pruneOldBackupDirs,
  saveWorkspaceHandle,
  writeJsonFile
} from '../utils/workspaceFileSystem';

const DataContext = createContext();
const STORAGE_KEY = 'novel-storyboard-data';
const VERSION_KEY = 'novel-storyboard-version';

const defaultResources = DEFAULT_RESOURCE_KEYS.reduce((acc, key) => {
  acc[key] = [];
  return acc;
}, {});

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


  const [workspaceHandle, setWorkspaceHandle] = useState(null);
  const [workspaceState, setWorkspaceState] = useState({
    supported: isWorkspaceApiSupported(),
    connected: false,
    directoryName: '',
    lastSavedAt: null,
    error: '',
    errorCode: ''
  });
  const lastBackupHashRef = useRef('');
  const saveQueueRef = useRef(Promise.resolve());
  const latestSerializedRef = useRef('');
  const [conflictState, setConflictState] = useState({ hasConflict: false, latestVersion: '', localVersion: '' });

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

  const enqueueWorkspaceSave = (payload) => {
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        const serialized = JSON.stringify(payload);
        if (serialized === latestSerializedRef.current) return;
        localStorage.setItem(STORAGE_KEY, serialized);
        const saveSucceeded = await autoSaveToWorkspace(payload);
        if (saveSucceeded) {
          latestSerializedRef.current = serialized;
        }
      })
      .catch((error) => {
        console.error('Workspace save queue failed', error);
      });
    return saveQueueRef.current;
  };

  const writeSnapshotToWorkspace = async (snapshot) => {
    await ensureWorkspaceDirs(workspaceHandle);
    await writeJsonFile(workspaceHandle, 'volumeInfo', '全本信息.json', snapshot);
  };

  const writeShotDataToWorkspace = async (snapshot) => {
    const shotDataPayload = {
      savedAt: snapshot.savedAt,
      volumes: (snapshot.data?.novels || []).map((novel) => ({
        novelId: novel.id,
        novelTitle: novel.title,
        chapters: (novel.chapters || []).map((chapter, index) => ({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          volumeNumber: index + 1,
          shots: chapter.storyboardShots || []
        }))
      }))
    };
    await writeJsonFile(workspaceHandle, 'shotData', '分镜数据.json', shotDataPayload);
  };

  const autoSaveToWorkspace = async (currentData) => {
    if (!workspaceHandle || !workspaceState.connected) return true;
    const timestamp = Date.now();
    const snapshot = {
      savedAt: timestamp,
      data: currentData
    };

    try {
      await writeSnapshotToWorkspace(snapshot);
      await writeShotDataToWorkspace(snapshot);

      const currentHash = JSON.stringify(currentData);
      const nextVersion = `${timestamp}-${currentHash.slice(0, 12)}`;
      localStorage.setItem(VERSION_KEY, nextVersion);
      setConflictState({ hasConflict: false, latestVersion: nextVersion, localVersion: nextVersion });
      if (currentHash !== lastBackupHashRef.current) {
        const backupDate = formatDateKey(timestamp);
        const backupDir = await workspaceHandle.getDirectoryHandle('backup', { create: true });
        const dateDir = await backupDir.getDirectoryHandle(backupDate, { create: true });
        const moduleDir = await dateDir.getDirectoryHandle('volumeInfo', { create: true });
        const backupName = `全本信息_备份_${timestamp}.json`;
        const backupFile = await moduleDir.getFileHandle(backupName, { create: true });
        const writable = await backupFile.createWritable();
        await writable.write(JSON.stringify(snapshot, null, 2));
        await writable.close();
        lastBackupHashRef.current = currentHash;
      }

      try {
        await pruneOldBackupDirs(workspaceHandle, 7);
      } catch (pruneError) {
        console.warn('Failed to prune old backups', pruneError);
      }
      setWorkspaceState((prev) => ({ ...prev, lastSavedAt: timestamp, error: '', errorCode: '' }));
      return true;
    } catch (error) {
      console.error('Workspace save failed', error);
      const errName = error?.name || '';
      const isDirMissing = errName === 'NotFoundError';
      const isPermission = errName === 'NotAllowedError' || errName === 'SecurityError';

      if (isDirMissing) {
        try {
          await ensureWorkspaceDirs(workspaceHandle);
          await writeSnapshotToWorkspace(snapshot);
          await writeShotDataToWorkspace(snapshot);
          setWorkspaceState((prev) => ({ ...prev, lastSavedAt: timestamp, error: '', errorCode: '' }));
          return true;
        } catch (retryError) {
          console.error('Workspace retry save failed', retryError);
        }
      }

      const message = isDirMissing
        ? '资源库 / 备份等核心目录被修改或删除，请重新生成目录后重试。'
        : isPermission
          ? '目录写入权限失效，请重新授权目录后重试。'
          : '本地磁盘空间不足或写入失败，请清理磁盘或切换目录后重试。';
      const errorCode = isDirMissing ? 'DIR_MISSING' : isPermission ? 'PERMISSION' : 'WRITE_FAILED';
      setWorkspaceState((prev) => ({
        ...prev,
        error: message,
        errorCode
      }));
      return false;
    }
  };

  const connectWorkspace = async () => {
    if (!isWorkspaceApiSupported()) {
      setWorkspaceState((prev) => ({
        ...prev,
        supported: false,
        connected: false,
        error: '当前浏览器不支持本地目录授权，请使用 Chrome / Edge。',
        errorCode: 'UNSUPPORTED'
      }));
      return false;
    }

    try {
      const handle = await pickWorkspaceHandle();
      await ensureWorkspaceDirs(handle);
      await saveWorkspaceHandle(handle);
      setWorkspaceHandle(handle);
      setWorkspaceState((prev) => ({
        ...prev,
        supported: true,
        connected: true,
        directoryName: handle.name || '',
        error: '',
        errorCode: ''
      }));
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return false;
      }
      setWorkspaceState((prev) => ({
        ...prev,
        connected: false,
        error: error?.message || '目录授权失败，请重试。',
        errorCode: 'PERMISSION'
      }));
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const restoreWorkspace = async () => {
      try {
        const handle = await hydrateWorkspaceHandle();
        if (!handle || cancelled) return;
        await ensureWorkspaceDirs(handle);
        setWorkspaceHandle(handle);
        setWorkspaceState((prev) => ({
          ...prev,
          supported: true,
          connected: true,
          directoryName: handle.name || '',
          error: '',
          errorCode: ''
        }));
      } catch (error) {
        if (cancelled) return;
        setWorkspaceState((prev) => ({
          ...prev,
          connected: false,
          error: '工作目录不可用，请重新授权。',
          errorCode: 'PERMISSION'
        }));
      }
    };

    restoreWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const persist = async () => {
      const payload = await replaceImagesWithRefs(data);
      if (cancelled) return;
      await enqueueWorkspaceSave(payload);
    };
    persist();
    return () => {
      cancelled = true;
    };
  }, [data, workspaceHandle, workspaceState.connected]);

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

  const persistCurrentSnapshot = async () => {
    const payload = await replaceImagesWithRefs(data);
    await enqueueWorkspaceSave(payload);
  };

  const regenerateWorkspaceDirs = async () => {
    if (!workspaceHandle) return false;
    try {
      await ensureWorkspaceDirs(workspaceHandle);
      setWorkspaceState((prev) => ({ ...prev, error: '', errorCode: '' }));
      return true;
    } catch (error) {
      setWorkspaceState((prev) => ({ ...prev, error: '资源目录修复失败，请重新授权目录后重试。', errorCode: 'PERMISSION' }));
      return false;
    }
  };

  useEffect(() => {
    const syncVersionState = () => {
      const latest = localStorage.getItem(VERSION_KEY) || '';
      if (!latest) return;
      setConflictState((prev) => {
        if (!prev.localVersion) return { ...prev, latestVersion: latest, localVersion: latest, hasConflict: false };
        if (latest !== prev.localVersion) {
          return { ...prev, latestVersion: latest, hasConflict: true };
        }
        return prev;
      });
    };

    syncVersionState();
    window.addEventListener('focus', syncVersionState);
    window.addEventListener('storage', syncVersionState);
    return () => {
      window.removeEventListener('focus', syncVersionState);
      window.removeEventListener('storage', syncVersionState);
    };
  }, []);

  const resolveConflict = async (mode) => {
    if (!conflictState.hasConflict) return;
    if (mode === 'reload_latest') {
      window.location.reload();
      return;
    }
    setConflictState((prev) => ({ ...prev, hasConflict: false, localVersion: prev.latestVersion }));
    await persistCurrentSnapshot();
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
    importRules,
    workspaceState,
    connectWorkspace,
    regenerateWorkspaceDirs,
    conflictState,
    resolveConflict
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);