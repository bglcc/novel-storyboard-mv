import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { saveFileWithFallback, sha256, validateFile } from '../utils/localFileBridge';

const levels = [
  { value: 'L1', label: 'L1 静态单层' },
  { value: 'L2', label: 'L2 资源拟动' },
  { value: 'L3', label: 'L3 复杂动作' },
  { value: 'L4', label: 'L4 多人交互' }
];

const resourceTypeLabels = {
  characters: '角色',
  scenes: '场景',
  props: '道具',
  expressions: '表情'
};

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
  text: `分镜头大纲 ${index + 1}`,
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
  shotNumber: `${index + 1}`,
  outlineIndex,
  synopsis: '',
  level: 'L1',
  ...baseFrameFields,
  resources: [],
  keyframesEnabled: false,
  keyframes: [],
  imageAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  videoAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  completed: false,
  completedAt: null
});

const isFrameResourcesReady = (frame) => !(frame.resources || []).some((resource) => resource.status !== 'uploaded');

const isFrameAssetReady = (frame, level) => {
  if (level === 'L1') return Boolean(frame.imageAsset?.fileName);
  if (level === 'L3') return Boolean(frame.imageAsset?.fileName && frame.videoAsset?.fileName);
  return true;
};

const isShotReady = (shot) => {
  if (shot.keyframesEnabled && (shot.keyframes || []).length > 0) {
    return shot.keyframes.every((frame) => isFrameResourcesReady(frame) && isFrameAssetReady(frame, shot.level));
  }
  return isFrameResourcesReady(shot) && isFrameAssetReady(shot, shot.level);
};

const getResourceTypeLabel = (type) => resourceTypeLabels[type] || type;

const readFilePreview = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(typeof event.target?.result === 'string' ? event.target.result : '');
    };
    reader.onerror = () => reject(new Error('文件预览生成失败'));
    reader.readAsDataURL(file);
  });

const parseLenientJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const wrapped = text.replace(/^[\uFEFF\s]+/, '').trim();
    return JSON.parse(wrapped);
  }
};

const StoryboardEditor = ({ novelId, chapter }) => {
  const { updateChapter } = useData();
  const [activeOutlineId, setActiveOutlineId] = useState(chapter.storyboardOutlineItems?.[0]?.id || '');
  const [activeShotId, setActiveShotId] = useState(chapter.storyboardShots?.[0]?.id || '');
  const [activeFrameId, setActiveFrameId] = useState('main');
  const [zoomPreview, setZoomPreview] = useState(null);
  const [highlightIncompleteShotId, setHighlightIncompleteShotId] = useState('');
  const replaceInputRef = useRef(null);
  const outlineUploadRef = useRef(null);
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

    updateChapterPatch((currentChapter) => {
      const existing = currentChapter.editingWorkflow?.fileHashes || [];
      if (existing.includes(hash)) {
        duplicate = true;
        return {};
      }
      return {
        editingWorkflow: {
          ...(currentChapter.editingWorkflow || {}),
          fileHashes: [...existing, hash]
        }
      };
    });

    return { duplicate, hash };
  };

  const buildTargetPath = (resourceType = 'misc', subType = '') => {
    const chapterName = `${chapter.id}-${chapter.title || 'untitled'}`;
    const safeType = resourceType || 'misc';
    const safeSubType = subType || 'default';
    return `${novelId}/${chapterName}/${safeType}/${safeSubType}`;
  };

  const syncShotStatus = (nextShots) => {
    const normalized = nextShots.map((shot) => {
      const done = isShotReady(shot);
      return {
        ...shot,
        completed: done,
        completedAt: done ? shot.completedAt || Date.now() : null
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

  const uploadOutlineDetail = async (id, file) => {
    if (!file) return;
    const detailContent = await file.text();
    updateOutline(id, {
      detailUploaded: true,
      detailFileName: file.name,
      detailContent,
      detailUploadedAt: Date.now()
    });
  };

  const uploadAllOutlineItems = async (file) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = parseLenientJson(raw);
      const source = Array.isArray(parsed) ? parsed : parsed.outlineItems || parsed.storyboardOutlineItems || [];
      if (!Array.isArray(source) || source.length === 0) {
        alert('上传失败：未识别到分镜头大纲数组。');
        return;
      }
      const next = source.map((item, index) => ({
        id: item.id || crypto.randomUUID(),
        order: index + 1,
        text: item.text || item.outlineText || item.content || `分镜头大纲 ${index + 1}`,
        detailUploaded: Boolean(item.detailUploaded || item.detailContent),
        detailFileName: item.detailFileName || '',
        detailContent: item.detailContent || '',
        detailUploadedAt: item.detailUploadedAt || null
      }));
      updateChapterPatch({ storyboardOutlineItems: next, storyboardOutlineUpdatedAt: Date.now() });
      setActiveOutlineId(next[0]?.id || '');
      alert(`已上传 ${next.length} 条分镜头大纲。`);
    } catch (error) {
      alert('上传失败：JSON 解析错误。');
    }
  };

  const canDownloadDetail = (index) => {
    if (index === 0) return true;
    return Boolean(outlineItems[index - 1]?.detailUploaded);
  };

  const downloadOutlineDetail = (index) => {
    const current = outlineItems[index];
    if (!current) return;
    const previous = index > 0 ? outlineItems[index - 1] : null;
    const payload = {
      outlineOrder: current.order,
      outlineText: current.text,
      previousOutlineContext: previous
        ? {
            order: previous.order,
            text: previous.text,
            detailContent: previous.detailContent || '',
            detailUploadedAt: previous.detailUploadedAt || null
          }
        : null
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `outline-${current.order}-detail-task.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addShot = (outlineIndex = 0) => {
    const shot = makeShot(shots.length, outlineIndex);
    const next = [...shots, shot];
    syncShotStatus(next);
    setActiveOutlineId(outlineItems[outlineIndex]?.id || '');
    setActiveShotId(shot.id);
    setActiveFrameId('main');
  };

  const updateShot = (shotId, patch) => {
    const next = shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot));
    syncShotStatus(next);
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
    const nextResources = (activeFrame.resources || []).map((resource) =>
      resource.id === resourceId ? { ...resource, ...patch } : resource
    );
    updateActiveFrame({ resources: nextResources });
  };

  const uploadResourceFile = async (resourceId, file) => {
    if (!file || !activeFrame) return;
    const check = validateFile(file);
    if (!check.ok) {
      alert(check.message);
      return;
    }

    try {
      const { duplicate } = await ensureNoDuplicateHash(file);
      if (duplicate) {
        alert('检测到重复文件，已阻止上传。');
        return;
      }

      const resource = (activeFrame.resources || []).find((item) => item.id === resourceId);
      const targetPath = buildTargetPath(resource?.type, resource?.subType);
      const [saveResult, preview] = await Promise.all([
        saveFileWithFallback({ file, targetPath }),
        readFilePreview(file)
      ]);

      updateResource(resourceId, {
        status: 'uploaded',
        fileName: file.name,
        localPath: saveResult.localPath,
        preview,
        updatedAt: Date.now(),
        sourceType: saveResult.source
      });

      if (saveResult.error) {
        alert('本地服务不可用，已使用本地占位路径保存记录。');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '资源上传失败，请重试。');
    }
  };

  const uploadFrameAsset = async (field, file) => {
    if (!file || !activeFrame) return;
    const check = validateFile(file);
    if (!check.ok) {
      alert(check.message);
      return;
    }

    try {
      const { duplicate } = await ensureNoDuplicateHash(file);
      if (duplicate) {
        alert('检测到重复文件，已阻止上传。');
        return;
      }

      const targetPath = buildTargetPath('shot-assets', activeShot?.level || 'L1');
      const [saveResult, preview] = await Promise.all([
        saveFileWithFallback({ file, targetPath }),
        readFilePreview(file)
      ]);

      updateActiveFrame({
        [field]: {
          fileName: file.name,
          localPath: saveResult.localPath,
          remoteUrl: '',
          preview,
          updatedAt: Date.now(),
          sourceType: saveResult.source
        }
      });

      if (saveResult.error) {
        alert('本地服务不可用，已使用本地占位路径保存记录。');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '素材上传失败，请重试。');
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
          resources: shot.resources,
          imageAsset: shot.imageAsset,
          videoAsset: shot.videoAsset
        },
        keyframes: shot.keyframes || [],
        audioPlaceholders: {
          dialogue: shot.dialoguePlaceholder || '',
          bgm: shot.bgmPlaceholder || '',
          sfx: shot.sfxPlaceholder || ''
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
    const firstIncomplete = shots.find((shot) => !shot.completed);
    if (firstIncomplete) {
      setActiveShotId(firstIncomplete.id);
      setActiveFrameId('main');
      const relatedOutline = outlineItems[firstIncomplete.outlineIndex];
      if (relatedOutline) setActiveOutlineId(relatedOutline.id);
      setHighlightIncompleteShotId((prev) => (prev === firstIncomplete.id ? '' : firstIncomplete.id));
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

  return (
    <div
      className={`storyboard-workspace ${dragTarget ? 'resizing' : ''}`}
      style={{ '--left-panel-width': `${leftPanelWidth}px`, '--right-panel-width': `${rightPanelWidth}px` }}
    >
      <section className="storyboard-editor-panel">
        <div className="storyboard-editor-header">
          <h3>镜头编辑</h3>
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
            <button type="button" className="button-secondary" onClick={() => outlineUploadRef.current?.click()}>
              上传分镜头大纲
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
            >
              下载至剪映
            </button>
          </div>
        </div>

        <div className="storyboard-main-scroll">
          <div className="section-header">
            <h3>分镜头大纲</h3>
            <button type="button" onClick={addOutline}>新增大纲</button>
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
                      {outline.detailUploaded ? '细纲已上传' : '待上传细纲'}
                    </span>
                    <button type="button" className="tab" onClick={() => addShot(outlineIndex)}>新增镜头</button>
                  </div>
                </div>
                <input
                  className="outline-inline-input"
                  value={outline.text}
                  onChange={(event) => updateOutline(outline.id, { text: event.target.value })}
                  placeholder="输入大纲内容（建议 1-2 句）"
                />
                <div className="row">
                  <button type="button" disabled={!canDownloadDetail(outlineIndex)} onClick={() => downloadOutlineDetail(outlineIndex)}>
                    下载分镜头细纲
                  </button>
                  <label className="file-button">
                    上传分镜头细纲
                    <input
                      type="file"
                      accept="application/json,text/plain"
                      onChange={(event) => uploadOutlineDetail(outline.id, event.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="outline-shot-list">
                  {outlineShots.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      className={`shot-row ${activeShotId === shot.id ? 'active' : ''} ${highlightIncompleteShotId === shot.id ? 'highlight-danger' : ''}`}
                      onClick={() => {
                        setActiveShotId(shot.id);
                        setActiveFrameId('main');
                        setHighlightIncompleteShotId('');
                      }}
                    >
                      <span>#{shot.shotNumber}</span>
                      <span>{shot.synopsis || shot.title || '未命名镜头'}</span>
                      <span>{shot.level}</span>
                      <span>{shot.completed ? '完成' : '制作中'}</span>
                    </button>
                  ))}
                  {outlineShots.length === 0 && <div className="empty">当前大纲暂无二级分镜头。</div>}
                </div>
              </div>
            ))}
            {outlineItems.length === 0 && <div className="empty">暂无分镜头大纲，请先上传或新增。</div>}
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
          </div>
          <button type="button" onClick={addResource} disabled={!activeFrame}>+ 资源</button>
        </div>

        {!activeFrame && <div className="empty">请选择镜头后编辑资源。</div>}

        {activeFrame && (
          <div className="storyboard-side-scroll">
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
                          {Object.keys(resourceTypeLabels).map((type) => (
                            <option key={type} value={type}>{resourceTypeLabels[type]}</option>
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
                        <input type="file" accept="image/*,video/mp4" onChange={(event) => uploadResourceFile(resource.id, event.target.files?.[0])} />
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
                            <input type="file" accept="image/*,video/mp4" onChange={(event) => uploadResourceFile(resource.id, event.target.files?.[0])} />
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
                        <input type="file" accept="image/*" onChange={(event) => uploadFrameAsset('imageAsset', event.target.files?.[0])} />
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
                        <input type="file" accept="video/mp4" onChange={(event) => uploadFrameAsset('videoAsset', event.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="storage-path-hint">视频保存目录：{frameAssetStoragePath}</div>
                    <div className="muted">已上传：{activeFrame.videoAsset?.fileName || '无'}</div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </aside>

      {zoomPreview?.src && (
        <div className="modal" onClick={() => setZoomPreview(null)}>
          <div className="modal-content preview-modal" onClick={(event) => event.stopPropagation()}>
            <img src={zoomPreview.src} alt="preview" className="preview-modal-image" />
            <label className="file-button" style={{ marginTop: 8 }}>
              替换
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*,video/mp4"
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
