import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { saveFileWithFallback, sha256, validateFile } from '../utils/localFileBridge';
import { SHOT_LEVEL_CONFIG, FIELD_LABELS } from './StoryboardEditor/constants/shotLevelConfig';
import { RESOURCE_ABBREVIATIONS, RESOURCE_TYPE_LABELS } from './StoryboardEditor/constants/resourceConfig';
import { getShotValidation } from './StoryboardEditor/utils/validators';
import { migrateChapterStoryboard } from './StoryboardEditor/utils/migration';

const levels = [
  { value: 'L1', label: 'L1 静态单层' },
  { value: 'L2', label: 'L2 资源拟动' },
  { value: 'L3', label: 'L3 复杂动作' },
  { value: 'L4', label: 'L4 多人交互' }
];

const SHOT_TEMPLATES = [
  { id: 'subjective-closeup', label: '主观视角近景', level: 'L1', shotType: '近景', cameraAngle: '平视主观', sceneDescription: '主角主观视角观察关键对象', visualDescription: '画面聚焦主体细节，突出情绪与信息点', editMethod: '硬切到下一镜头', transitionToNext: '硬切' },
  { id: 'wide-establishing', label: '全景空镜', level: 'L1', shotType: '全景', cameraAngle: '高机位', sceneDescription: '交代环境关系和空间位置', visualDescription: '环境主体明确，画面留白用于后续剪辑衔接', editMethod: '淡入淡出', transitionToNext: '淡出' },
  { id: 'multi-mid', label: '多人交互中景', level: 'L4', shotType: '中景', cameraAngle: '平视', sceneDescription: '两个及以上角色在同一场景互动', visualDescription: '保留角色关系线与动作反馈节奏', editMethod: '轴线内切换', transitionToNext: '动作匹配切' },
  { id: 'detail-closeup', label: '特写镜头', level: 'L2', shotType: '特写', cameraAngle: '平视微仰', sceneDescription: '聚焦角色微表情或关键道具细节', visualDescription: '浅景深突出重点，背景简化', editMethod: '节奏点硬切', transitionToNext: '闪白切' },
  { id: 'dynamic-transition', label: '动态转场镜头', level: 'L3', shotType: '运动镜头', cameraAngle: '跟拍', sceneDescription: '镜头随主体移动完成场景转换', visualDescription: '以运动方向引导视线并衔接下一场景', editMethod: '运动转场', transitionToNext: '推拉转场' }
];


const baseFrameFields = {
  title: '',
  shotType: '',
  cameraAngle: '',
  sceneDescription: '',
  shotTime: '',
  visualDescription: '',
  editMethod: ''
};

const makeOutlineItem = (index) => ({
  id: crypto.randomUUID(),
  order: index + 1,
  text: `核心镜头脉络 ${index + 1}`,
  detailUploaded: false
});

const makeResource = (type = 'characters') => ({
  id: crypto.randomUUID(),
  type,
  name: '',
  subType: '',
  prompt: '',
  status: 'missing',
  fileName: '',
  localPath: '',
  remoteUrl: '',
  preview: '',
  updatedAt: null
});

const makeKeyframe = (index) => ({
  id: crypto.randomUUID(),
  name: `关键帧 ${index + 1}`,
  ...baseFrameFields,
  resources: [],
  imageAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  videoAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null }
});

const makeShot = (index, outlineIndex = index) => ({
  id: crypto.randomUUID(),
  shotNumber: `Shot-${String(index + 1).padStart(3, '0')}`,
  outlineIndex,
  synopsis: '',
  level: 'L1',
  ...baseFrameFields,
  resources: [],
  keyframesEnabled: false,
  keyframes: [],
  imageAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  videoAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  transitionToNext: '',
  completed: false,
  completedAt: null
});

const getResourceTypeLabel = (type) => RESOURCE_TYPE_LABELS[type] || type;

const toShotNumber = (index) => `Shot-${String(index + 1).padStart(3, '0')}`;

const withReorderedShotNumbers = (shots = []) =>
  shots.map((shot, index) => ({
    ...shot,
    shotNumber: toShotNumber(index)
  }));

const getResourceNamePrefix = (type) => RESOURCE_ABBREVIATIONS[type] || 'RS';

const normalizeResourceName = ({ type, name, resources, currentId }) => {
  const cleanedName = String(name || '').trim() || '未命名';
  const prefix = getResourceNamePrefix(type);
  const base = `${prefix}-${String(1).padStart(3, '0')} - ${cleanedName}`;

  const existing = new Set(
    (resources || [])
      .filter((item) => item.id !== currentId)
      .map((item) => String(item.name || '').trim())
      .filter(Boolean)
  );

  if (!existing.has(base)) return { nextName: base, deduped: false };

  let suffix = 1;
  let candidate = `${base}_${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return { nextName: candidate, deduped: true };
};

const readFilePreview = async (file) => {
  if (!file) return '';
  return URL.createObjectURL(file);
};

const safelyRevokePreview = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const parseLenientJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    let cleaned = String(text || '').replace(/^[\uFEFF\s]+/, '').trim();
    cleaned = cleaned
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '"$1":')
      .replace(/:\s*'([^']*?)'/g, ': "$1"')
      .replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(cleaned);
    } catch (secondError) {
      throw new Error(`JSON解析错误：${secondError.message}`);
    }
  }
};


const isAllowedFileType = (file, mode = 'resource') => {
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (!ext) return false;
  const imageExt = ['png', 'jpg', 'jpeg', 'webp'];
  const videoExt = ['mp4', 'mov'];
  if (mode === 'image') return imageExt.includes(ext);
  if (mode === 'video') return videoExt.includes(ext);
  return [...imageExt, ...videoExt].includes(ext);
};


const parseResourceAbbr = (value) => {
  const raw = String(value || '').trim();
  const parts = raw.split(/-+/).map((item) => item.trim()).filter(Boolean);
  if (parts.length < 3) {
    return { id: crypto.randomUUID(), type: 'characters', code: 'unknown', name: raw || '未命名资源', status: 'uploaded' };
  }
  const [abbr, code, ...rest] = parts;
  const type = Object.keys(RESOURCE_ABBREVIATIONS).find((key) => RESOURCE_ABBREVIATIONS[key] === abbr) || 'characters';
  return {
    id: crypto.randomUUID(),
    type,
    code,
    name: rest.join('-') || '未命名资源',
    status: 'uploaded',
    fileName: '',
    localPath: '',
    remoteUrl: '',
    preview: '',
    updatedAt: null
  };
};

const StoryboardEditor = ({ novelId, chapter }) => {
  const { updateChapter } = useData();
  const [activeOutlineId, setActiveOutlineId] = useState(chapter.storyboardOutlineItems?.[0]?.id || '');
  const [activeShotId, setActiveShotId] = useState(chapter.storyboardShots?.[0]?.id || '');
  const [activeFrameId, setActiveFrameId] = useState('main');
  const [zoomPreview, setZoomPreview] = useState(null);
  const [highlightIncompleteShotId, setHighlightIncompleteShotId] = useState('');
  const [draggingShotId, setDraggingShotId] = useState('');
  const [activeSideTab, setActiveSideTab] = useState('resources');
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const replaceInputRef = useRef(null);
  const outlineUploadRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const [expandedFolders, setExpandedFolders] = useState({
    missing: true,
    uploaded: false,
    imageUpload: true,
    videoUpload: true
  });

  const outlineItems = chapter.storyboardOutlineItems || [];
  const shots = chapter.storyboardShots || [];

  const activeShot = useMemo(() => shots.find((item) => item.id === activeShotId) || null, [shots, activeShotId]);

  const activeFrame = useMemo(() => {
    if (!activeShot) return null;
    if (activeFrameId === 'main' || !activeShot.keyframesEnabled) return activeShot;
    return activeShot.keyframes?.find((frame) => frame.id === activeFrameId) || activeShot;
  }, [activeFrameId, activeShot]);

  const groupedShots = useMemo(
    () =>
      outlineItems.map((outline, outlineIndex) => ({
        outline,
        outlineIndex,
        shots: shots.filter((shot) => shot.outlineIndex === outlineIndex)
      })),
    [outlineItems, shots]
  );

  const pushToast = (message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2200);
  };


  const shotValidationById = useMemo(
    () =>
      shots.reduce((acc, shot) => {
        acc[shot.id] = getShotValidation(shot);
        return acc;
      }, {}),
    [shots]
  );


  const activeLevelRequiredFields = useMemo(() => {
    const level = activeShot?.level || 'L1';
    const config = SHOT_LEVEL_CONFIG[level] || SHOT_LEVEL_CONFIG.L1;
    return (config.requiredFields || []).map((field) => FIELD_LABELS[field] || field);
  }, [activeShot]);

  useEffect(() => {
    const migrationPatch = migrateChapterStoryboard(chapter);
    if (migrationPatch) {
      updateChapterPatch((currentChapter) => ({
        editingWorkflow: {
          ...(currentChapter.editingWorkflow || {}),
          ...(migrationPatch.editingWorkflow || {})
        }
      }));
    }
  }, [chapter]);

  const toggleFolder = (key) =>
    setExpandedFolders((prev) => {
      if (key === 'missing') {
        return { ...prev, missing: true, uploaded: false };
      }
      if (key === 'uploaded') {
        return { ...prev, missing: false, uploaded: true };
      }
      return { ...prev, [key]: !prev[key] };
    });

  const updateChapterPatch = (patchOrUpdater) => {
    updateChapter(novelId, chapter.id, (currentChapter) => {
      const resolvedPatch =
        typeof patchOrUpdater === 'function' ? patchOrUpdater(currentChapter) : patchOrUpdater;
      return {
        ...(resolvedPatch || {}),
        storyboardUpdatedAt: Date.now()
      };
    });
  };

  const ensureNoDuplicateHash = async (file) => {
    const hash = await sha256(file);
    let duplicate = false;
    let existingPath = '';

    updateChapterPatch((currentChapter) => {
      const workflow = currentChapter.editingWorkflow || {};
      const existing = workflow.fileHashes || [];
      const hashMap = workflow.fileHashMap || {};
      if (existing.includes(hash)) {
        duplicate = true;
        existingPath = hashMap[hash] || '';
        return {};
      }
      return {
        editingWorkflow: {
          ...workflow,
          fileHashes: [...existing, hash],
          fileHashMap: {
            ...hashMap,
            [hash]: ''
          }
        }
      };
    });

    return { duplicate, hash, existingPath };
  };

  const applyFileHashPath = (hash, localPath) => {
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        fileHashMap: {
          ...((currentChapter.editingWorkflow || {}).fileHashMap || {}),
          [hash]: localPath || ''
        }
      }
    }));
  };

  const updateAllAssetsByHash = (hash, payload) => {
    updateChapterPatch((currentChapter) => {
      const nextShots = (currentChapter.storyboardShots || []).map((shot) => {
        const mainResources = (shot.resources || []).map((resource) => {
          if (resource.fileHash !== hash) return resource;
          return { ...resource, ...payload, updatedAt: Date.now(), status: 'uploaded' };
        });
        const keyframes = (shot.keyframes || []).map((frame) => ({
          ...frame,
          resources: (frame.resources || []).map((resource) => {
            if (resource.fileHash !== hash) return resource;
            return { ...resource, ...payload, updatedAt: Date.now(), status: 'uploaded' };
          })
        }));
        return { ...shot, resources: mainResources, keyframes };
      });

      return { storyboardShots: nextShots };
    });
  };

  const buildTargetPath = (resourceType = 'misc', subType = '') => {
    const chapterName = `${chapter.id}-${chapter.title || 'untitled'}`;
    const safeType = resourceType || 'misc';
    const safeSubType = subType || 'default';
    return `${novelId}/${chapterName}/${safeType}/${safeSubType}`;
  };

  const syncShotStatus = (nextShots) => {
    const normalized = withReorderedShotNumbers(nextShots).map((shot) => {
      const validation = getShotValidation(shot);
      const done = validation.isValid;
      return {
        ...shot,
        completed: done,
        completedAt: done ? shot.completedAt || Date.now() : null,
        missingRequirements: validation.missingLabels
      };
    });
    const clipExportReady = normalized.length > 0 && normalized.every((shot) => shot.completed);
    updateChapterPatch((currentChapter) => ({
      storyboardShots: normalized,
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        clipExportReady
      },
      status: clipExportReady ? '分镜完成' : '分镜制作中'
    }));
  };

  const addOutline = () => {
    const next = [...outlineItems, makeOutlineItem(outlineItems.length)];
    updateChapterPatch({ storyboardOutlineItems: next, storyboardOutlineUpdatedAt: Date.now() });
    setActiveOutlineId(next[next.length - 1]?.id || '');
  };

  const updateOutline = (id, patch) => {
    const next = outlineItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
    updateChapterPatch({ storyboardOutlineItems: next, storyboardOutlineUpdatedAt: Date.now() });
  };

  const uploadAllOutlineItems = async (file) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = parseLenientJson(raw);
      const source = Array.isArray(parsed?.shot_logic_chain)
        ? parsed.shot_logic_chain
        : Array.isArray(parsed?.storyboardOutlineItems)
          ? parsed.storyboardOutlineItems
          : Array.isArray(parsed?.outlineItems)
            ? parsed.outlineItems
            : Array.isArray(parsed)
              ? parsed
              : [];

      if (!Array.isArray(source) || source.length === 0) {
        pushToast('上传失败：未识别到镜头逻辑链数组。','error');
        return;
      }

      const fromLegacy = !Array.isArray(parsed?.shot_logic_chain);
      const sceneId = parsed?.sceneId || '';
      const sceneName = parsed?.sceneName || '';

      const nextShots = source.map((item, index) => {
        const isNewShape = item?.mainFrame || item?.shotNumber;
        const mainFrame = item?.mainFrame || {};
        const resourcesRaw = mainFrame?.resources || item?.resources || [];
        const resources = (Array.isArray(resourcesRaw) ? resourcesRaw : [])
          .map((resource) => (typeof resource === 'string' ? parseResourceAbbr(resource) : resource))
          .map((resource) => ({
            id: resource?.id || crypto.randomUUID(),
            type: resource?.type || 'characters',
            name: resource?.name || '未命名资源',
            status: resource?.status || 'uploaded',
            subType: resource?.subType || '',
            prompt: resource?.prompt || '',
            fileName: resource?.fileName || '',
            localPath: resource?.localPath || '',
            remoteUrl: resource?.remoteUrl || '',
            preview: resource?.preview || '',
            updatedAt: resource?.updatedAt || null
          }));

        return {
          id: item?.id || crypto.randomUUID(),
          shotNumber: item?.shotNumber || toShotNumber(index),
          outlineIndex: Number.isFinite(item?.outlineIndex)
            ? item.outlineIndex
            : ((chapter?.storyboardOutlineItems?.length || 0) > 0 ? 0 : -1),
          synopsis: item?.synopsis || item?.text || item?.outlineText || item?.content || '',
          level: item?.level || 'L1',
          keyframesEnabled: item?.frameMode === 'keyframes',
          keyframes: Array.isArray(item?.keyframes) ? item.keyframes : [],
          title: mainFrame?.title || item?.title || '',
          shotType: mainFrame?.shotType || item?.shotType || '',
          cameraAngle: mainFrame?.cameraAngle || item?.cameraAngle || '',
          sceneDescription: mainFrame?.sceneDescription || item?.sceneDescription || sceneName,
          shotTime: item?.shotTime || '',
          visualDescription: mainFrame?.visualDescription || item?.visualDescription || '',
          editMethod: mainFrame?.editMethod || item?.editMethod || '',
          transitionToNext: item?.transitionToNext || mainFrame?.transitionToNext || '',
          duration: Number(mainFrame?.duration ?? item?.duration ?? 3) || 3,
          imageAsset: mainFrame?.imageAsset || item?.imageAsset || { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
          videoAsset: mainFrame?.videoAsset || item?.videoAsset || { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
          resources,
          completed: item?.status === 'completed' || item?.completed === true,
          completedAt: item?.updatedAt || item?.completedAt || null,
          status: item?.status || (item?.completed ? 'completed' : 'pending'),
          audioPlaceholders: {
            dialogue: item?.audioPlaceholders?.dialogue || item?.dialoguePlaceholder || '',
            bgm: item?.audioPlaceholders?.bgm || item?.bgmPlaceholder || '',
            sfx: item?.audioPlaceholders?.sfx || item?.sfxPlaceholder || ''
          },
          dialoguePlaceholder: item?.dialoguePlaceholder || item?.audioPlaceholders?.dialogue || '',
          bgmPlaceholder: item?.bgmPlaceholder || item?.audioPlaceholders?.bgm || '',
          sfxPlaceholder: item?.sfxPlaceholder || item?.audioPlaceholders?.sfx || ''
        };
      });

      syncShotStatus(nextShots);
      setActiveShotId(nextShots[0]?.id || '');
      setActiveFrameId('main');

      updateChapterPatch((currentChapter) => ({
        storyboardOutlineItems: [{ id: crypto.randomUUID(), order: 1, text: `${sceneName || '默认场景'}镜头逻辑链`, detailUploaded: true }],
        editingWorkflow: {
          ...(currentChapter?.editingWorkflow || {}),
          sceneId,
          sceneName
        }
      }));

      if (nextShots.some((shot) => shot.outlineIndex === -1)) {
        updateChapterPatch((currentChapter) => {
          const defaultOutline = makeOutlineItem(0);
          const patchedShots = (currentChapter?.storyboardShots || []).map((shot) =>
            shot.outlineIndex === -1 ? { ...shot, outlineIndex: 0 } : shot
          );
          return {
            storyboardOutlineItems: [defaultOutline],
            storyboardShots: patchedShots
          };
        });
      }

      if (fromLegacy) {
        pushToast('检测到旧版分镜数据，已自动转换为新格式，建议补充场景关联等信息。','warning');
      } else {
        pushToast(`成功导入 ${nextShots.length} 条镜头逻辑链数据。`,'success');
      }
    } catch (error) {
      pushToast(`上传失败：${error instanceof Error ? error.message : '未知错误'}`,'error');
    }
  };

  const addShot = (outlineIndex = 0) => {
    const shot = makeShot(shots.length, outlineIndex);
    const targetIndex = activeShotId ? shots.findIndex((item) => item.id === activeShotId) + 1 : shots.length;
    const safeIndex = targetIndex > 0 ? targetIndex : shots.length;
    const next = [...shots.slice(0, safeIndex), shot, ...shots.slice(safeIndex)];
    syncShotStatus(next);
    setActiveOutlineId(outlineItems[outlineIndex]?.id || '');
    setActiveShotId(shot.id);
    setActiveFrameId('main');
  };

  const moveShot = (dragShotId, targetShotId, targetOutlineIndex) => {
    if (!dragShotId) return;
    const dragIndex = shots.findIndex((shot) => shot.id === dragShotId);
    if (dragIndex < 0) return;

    const moving = { ...shots[dragIndex] };
    moving.outlineIndex = Number.isInteger(targetOutlineIndex) ? targetOutlineIndex : moving.outlineIndex;

    const removed = shots.filter((shot) => shot.id !== dragShotId);
    const targetIndex = targetShotId ? removed.findIndex((shot) => shot.id === targetShotId) : removed.length;
    const safeIndex = targetIndex >= 0 ? targetIndex : removed.length;
    const next = [...removed.slice(0, safeIndex), moving, ...removed.slice(safeIndex)];
    syncShotStatus(next);
  };

  const updateShot = (shotId, patch) => {
    const next = shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot));
    syncShotStatus(next);
  };


  const deleteShot = (shotId) => {
    const next = shots.filter((shot) => shot.id !== shotId);
    syncShotStatus(next);
    if (activeShotId === shotId) {
      const fallback = next[0]?.id || '';
      setActiveShotId(fallback);
      setActiveFrameId('main');
    }
  };

  const updateActiveFrame = (patch) => {
    if (!activeShot || !activeFrame) return;
    if (activeFrameId === 'main') {
      updateShot(activeShot.id, patch);
      return;
    }
    const nextKeyframes = (activeShot.keyframes || []).map((frame) =>
      frame.id === activeFrameId ? { ...frame, ...patch } : frame
    );
    updateShot(activeShot.id, { keyframes: nextKeyframes });
  };

  const toggleKeyframes = (enabled) => {
    if (!activeShot) return;
    if (enabled) {
      const keyframes = (activeShot.keyframes || []).length ? activeShot.keyframes : [makeKeyframe(0)];
      updateShot(activeShot.id, { keyframesEnabled: true, keyframes });
      setActiveFrameId(keyframes[0].id);
    } else {
      updateShot(activeShot.id, { keyframesEnabled: false });
      setActiveFrameId('main');
    }
  };

  const addKeyframe = () => {
    if (!activeShot) return;
    const next = [...(activeShot.keyframes || []), makeKeyframe((activeShot.keyframes || []).length)];
    updateShot(activeShot.id, { keyframes: next, keyframesEnabled: true });
    setActiveFrameId(next[next.length - 1].id);
  };

  const addResource = () => {
    if (!activeFrame) return;
    updateActiveFrame({ resources: [...(activeFrame.resources || []), makeResource()] });
  };

  const updateResource = (resourceId, patch) => {
    if (!activeFrame) return;
    const nextResources = (activeFrame.resources || []).map((resource) => {
      if (resource.id !== resourceId) return resource;
      const merged = { ...resource, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'name') || Object.prototype.hasOwnProperty.call(patch, 'type')) {
        const { nextName, deduped } = normalizeResourceName({
          type: merged.type,
          name: merged.name,
          resources: activeFrame.resources,
          currentId: resourceId
        });
        if (deduped) {
          pushToast('名称重复，已自动补充后缀。','warning');
        }
        return { ...merged, name: nextName };
      }
      return merged;
    });
    updateActiveFrame({ resources: nextResources });
  };

  const uploadResourceFile = async (resourceId, file) => {
    if (!file || !activeFrame) return;
    const check = validateFile(file);
    if (!check.ok) {
      pushToast(check.message,'error');
      return;
    }
    if (!isAllowedFileType(file, 'resource')) {
      pushToast('仅支持 png/jpg/jpeg/webp/mp4/mov 格式。','error');
      return;
    }

    try {
      const { duplicate, hash } = await ensureNoDuplicateHash(file);
      if (duplicate) {
        const confirmed = window.confirm('检测到重复文件，是否覆盖并同步更新所有同 hash 资源路径？');
        if (!confirmed) {
          pushToast('已取消覆盖。', 'warning');
          return;
        }
      }

      const resource = (activeFrame.resources || []).find((item) => item.id === resourceId);
      const targetPath = buildTargetPath(resource?.type, resource?.subType);
      const [saveResult, preview] = await Promise.all([
        saveFileWithFallback({ file, targetPath }),
        readFilePreview(file)
      ]);
      if (preview) previewUrlsRef.current.add(preview);
      safelyRevokePreview(resource?.preview);
      if (resource?.preview) previewUrlsRef.current.delete(resource.preview);

      updateResource(resourceId, {
        status: 'uploaded',
        fileName: file.name,
        localPath: saveResult.localPath,
        preview,
        updatedAt: Date.now(),
        sourceType: saveResult.source,
        fileHash: hash
      });
      applyFileHashPath(hash, saveResult.localPath);
      updateAllAssetsByHash(hash, {
        fileName: file.name,
        localPath: saveResult.localPath,
        preview,
        sourceType: saveResult.source,
        fileHash: hash
      });

      if (saveResult.error) {
        pushToast('本地服务不可用，已使用本地占位路径保存记录。','warning');
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '资源上传失败，请重试。','error');
    }
  };

  const uploadFrameAsset = async (field, file) => {
    if (!file || !activeFrame) return;
    const check = validateFile(file);
    if (!check.ok) {
      pushToast(check.message,'error');
      return;
    }
    const mode = field === 'videoAsset' ? 'video' : 'image';
    if (!isAllowedFileType(file, mode)) {
      pushToast(mode === 'video' ? '视频仅支持 mp4/mov 格式。' : '图片仅支持 png/jpg/jpeg/webp 格式。','error');
      return;
    }

    try {
      const { duplicate, hash } = await ensureNoDuplicateHash(file);
      if (duplicate) {
        const confirmed = window.confirm('检测到重复文件，是否覆盖当前素材？');
        if (!confirmed) {
          pushToast('已取消覆盖。', 'warning');
          return;
        }
      }

      const targetPath = buildTargetPath('shot-assets', activeShot?.level || 'L1');
      const [saveResult, preview] = await Promise.all([
        saveFileWithFallback({ file, targetPath }),
        readFilePreview(file)
      ]);
      if (preview) previewUrlsRef.current.add(preview);
      safelyRevokePreview(activeFrame?.[field]?.preview);
      if (activeFrame?.[field]?.preview) previewUrlsRef.current.delete(activeFrame?.[field]?.preview);

      updateActiveFrame({
        [field]: {
          fileName: file.name,
          localPath: saveResult.localPath,
          remoteUrl: '',
          preview,
          updatedAt: Date.now(),
          sourceType: saveResult.source,
          fileHash: hash
        }
      });
      applyFileHashPath(hash, saveResult.localPath);

      if (saveResult.error) {
        pushToast('本地服务不可用，已使用本地占位路径保存记录。','warning');
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '素材上传失败，请重试。','error');
    }
  };

  const exportClipPackage = () => {
    const payload = {
      novelId,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      generatedAt: new Date().toISOString(),
      chapterSummary: chapter.editingWorkflow?.chapterSummary || '',
      shots: shots.map((shot) => ({
        shotNumber: shot.shotNumber,
        level: shot.level,
        synopsis: shot.synopsis,
        frameMode: shot.keyframesEnabled ? 'keyframes' : 'single',
        mainFrame: {
          title: shot.title,
          shotType: shot.shotType,
          cameraAngle: shot.cameraAngle,
          sceneDescription: shot.sceneDescription,
          shotTime: shot.shotTime,
          visualDescription: shot.visualDescription,
          editMethod: shot.editMethod,
          transitionToNext: shot.transitionToNext || '',
          resources: shot.resources,
          imageAsset: shot.imageAsset,
          videoAsset: shot.videoAsset
        },
        keyframes: shot.keyframes || [],
        audioPlaceholders: {
          dialogue: shot.audioPlaceholders?.dialogue || shot.dialoguePlaceholder || '',
          bgm: shot.audioPlaceholders?.bgm || shot.bgmPlaceholder || '',
          sfx: shot.audioPlaceholders?.sfx || shot.sfxPlaceholder || ''
        }
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-to-jianying.json`;
    link.click();
    URL.revokeObjectURL(url);
    updateChapterPatch({ finalPackageDownloadedAt: Date.now() });
  };

  const handleClipExportClick = () => {
    const invalidShots = shots
      .map((shot) => ({ shot, validation: getShotValidation(shot) }))
      .filter((item) => !item.validation.isValid);

    if (invalidShots.length > 0) {
      const firstIncomplete = invalidShots[0].shot;
      setActiveShotId(firstIncomplete?.id || '');
      setActiveFrameId('main');
      const relatedOutline = outlineItems[firstIncomplete?.outlineIndex ?? 0];
      if (relatedOutline) setActiveOutlineId(relatedOutline.id);
      setHighlightIncompleteShotId((prev) => (prev === firstIncomplete?.id ? '' : firstIncomplete?.id || ''));
      const detail = invalidShots
        .map((item) => `${item.shot.shotNumber}（${item.shot.level}）：${item.validation.missingLabels.join('、')}`)
        .join('\n');
      pushToast(`导出失败，存在未通过校验的镜头：${detail}`,'error');
      return;
    }
    setHighlightIncompleteShotId('');
    exportClipPackage();
  };

  const updateClipScript = (value) => {
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        clipScriptText: value,
        clipScriptUpdatedAt: Date.now()
      }
    }));
  };

  const updateChapterSummary = (value) => {
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        chapterSummary: value,
        chapterSummaryUpdatedAt: Date.now()
      }
    }));
  };

  const saveCurrentShotChecklist = () => {
    if (!activeShot) {
      pushToast('请先选择镜头。', 'warning');
      return;
    }
    updateShot(activeShot.id, { checklistSavedAt: Date.now() });
    pushToast(`已保存当前镜头 ${activeShot.shotNumber} 清单。`, 'success');
  };

  const saveAllStoryboard = () => {
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        fullStoryboardSavedAt: Date.now()
      }
    }));
    pushToast('已保存全局分镜数据。', 'success');
  };

  const applyShotTemplate = (template) => {
    if (!activeShot || !template) return;
    updateShot(activeShot.id, {
      level: template.level,
      shotType: template.shotType,
      cameraAngle: template.cameraAngle,
      sceneDescription: template.sceneDescription,
      visualDescription: template.visualDescription,
      editMethod: template.editMethod,
      transitionToNext: template.transitionToNext
    });
    setShowTemplateMenu(false);
    pushToast(`已套用模板：${template.label}`, 'success');
  };

  const triggerPreviewDownload = (src, fileName) => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName || 'resource';
    link.click();
  };

  const openZoomPreview = (config) => setZoomPreview(config);

  const applyZoomReplacement = (file) => {
    if (!file || !zoomPreview) return;
    if (zoomPreview.type === 'resource') {
      uploadResourceFile(zoomPreview.resourceId, file);
      return;
    }
    if (zoomPreview.type === 'asset') {
      uploadFrameAsset(zoomPreview.field, file);
    }
  };

  const missingResources = (activeFrame?.resources || []).filter((item) => item.status !== 'uploaded');
  const uploadedResources = (activeFrame?.resources || []).filter((item) => item.status === 'uploaded');
  const needsImageUpload = activeShot && ['L1', 'L3'].includes(activeShot.level);
  const needsVideoUpload = activeShot && activeShot.level === 'L3';
  const resourceStoragePath = buildTargetPath('characters', 'default');
  const frameAssetStoragePath = buildTargetPath('shot-assets', activeShot?.level || 'L1');

  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [dragTarget, setDragTarget] = useState('');

  useEffect(() => {
    if (!dragTarget) return undefined;
    const handleMove = (event) => {
      const viewport = window.innerWidth;
      if (dragTarget === 'left') {
        const next = Math.min(Math.max(event.clientX - 20, 260), 520);
        setLeftPanelWidth(next);
      }
      if (dragTarget === 'right') {
        const next = Math.min(Math.max(viewport - event.clientX - 20, 300), 520);
        setRightPanelWidth(next);
      }
    };
    const stopDrag = () => setDragTarget('');
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [dragTarget]);


  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => safelyRevokePreview(url));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setShowTemplateMenu((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  return (
    <div
      className={`storyboard-workspace ${dragTarget ? 'resizing' : ''}`}
      style={{ '--left-panel-width': `${leftPanelWidth}px`, '--right-panel-width': `${rightPanelWidth}px` }}
    >
      <section className="storyboard-editor-panel">
        <div className="storyboard-editor-header">
          <h3>镜头编辑</h3>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="button-secondary" onClick={() => setShowTemplateMenu((prev) => !prev)}>模板 (Ctrl+T)</button>
            <button type="button" onClick={saveCurrentShotChecklist}>保存清单</button>
          </div>
        </div>
        <div className="storyboard-editor-scroll">
          {!activeShot && <div className="empty">请选择中部镜头后进行编辑。</div>}
          {activeShot && (
            <div className="card subtle shot-editor-card fixed-card">
              <div className="section-header compact">
                <h3>镜头编辑</h3>
                <div className="row">
                  <label className="row" style={{ gap: 6 }}>
                    层级
                    <select
                      value={activeShot.level}
                      onChange={(event) => updateShot(activeShot.id, { level: event.target.value })}
                    >
                      {levels.map((level) => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="row" style={{ gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={activeShot.keyframesEnabled}
                      onChange={(event) => toggleKeyframes(event.target.checked)}
                    />
                    关键帧
                  </label>
                </div>
              </div>
              {!shotValidationById[activeShot.id]?.isValid && (
                <div className="muted" style={{ color: '#F5222D' }}>
                  缺失项：{(shotValidationById[activeShot.id]?.missingLabels || []).join('、')}
                </div>
              )}

              {activeShot.keyframesEnabled && (
                <div className="row wrap" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className={`tab ${activeFrameId === 'main' ? 'active' : ''}`}
                    onClick={() => setActiveFrameId('main')}
                  >
                    主镜头
                  </button>
                  {(activeShot.keyframes || []).map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      className={`tab ${activeFrameId === frame.id ? 'active' : ''}`}
                      onClick={() => setActiveFrameId(frame.id)}
                    >
                      {frame.name}
                    </button>
                  ))}
                  <button type="button" className="tab" onClick={addKeyframe}>+ 关键帧</button>
                </div>
              )}

              {activeFrame && (
                <div className="storyboard-form-grid compact-grid">
                  <label>
                    标题
                    <input
                      value={activeFrame.title || ''}
                      onChange={(event) => updateActiveFrame({ title: event.target.value })}
                    />
                  </label>
                  <label>
                    镜头类型
                    <input
                      value={activeFrame.shotType || ''}
                      onChange={(event) => updateActiveFrame({ shotType: event.target.value })}
                    />
                  </label>
                  <label>
                    机位角度
                    <input
                      value={activeFrame.cameraAngle || ''}
                      onChange={(event) => updateActiveFrame({ cameraAngle: event.target.value })}
                    />
                  </label>
                  <label>
                    时间
                    <input
                      value={activeFrame.shotTime || ''}
                      onChange={(event) => updateActiveFrame({ shotTime: event.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    分镜描述
                    <textarea
                      className="large-input compact-input"
                      value={activeShot.synopsis || ''}
                      onChange={(event) => updateShot(activeShot.id, { synopsis: event.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    场景描述
                    <textarea
                      className="large-input compact-input"
                      value={activeFrame.sceneDescription || ''}
                      onChange={(event) => updateActiveFrame({ sceneDescription: event.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    画面描述
                    <textarea
                      className="large-input compact-input"
                      value={activeFrame.visualDescription || ''}
                      onChange={(event) => updateActiveFrame({ visualDescription: event.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    剪辑方法
                    <textarea
                      className="large-input compact-input"
                      value={activeFrame.editMethod || ''}
                      onChange={(event) => updateActiveFrame({ editMethod: event.target.value })}
                    />
                  </label>
                  <label className="span-2">
                    转场标注（到下一镜）
                    <input
                      value={activeShot.transitionToNext || ''}
                      onChange={(event) => updateShot(activeShot.id, { transitionToNext: event.target.value })}
                      placeholder="例如：硬切 / 淡出 / 动作匹配切"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div
        className="panel-resizer"
        onMouseDown={() => setDragTarget('left')}
        role="separator"
        aria-label="调整左侧面板宽度"
      />

      <section className="storyboard-main-panel">
        <div className="storyboard-main-header sticky">
          <h3>分镜头工作区</h3>
          <div className="row">
            <button type="button" className="button-secondary" onClick={saveAllStoryboard}>保存</button>
            <button type="button" className="button-secondary" onClick={() => outlineUploadRef.current?.click()}>
              导入逐镜清单
            </button>
            <input
              ref={outlineUploadRef}
              type="file"
              accept="application/json,text/plain"
              style={{ display: 'none' }}
              onChange={(event) => uploadAllOutlineItems(event.target.files?.[0])}
            />
            <button
              type="button"
              className={`clip-export-top-button ${chapter.editingWorkflow?.clipExportReady ? 'ready' : 'pending'}`}
              onClick={handleClipExportClick}
              disabled={!chapter?.editingWorkflow?.clipExportReady}
              title={!chapter?.editingWorkflow?.clipExportReady ? '存在未完善镜头，请补全必填项。' : '导出剪映清单'}
            >
              导出剪映清单
            </button>
          </div>
        </div>

        <div className="storyboard-main-scroll">
          <div className="section-header">
            <h3>核心镜头脉络</h3>
            <div className="row" style={{ gap: 8 }}>
              <label className="row" style={{ gap: 6 }}>
                时间轴缩放
                <input type="range" min="0.8" max="1.2" step="0.1" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} />
                <span>{timelineZoom.toFixed(1)}x</span>
              </label>
              <button type="button" onClick={addOutline}>新增场景</button>
            </div>
          </div>

          <div className="outline-list">
            {groupedShots.map(({ outline, outlineIndex, shots: outlineShots }) => (
              <div
                key={outline.id}
                className={`outline-row ${activeOutlineId === outline.id ? 'active' : ''}`}
                onMouseEnter={() => setActiveOutlineId(outline.id)}
              >
                <div className="outline-row-top">
                  <strong>#{outline.order}</strong>
                  <div className="row">
                    <span className={`status-pill ${outline.detailUploaded ? 'green' : 'orange'}`}>
                      {outline.detailUploaded ? '场景已关联' : '待补充场景'}
                    </span>
                    <button type="button" className="tab" onClick={() => addShot(outlineIndex)}>新增镜头</button>
                  </div>
                </div>
                <input
                  className="outline-inline-input"
                  value={outline.text}
                  onChange={(event) => updateOutline(outline.id, { text: event.target.value })}
                  placeholder="输入场景或镜头逻辑链描述（建议 1-2 句）"
                />

                <div
                  className="outline-shot-list"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingShotId) {
                      moveShot(draggingShotId, null, outlineIndex);
                      setDraggingShotId('');
                    }
                  }}
                >
                  {outlineShots.map((shot) => {
                    const validation = shotValidationById[shot.id] || { isValid: true, missingLabels: [] };
                    return (
                      <button
                        key={shot.shotNumber}
                        type="button"
                        draggable
                        title={validation.isValid ? '' : `缺失：${validation.missingLabels.join('、')}`}
                        className={`shot-row ${activeShotId === shot.id ? 'active' : ''} ${highlightIncompleteShotId === shot.id ? 'highlight-danger' : ''} ${!validation.isValid ? 'highlight-danger' : ''}`}
                        style={{
                          gridTemplateColumns: `${95 * timelineZoom}px minmax(${180 * timelineZoom}px,1fr) ${70 * timelineZoom}px ${70 * timelineZoom}px 48px`,
                          gap: `${8 * timelineZoom}px`,
                          padding: `${8 * timelineZoom}px`
                        }}
                        onDragStart={() => setDraggingShotId(shot.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveShot(draggingShotId, shot.id, outlineIndex);
                          setDraggingShotId('');
                        }}
                        onClick={() => {
                          setActiveShotId(shot.id);
                          setActiveFrameId('main');
                          setHighlightIncompleteShotId('');
                        }}
                      >
                        <span>#{shot.shotNumber}</span>
                        <span>{shot.synopsis || shot.title || '未命名镜头'}</span>
                        <span>{shot.level}</span>
                        <span>{shot.completed ? '完成' : '未完善'}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteShot(shot.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteShot(shot.id);
                            }
                          }}
                        >
                          删除
                        </span>
                      </button>
                    );
                  })}
                  {outlineShots.length === 0 && <div className="empty">当前大纲暂无二级分镜头。</div>}
                </div>
              </div>
            ))}
            {outlineItems.length === 0 && <div className="empty">暂无核心镜头脉络，请先上传或新增。</div>}
          </div>
        </div>
      </section>

      <div
        className="panel-resizer"
        onMouseDown={() => setDragTarget('right')}
        role="separator"
        aria-label="调整右侧面板宽度"
      />

      <aside className="storyboard-side-panel">
        <div className="storyboard-side-header">
          <div>
            <h3>资源面板</h3>
            <div className="storage-path-hint">资源默认保存：{resourceStoragePath}</div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button type="button" className={activeSideTab === 'resources' ? 'tab active' : 'tab'} onClick={() => setActiveSideTab('resources')}>资源</button>
              <button type="button" className={activeSideTab === 'scenes' ? 'tab active' : 'tab'} onClick={() => setActiveSideTab('scenes')}>场景</button>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="button-secondary" onClick={() => setActiveSideTab('scenes')}>场景库</button>
            <button type="button" className="button-secondary" onClick={saveCurrentShotChecklist}>保存清单</button>
            <button type="button" onClick={addResource} disabled={!activeFrame || activeSideTab !== 'resources'}>+ 资源</button>
          </div>
        </div>

        {!activeFrame && <div className="empty">请选择镜头后编辑资源。</div>}

        {activeFrame && (
          <div className="storyboard-side-scroll">
            {activeSideTab === 'scenes' && <div className="empty">场景库已打开（左侧场景 Tab）。</div>}
            {activeSideTab === 'resources' && (
            <>
            <div className="folder-card">
              <button type="button" className={`folder-title ${expandedFolders.missing ? 'active' : ''}`} onClick={() => toggleFolder('missing')}>
                <span className="folder-title-badge danger">缺失资源</span>
              </button>
              {expandedFolders.missing && (
                <div className="folder-body">
                  {missingResources.map((resource) => (
                    <div key={resource.id} className="resource-item missing">
                      <div className="resource-item-head">
                        <strong>{getResourceTypeLabel(resource.type)} · {resource.name || '未命名资源'}</strong>
                      </div>
                      <label>
                        资源类型
                        <select value={resource.type} onChange={(event) => updateResource(resource.id, { type: event.target.value })}>
                          {Object.keys(RESOURCE_TYPE_LABELS).map((type) => (
                            <option key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        资源名称
                        <input value={resource.name} onChange={(event) => updateResource(resource.id, { name: event.target.value })} />
                      </label>
                      <label>
                        二级资源类型
                        <input
                          placeholder="形态 / Q版 / L1非常规 / L3非常规"
                          value={resource.subType}
                          onChange={(event) => updateResource(resource.id, { subType: event.target.value })}
                        />
                      </label>
                      <label>
                        提示词
                        <textarea className="large-input compact-input" value={resource.prompt} onChange={(event) => updateResource(resource.id, { prompt: event.target.value })} />
                      </label>
                      <label className="placeholder-upload">
                        上传资源
                        <input type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.mov" onChange={(event) => uploadResourceFile(resource.id, event.target.files?.[0])} />
                      </label>
                      <div className="storage-path-hint">目标目录：{buildTargetPath(resource.type, resource.subType)}</div>
                    </div>
                  ))}
                  {missingResources.length === 0 && <div className="empty">无缺失资源。</div>}
                </div>
              )}
            </div>

            <div className="folder-card">
              <button type="button" className={`folder-title ${expandedFolders.uploaded ? 'active' : ''}`} onClick={() => toggleFolder('uploaded')}>
                <span className="folder-title-badge success">已上传资源</span>
              </button>
              {expandedFolders.uploaded && (
                <div className="folder-body">
                  {uploadedResources.map((resource) => (
                    <div key={resource.id} className="resource-item uploaded">
                      <div className="resource-item-head">
                        <strong>{getResourceTypeLabel(resource.type)} · {resource.name}</strong>
                        <div className="row">
                          <button
                            type="button"
                            onClick={() =>
                              openZoomPreview({ type: 'resource', src: resource.preview || '', resourceId: resource.id })
                            }
                          >
                            查看
                          </button>
                          <button type="button" onClick={() => triggerPreviewDownload(resource.preview, resource.fileName)}>下载</button>
                          <label className="file-button compact">
                            替换
                            <input type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.mov" onChange={(event) => uploadResourceFile(resource.id, event.target.files?.[0])} />
                          </label>
                        </div>
                      </div>
                      {resource.preview && (
                        <img
                          src={resource.preview}
                          alt={resource.name || 'resource'}
                          className="resource-thumb"
                          onClick={() => openZoomPreview({ type: 'resource', src: resource.preview, resourceId: resource.id })}
                        />
                      )}
                      <div className="storage-path-hint">本地路径：{resource.localPath || '未上传'}</div>
                    </div>
                  ))}
                  {uploadedResources.length === 0 && <div className="empty">暂无已上传资源。</div>}
                </div>
              )}
            </div>

            {needsImageUpload && (
              <div className="folder-card">
                <button type="button" className={`folder-title ${expandedFolders.imageUpload ? 'active' : ''}`} onClick={() => toggleFolder('imageUpload')}>
                  图片上传
                </button>
                {expandedFolders.imageUpload && (
                  <div className="folder-body">
                    <div className="row">
                      <button type="button">下载图片任务包</button>
                      <label className="file-button">
                        上传图片
                        <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => uploadFrameAsset('imageAsset', event.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="storage-path-hint">图片保存目录：{frameAssetStoragePath}</div>
                    {activeFrame.imageAsset?.preview && (
                      <img
                        src={activeFrame.imageAsset.preview}
                        alt="imageAsset"
                        className="resource-thumb"
                        onClick={() => openZoomPreview({ type: 'asset', src: activeFrame.imageAsset.preview, field: 'imageAsset' })}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {needsVideoUpload && (
              <div className="folder-card">
                <button type="button" className={`folder-title ${expandedFolders.videoUpload ? 'active' : ''}`} onClick={() => toggleFolder('videoUpload')}>
                  视频上传
                </button>
                {expandedFolders.videoUpload && (
                  <div className="folder-body">
                    <div className="row">
                      <button type="button">下载视频任务包</button>
                      <label className="file-button">
                        上传视频
                        <input type="file" accept=".mp4,.mov" onChange={(event) => uploadFrameAsset('videoAsset', event.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="storage-path-hint">视频保存目录：{frameAssetStoragePath}</div>
                    <div className="muted">已上传：{activeFrame.videoAsset?.fileName || '无'}</div>
                  </div>
                )}
              </div>
            )}

            </>
            )}
          </div>
        )}
      </aside>

      {showTemplateMenu && (
        <div className="template-menu">
          {SHOT_TEMPLATES.map((template) => (
            <button key={template.id} type="button" className="template-item" onClick={() => applyShotTemplate(template)}>{template.label}</button>
          ))}
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((toast) => <div key={toast.id} className={`toast-item ${toast.type}`}>{toast.message}</div>)}
        </div>
      )}

      {zoomPreview?.src && (
        <div className="modal" onClick={() => setZoomPreview(null)}>
          <div className="modal-content preview-modal" onClick={(event) => event.stopPropagation()}>
            <img src={zoomPreview.src} alt="preview" className="preview-modal-image" />
            <label className="file-button" style={{ marginTop: 8 }}>
              替换
              <input
                ref={replaceInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.mp4,.mov"
                onChange={(event) => applyZoomReplacement(event.target.files?.[0])}
              />
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setZoomPreview(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardEditor;