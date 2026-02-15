import React, { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { getExpressionForms } from '../utils/expressionFormsDb';

const shotTypeOptions = ['大全景', '中景', '近景', '特写', '俯视', '仰视'];
const angleOptions = ['正面', '侧面', '背面', '俯视', '仰视'];
const movementOptions = ['固定机位', '推镜', '拉镜', '摇镜', '移镜'];

const baseTabs = [
  { key: 'frame', label: '首帧图' },
  { key: 'animation', label: '动画' },
  { key: 'audio', label: '音频' }
];

const sideTabs = [
  { key: 'info', label: '文字信息' },
  { key: 'resources', label: '资源库' }
];

const resourceSections = [
  { key: 'characters', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' }
];

const emptyShot = (idx) => ({
  id: crypto.randomUUID(),
  shotNumber: `${idx + 1}`,
  description: '',
  shotType: shotTypeOptions[0] || '',
  shotTime: '',
  sceneDescription: '',
  cameraAngle: angleOptions[0] || '',
  cameraMovement: movementOptions[0] || '',
  scene: '',
  characters: [],
  props: [],
  previewImage: '',
  composition: [],
  keyframes: [],
  audioDialogue: '',
  audioTone: '',
  audioBgm: '',
  audioSfx: '',
  expressionFormId: ''
});

const StoryboardEditor = ({ novelId, chapter }) => {
  const { updateChapter, data, ensurePlaceholderResources, upsertResource } = useData();
  const [missingResources, setMissingResources] = useState([]);
  const [activeTabs, setActiveTabs] = useState({});
  const [sideTabsState, setSideTabsState] = useState({});
  const [resourceSectionState, setResourceSectionState] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingKeyframeDelete, setPendingKeyframeDelete] = useState(null);
  const [expressionForms, setExpressionForms] = useState([]);
  const [previewEditorShotId, setPreviewEditorShotId] = useState(null);
  const [activeElementId, setActiveElementId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [interactionMode, setInteractionMode] = useState('move');
  const previewCanvasRef = useRef(null);
  const historyRef = useRef([]);
  const undoingRef = useRef(false);

  const scenes = data.resources.scenes || [];
  const characters = (data.resources.characters || []).filter(
    (character) => !character.novelId || character.novelId === novelId
  );
  const props = data.resources.props || [];
  const novel = (data.novels || []).find((item) => item.id === novelId);

  const getLatestAsset = (res) => {
    const assets = res.assets || [];
    if (!assets.length) return null;
    return assets
      .slice()
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
  };

  const resolveResourceCover = (type, res) => {
    if (!res) return '';
    if (type === 'characters') {
      const firstImage = res.images?.[0];
      const formViews = res.form?.[0]?.viewAssets || [];
      const front = formViews.find((asset) => asset.viewAngle === '正面');
      return (
        getLatestAsset(res)?.src ||
        front?.src ||
        formViews?.[0]?.src ||
        res.meta?.viewAssets?.[0]?.src ||
        firstImage?.src ||
        firstImage ||
        ''
      );
    }
    if (type === 'scenes') {
      const firstImage = res.images?.[0];
      const variantImage =
        res.meta?.sceneVariants?.[0]?.images?.[0]?.src || res.meta?.sceneVariants?.[0]?.images?.[0];
      return variantImage || firstImage?.src || firstImage || '';
    }
    if (type === 'props') {
      const firstImage = res.images?.[0];
      const variantImage =
        res.meta?.propVariants?.[0]?.images?.[0]?.src || res.meta?.propVariants?.[0]?.images?.[0];
      return variantImage || firstImage?.src || firstImage || '';
    }
    const firstImage = res.images?.[0];
    return firstImage?.src || firstImage || '';
  };

  useEffect(() => {
    let active = true;
    getExpressionForms().then((forms) => {
      if (active) setExpressionForms(forms);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event) => {
      const container = previewCanvasRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setDragging((prev) => {
        if (!prev) return null;
        if (prev.mode === 'move') {
          const clampedX = Math.max(0, Math.min(100, x));
          const clampedY = Math.max(0, Math.min(100, y));
          updateComposition(prev.shotId, prev.elementId, { x: clampedX, y: clampedY });
          return prev;
        }
        const deltaPxX = event.clientX - prev.center.x;
        const deltaPxY = event.clientY - prev.center.y;
        if (prev.mode === 'rotate') {
          const angle = Math.atan2(deltaPxY, deltaPxX);
          const nextRotate = prev.start.rotate + (angle - prev.start.angle) * (180 / Math.PI);
          updateComposition(prev.shotId, prev.elementId, { rotate: Math.round(nextRotate) });
          return prev;
        }
        if (prev.mode === 'scale') {
          const distance = Math.sqrt(deltaPxX ** 2 + deltaPxY ** 2);
          const ratio = prev.start.distance ? distance / prev.start.distance : 1;
          const nextScale = Math.max(0.2, Math.min(3, prev.start.scale * ratio));
          updateComposition(prev.shotId, prev.elementId, { scale: Number(nextScale.toFixed(2)) });
          return prev;
        }
        return prev;
      });
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const history = historyRef.current;
        if (!history.length) return;
        const previous = history.pop();
        undoingRef.current = true;
        updateShots(previous);
        undoingRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getActiveTab = (shotId) => activeTabs[shotId] || 'frame';
  const getSideTab = (shotId) => sideTabsState[shotId] || 'info';
  const getResourceSection = (shotId) => resourceSectionState[shotId] || 'characters';

  const buildKeyframeTabs = (shot) =>
    (shot.keyframes || []).map((frame, index) => ({
      key: `keyframe-${frame.id}`,
      label: frame.label || `关键帧${index + 1}`,
      id: frame.id
    }));

  const isKeyframeTab = (tabKey) => tabKey.startsWith('keyframe-');

  const detectMissingResources = (shots) => {
    const missing = [];
    const { resources } = data;
    const expressionLookup = new Map(expressionForms.map((form) => [form.id, form.name || form.id]));
    const ensureItem = (type, name) => {
      if (!name) return;
      const exists = resources[type].some((r) => r.name === name);
      if (!exists && !missing.find((m) => m.type === type && m.name === name)) {
        missing.push({ type, name });
      }
    };

    shots.forEach((shot) => {
      ensureItem('scenes', shot.scene);
      (shot.characters || []).forEach((c) => ensureItem('characters', c));
      (shot.props || []).forEach((p) => ensureItem('props', p));
      if (shot.expressionFormId) {
        const expressionName = expressionLookup.get(shot.expressionFormId) || shot.expressionFormId;
        ensureItem('expressions', expressionName);
      }
    });
    return missing;
  };

  const updateShots = (next) => {
    if (!undoingRef.current) {
      historyRef.current = [...historyRef.current, chapter.storyboards || []].slice(-30);
    }
    updateChapter(novelId, chapter.id, { storyboards: next, storyboardUpdatedAt: Date.now() });
    const missing = detectMissingResources(next);
    if (missing.length) {
      ensurePlaceholderResources(missing, novelId);
      setMissingResources(missing);
    } else {
      setMissingResources([]);
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const shots = Array.isArray(parsed) ? parsed : parsed.storyboard || parsed.storyboards || [];
        const resourcesPayload = parsed.resources || {};
        (resourcesPayload.characters || []).forEach((character) => {
          upsertResource('characters', {
            ...character,
            id: character.id || crypto.randomUUID()
          });
        });
        (resourcesPayload.scenes || []).forEach((scene) => {
          upsertResource('scenes', {
            ...scene,
            id: scene.id || crypto.randomUUID()
          });
        });
        (resourcesPayload.props || []).forEach((prop) => {
          upsertResource('props', {
            ...prop,
            id: prop.id || crypto.randomUUID()
          });
        });
        const normalized = shots.map((shot, idx) => ({
          id: shot.id || crypto.randomUUID(),
          shotNumber: `${idx + 1}`,
          description: shot.description || '',
          shotType: shot.shotType || shotTypeOptions[0] || '',
          shotTime: shot.shotTime || '',
          sceneDescription: shot.sceneDescription || '',
          cameraAngle: shot.cameraAngle || angleOptions[0] || '',
          cameraMovement: shot.cameraMovement || movementOptions[0] || '',
          scene: shot.scene || '',
          characters: shot.characters || [],
          props: shot.props || [],
          previewImage: shot.previewImage || '',
          composition: shot.composition || shot.layout || [],
          keyframes: Array.isArray(shot.keyframes) ? shot.keyframes : [],
          audioDialogue: shot.audioDialogue || '',
          audioTone: shot.audioTone || '',
          audioBgm: shot.audioBgm || '',
          audioSfx: shot.audioSfx || '',
          expressionFormId: shot.expressionFormId || ''
        }));
        updateShots(normalized);
      } catch (err) {
        alert('JSON 解析失败');
      }
    };
    reader.readAsText(file);
  };

  const updateShotField = (shotId, field, value) => {
    const updated = (chapter.storyboards || []).map((shot, idx) =>
      shot.id === shotId ? { ...shot, [field]: value, shotNumber: `${idx + 1}` } : shot
    );
    updateShots(updated);
  };

  const updateComposition = (shotId, elementId, changes) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const next = (shot.composition || []).map((element) =>
        element.id === elementId ? { ...element, ...changes } : element
      );
      return { ...shot, composition: next };
    });
    updateShots(updated);
  };

  const addCompositionElement = (shotId, element) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const next = [...(shot.composition || []), element];
      return { ...shot, composition: next };
    });
    updateShots(updated);
    setActiveElementId(element.id);
  };

  const removeCompositionElement = (shotId, elementId) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const next = (shot.composition || []).filter((element) => element.id !== elementId);
      return { ...shot, composition: next };
    });
    updateShots(updated);
    setActiveElementId((prev) => (prev === elementId ? null : prev));
  };

  const handleOpenPreviewEditor = (shotId) => {
    setPreviewEditorShotId(shotId);
    const shot = (chapter.storyboards || []).find((item) => item.id === shotId);
    setActiveElementId(shot?.composition?.[0]?.id || null);
  };

  const handleExportComposition = async (shot) => {
    const items = shot.composition || [];
    if (!items.length) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const images = await Promise.all(
      items.map(
        (item) =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({ item, img });
            img.onerror = () => resolve({ item, img: null });
            img.src = item.src;
          })
      )
    );
    images.forEach(({ item, img }) => {
      if (!img) return;
      const widthPx = (canvas.width * (item.width || 30)) / 100 * (item.scale || 1);
      const ratio = img.height / img.width || 1;
      const heightPx = widthPx * ratio;
      const x = (canvas.width * (item.x || 50)) / 100;
      const y = (canvas.height * (item.y || 50)) / 100;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((item.rotate || 0) * Math.PI) / 180);
      ctx.drawImage(img, -widthPx / 2, -heightPx / 2, widthPx, heightPx);
      ctx.restore();
    });
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}-preview-${shot.shotNumber}.png`;
    link.click();
  };

  const handleBatchUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const existing = chapter.storyboards || [];
    const readerPromises = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, dataUrl: e.target.result });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readerPromises).then((items) => {
      const nextShots = items.map((item, idx) => ({
        ...emptyShot(existing.length + idx),
        description: item.name,
        previewImage: item.dataUrl
      }));
      updateShots([...existing, ...nextShots]);
    });
  };

  const handleAddKeyframe = (shotId) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const nextFrames = [...(shot.keyframes || [])];
      const newFrame = { id: crypto.randomUUID(), label: `关键帧${nextFrames.length + 1}` };
      nextFrames.push(newFrame);
      return { ...shot, keyframes: nextFrames };
    });
    updateShots(updated);
  };
  const handleDeleteKeyframe = (shotId, keyframeId) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const nextFrames = (shot.keyframes || []).filter((frame) => frame.id !== keyframeId);
      const normalized = nextFrames.map((frame, index) => ({
        ...frame,
        label: frame.label || `关键帧${index + 1}`
      }));
      return { ...shot, keyframes: normalized };
    });
    updateShots(updated);
  };

  const handleInsertShot = (index) => {
    const existing = chapter.storyboards || [];
    const next = [...existing];
    next.splice(index + 1, 0, emptyShot(index + 1));
    const normalized = next.map((shot, idx) => ({ ...shot, shotNumber: `${idx + 1}` }));
    updateShots(normalized);
  };

  const handleDeleteShot = (shotId) => {
    const filtered = (chapter.storyboards || []).filter((s) => s.id !== shotId);
    updateShots(filtered.map((shot, idx) => ({ ...shot, shotNumber: `${idx + 1}` })));
  };

  const handleDownload = () => {
    const usedCharacterNames = new Set();
    const usedSceneNames = new Set();
    const usedPropNames = new Set();
    (chapter.storyboards || []).forEach((shot) => {
      (shot.characters || []).forEach((name) => usedCharacterNames.add(name));
      if (shot.scene) usedSceneNames.add(shot.scene);
      (shot.props || []).forEach((name) => usedPropNames.add(name));
    });
    const characterResources = (data.resources.characters || []).filter((item) => usedCharacterNames.has(item.name));
    const sceneResources = (data.resources.scenes || []).filter((item) => usedSceneNames.has(item.name));
    const propResources = (data.resources.props || []).filter((item) => usedPropNames.has(item.name));
    const composition = (chapter.storyboards || []).map((shot) => ({
      shotNumber: shot.shotNumber,
      scene: shot.scene || '',
      characters: shot.characters || [],
      props: shot.props || [],
      layout: shot.composition || shot.layout || []
    }));
    const payload = {
      storyboards: chapter.storyboards || [],
      composition,
      novel: {
        id: novel?.id || '',
        title: novel?.title || '',
        outlineText: novel?.outlineText || '',
        outlinePrompt: novel?.outlinePrompt || '',
        fullText: (novel?.chapters || []).map((item) => item.content || '').join('\n\n')
      },
      relationshipGraph: novel?.relationshipGraph || { nodes: [], relations: [] },
      resources: {
        characters: characterResources,
        scenes: sceneResources,
        props: propResources
      },
      rules: data.rules || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoPackageDownload = () => {
    const payload = (chapter.storyboards || []).map((shot) => ({
      shotNumber: shot.shotNumber,
      description: shot.description,
      animation: {
        movement: shot.cameraMovement,
        angle: shot.cameraAngle,
        shotType: shot.shotType,
        shotTime: shot.shotTime
      },
      frames: {
        firstFrame: shot.previewImage || '',
        previewImage: shot.previewImage || '',
        keyframes: shot.keyframes || []
      },
      audio: {
        dialogue: shot.audioDialogue,
        tone: shot.audioTone,
        bgm: shot.audioBgm,
        sfx: shot.audioSfx
      }
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}-video.json`;
    link.click();
    URL.revokeObjectURL(url);
    updateChapter(novelId, chapter.id, { finalPackageDownloadedAt: Date.now() });
  };

  const handleStoryboardRuleExport = () => {
    const payload = {
      rules: data.rules || [],
      novel: {
        id: novel?.id || '',
        title: novel?.title || '',
        outlineText: novel?.outlineText || '',
        outlinePrompt: novel?.outlinePrompt || '',
        fullText: (novel?.chapters || []).map((item) => item.content || '').join('\n\n')
      },
      resources: {
        characters: data.resources.characters || [],
        scenes: data.resources.scenes || [],
        props: data.resources.props || [],
        expressions: data.resources.expressions || []
      },
      chapter: {
        id: chapter.id,
        title: chapter.title,
        content: chapter.content || ''
      },
      relationshipGraph: novel?.relationshipGraph || { nodes: [], relations: [] }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}-rules.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewCompositionExport = () => {
    const payload = {
      storyboards: chapter.storyboards || [],
      previewParams: (chapter.storyboards || []).map((shot) => ({
        shotNumber: shot.shotNumber,
        description: shot.description || '',
        shotType: shot.shotType || '',
        cameraAngle: shot.cameraAngle || '',
        cameraMovement: shot.cameraMovement || '',
        scene: shot.scene || '',
        characters: shot.characters || [],
        props: shot.props || [],
        composition: shot.composition || []
      })),
      resources: {
        characters: data.resources.characters || [],
        scenes: data.resources.scenes || [],
        props: data.resources.props || [],
        expressions: data.resources.expressions || []
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}-preview-compose.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleResourceSelection = (shotId, field, name) => {
    const shot = (chapter.storyboards || []).find((item) => item.id === shotId);
    if (!shot) return;
    if (field === 'scene') {
      updateShotField(shotId, field, name);
      return;
    }
    const current = shot[field] || [];
    const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
    updateShotField(shotId, field, next);
  };

  const renderResourceTiles = (shot, field, items, resourceType) => (
    <div className="resource-grid">
      {items.map((item) => {
        const selected = field === 'scene' ? shot.scene === item.name : (shot[field] || []).includes(item.name);
        const coverImage = resolveResourceCover(resourceType, item);
        const hasCover = Boolean(coverImage);
        return (
          <button
            key={item.id || item.name}
            type="button"
            className={selected ? 'resource-card selected' : 'resource-card'}
            onClick={() => toggleResourceSelection(shot.id, field, item.name)}
          >
            <div className="resource-cover">
              {hasCover ? <img src={coverImage} alt={item.name} /> : <div className="cover-placeholder">无封面</div>}
            </div>
            <div className="resource-name">{item.name}</div>
          </button>
        );
      })}
      {items.length === 0 && <div className="empty">暂无资源，请先在资库添加。</div>}
    </div>
  );

  const renderCompositionPreview = (shot, interactive = false) => {
    const composition = shot.composition || [];
    if (!composition.length) return null;
    return (
      <div className={`composition-canvas ${interactive ? 'interactive' : ''}`} ref={interactive ? previewCanvasRef : null}>
        {composition.map((element) => {
          const isActive = element.id === activeElementId && interactive;
          return (
            <button
              type="button"
              key={element.id}
              className={isActive ? 'composition-item active' : 'composition-item'}
              style={{
                left: `${element.x ?? 50}%`,
                top: `${element.y ?? 50}%`,
                width: `${element.width ?? 30}%`,
                transform: `translate(-50%, -50%) scale(${element.scale ?? 1}) rotate(${element.rotate ?? 0}deg)`
              }}
              onMouseDown={
                interactive
                  ? (event) => {
                      event.stopPropagation();
                      setActiveElementId(element.id);
                      const rect = previewCanvasRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const center = {
                        x: rect.left + (rect.width * (element.x ?? 50)) / 100,
                        y: rect.top + (rect.height * (element.y ?? 50)) / 100
                      };
                      const startDeltaX = event.clientX - center.x;
                      const startDeltaY = event.clientY - center.y;
                      const startDistance = Math.sqrt(startDeltaX ** 2 + startDeltaY ** 2);
                      const startAngle = Math.atan2(startDeltaY, startDeltaX);
                      setDragging({
                        shotId: shot.id,
                        elementId: element.id,
                        mode: interactionMode,
                        center,
                        start: {
                          x: element.x ?? 50,
                          y: element.y ?? 50,
                          rotate: element.rotate ?? 0,
                          scale: element.scale ?? 1,
                          distance: startDistance,
                          angle: startAngle
                        }
                      });
                    }
                  : undefined
              }
              onClick={
                interactive
                  ? (event) => {
                      event.stopPropagation();
                      setActiveElementId(element.id);
                    }
                  : undefined
              }
            >
              <img src={element.src} alt={element.name || '元素'} />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="space-between">
        <h3>分镜导入与编辑</h3>
        <div className="row">
          <label className="file-button">
            上传分镜头
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
          <button onClick={handleDownload}>下载分镜数据</button>
          <button type="button" onClick={handleStoryboardRuleExport}>
            生成分镜头规则库
          </button>
          <button type="button" onClick={handlePreviewCompositionExport}>
            拼合预览图
          </button>
          <button type="button" onClick={handleVideoPackageDownload}>
            生成视频
          </button>
          <label className="primary-link file-label">
            批量上传预览图
            <input type="file" accept="image/*" multiple onChange={handleBatchUpload} />
          </label>
        </div>
      </div>
      <div className="shot-list">
        {(chapter.storyboards || []).map((shot, index) => {
          const activeTab = getActiveTab(shot.id);
          const sideTab = getSideTab(shot.id);
          const resourceSection = getResourceSection(shot.id);
          const keyframeTabs = buildKeyframeTabs(shot);
          const isFrameTab = activeTab === 'frame' || isKeyframeTab(activeTab);
          return (
            <div key={shot.id} className="shot-card">
              <button type="button" className="shot-preview" onClick={() => handleOpenPreviewEditor(shot.id)}>
                {shot.composition?.length ? (
                  renderCompositionPreview(shot)
                ) : shot.previewImage ? (
                  <img src={shot.previewImage} alt="预览" />
                ) : (
                  <div className="cover-placeholder">无预览图</div>
                )}
              </button>
              <div className="shot-body">
                <div className="shot-header">
                  <div className="shot-number">镜头 {shot.shotNumber}</div>
                  <div className="shot-tabs">
                    {baseTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'tab active' : 'tab'}
                        onClick={() => setActiveTabs((prev) => ({ ...prev, [shot.id]: tab.key }))}
                      >
                        {tab.label}
                      </button>
                    ))}
                    {keyframeTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'tab keyframe-tab active' : 'tab keyframe-tab'}
                        onClick={() => setActiveTabs((prev) => ({ ...prev, [shot.id]: tab.key }))}
                      >
                        <span>{tab.label}</span>
                        <span
                          className="tab-delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingKeyframeDelete({ shotId: shot.id, keyframeId: tab.id, label: tab.label });
                          }}
                        >
                          ×
                        </span>
                      </button>
                    ))}
                    <button type="button" className="tab tab-add" onClick={() => handleAddKeyframe(shot.id)}>
                      + 关键帧
                    </button>
                  </div>
                  <button type="button" className="shot-remove" onClick={() => setPendingDelete(shot)} aria-label="删除镜头">
                    ×
                  </button>
                </div>

                {isFrameTab && (
                  <div className="shot-info">
                    <div className="shot-side-tabs">
                      {sideTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={sideTab === tab.key ? 'side-tab active' : 'side-tab'}
                          onClick={() => setSideTabsState((prev) => ({ ...prev, [shot.id]: tab.key }))}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="shot-panel">
                      {sideTab === 'info' ? (
                        <>
                          <div className="row compact">
                            <label>
                              镜头类型
                              <select
                                value={shot.shotType}
                                onChange={(e) => updateShotField(shot.id, 'shotType', e.target.value)}
                              >
                                {shotTypeOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              机位角度
                              <select
                                value={shot.cameraAngle}
                                onChange={(e) => updateShotField(shot.id, 'cameraAngle', e.target.value)}
                              >
                                {angleOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="row compact">
                            <label>
                              场景描述
                              <input
                                value={shot.sceneDescription}
                                onChange={(e) => updateShotField(shot.id, 'sceneDescription', e.target.value)}
                              />
                            </label>
                            <label>
                              时间/时段
                              <input
                                value={shot.shotTime}
                                onChange={(e) => updateShotField(shot.id, 'shotTime', e.target.value)}
                              />
                            </label>
                          </div>
                          <label>
                            画面描述
                            <textarea
                              className="shot-textarea"
                              value={shot.description}
                              onChange={(e) => updateShotField(shot.id, 'description', e.target.value)}
                            />
                          </label>
                          <label>
                            颜艺形态（Expression Form）
                            <select
                              value={shot.expressionFormId || ''}
                              onChange={(e) => updateShotField(shot.id, 'expressionFormId', e.target.value)}
                            >
                              <option value="">不使用</option>
                              {expressionForms.map((form) => (
                                <option key={form.id} value={form.id}>
                                  {form.name} ({form.id})
                                </option>
                              ))}
                            </select>
                          </label>
                          {shot.expressionFormId && (
                            <div className="expression-warning">
                              ⚠ 本镜头使用颜艺形态：{
                                expressionForms.find((form) => form.id === shot.expressionFormId)?.name ||
                                shot.expressionFormId
                              }（建议直接生图）
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="resource-folder">
                          {resourceSections.map((section) => (
                            <div key={section.key} className="resource-section">
                              <button
                                type="button"
                                className={
                                  resourceSection === section.key
                                    ? 'resource-section-header active'
                                    : 'resource-section-header'
                                }
                                onClick={() =>
                                  setResourceSectionState((prev) => ({ ...prev, [shot.id]: section.key }))
                                }
                              >
                                {section.label}
                              </button>
                              {resourceSection === section.key && (
                                <div className="resource-panel">
                                  {section.key === 'characters' &&
                                    renderResourceTiles(shot, 'characters', characters, 'characters')}
                                  {section.key === 'scenes' && renderResourceTiles(shot, 'scene', scenes, 'scenes')}
                                  {section.key === 'props' && renderResourceTiles(shot, 'props', props, 'props')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'animation' && (
                  <div className="shot-panel">
                    <div className="row compact">
                      <label>
                        镜头类型
                        <select
                          value={shot.shotType}
                          onChange={(e) => updateShotField(shot.id, 'shotType', e.target.value)}
                        >
                          {shotTypeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        机位角度
                        <select
                          value={shot.cameraAngle}
                          onChange={(e) => updateShotField(shot.id, 'cameraAngle', e.target.value)}
                        >
                          {angleOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        机位运动
                        <select
                          value={shot.cameraMovement}
                          onChange={(e) => updateShotField(shot.id, 'cameraMovement', e.target.value)}
                        >
                          {movementOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      镜头描述
                      <textarea
                        className="shot-textarea"
                        value={shot.description}
                        onChange={(e) => updateShotField(shot.id, 'description', e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {activeTab === 'audio' && (
                  <div className="shot-panel">
                    <label>
                      角色对话
                      <textarea
                        className="shot-textarea"
                        value={shot.audioDialogue}
                        onChange={(e) => updateShotField(shot.id, 'audioDialogue', e.target.value)}
                        placeholder="角色对话内容"
                      />
                    </label>
                    <label>
                      语气/情绪
                      <input
                        value={shot.audioTone}
                        onChange={(e) => updateShotField(shot.id, 'audioTone', e.target.value)}
                        placeholder="如：平静、紧张"
                      />
                    </label>
                    <div className="row compact">
                      <label>
                        BGM
                        <input
                          value={shot.audioBgm}
                          onChange={(e) => updateShotField(shot.id, 'audioBgm', e.target.value)}
                          placeholder="背景音乐"
                        />
                      </label>
                      <label>
                        拟声
                        <input
                          value={shot.audioSfx}
                          onChange={(e) => updateShotField(shot.id, 'audioSfx', e.target.value)}
                          placeholder="音效"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="shot-actions">
                  <button type="button" className="shot-add" onClick={() => handleInsertShot(index)}>
                    + 新增镜头
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {missingResources.length > 0 && (
        <div className="modal">
          <div className="modal-content">
            <h4>检测到缺失资源</h4>
            <ul>
              {missingResources.map((item) => (
                <li key={`${item.type}-${item.name}`}>
                  [{item.type}] {item.name}
                </li>
              ))}
            </ul>
            <p>已自动创建占位资源，点击下方按钮前往资源库补齐。</p>
            <a
              className="primary-link"
              href={`/resources?tab=${missingResources[0]?.type || 'characters'}&show=missing`}
            >
              一键跳转资源库
            </a>
            <button onClick={() => setMissingResources([])}>关闭</button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal">
          <div className="modal-content">
            <h4>确认删除镜头</h4>
            <p>确定删除镜头 {pendingDelete.shotNumber} 吗？该操作不可撤销。</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  handleDeleteShot(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                确认删除
              </button>
              <button type="button" className="tab" onClick={() => setPendingDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingKeyframeDelete && (
        <div className="modal">
          <div className="modal-content">
            <h4>确认删除关键帧</h4>
            <p>确定删除 {pendingKeyframeDelete.label} 吗？该操作不可撤销。</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  handleDeleteKeyframe(pendingKeyframeDelete.shotId, pendingKeyframeDelete.keyframeId);
                  setPendingKeyframeDelete(null);
                }}
              >
                确认删除
              </button>
              <button type="button" className="tab" onClick={() => setPendingKeyframeDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {previewEditorShotId && (
        <div className="modal">
          <div className="modal-content preview-editor">
            {(() => {
              const shot = (chapter.storyboards || []).find((item) => item.id === previewEditorShotId);
              if (!shot) return null;
              const composition = shot.composition || [];
              const activeElement = composition.find((item) => item.id === activeElementId);
              return (
                <>
                  <div className="space-between">
                    <h4>拼图草图编辑（镜头 {shot.shotNumber}）</h4>
                    <div className="row">
                      <button type="button" onClick={() => handleExportComposition(shot)}>
                        导出草图
                      </button>
                      <button type="button" className="tab" onClick={() => setPreviewEditorShotId(null)}>
                        关闭
                      </button>
                    </div>
                  </div>
                  <div className="preview-editor-body">
                    <div className="preview-editor-stage" onClick={() => setActiveElementId(null)}>
                      <div className="preview-editor-frame">
                        <div className={`preview-editor-canvas mode-${interactionMode}`}>
                          {renderCompositionPreview(shot, true)}
                          {!composition.length && <div className="empty">暂无拼图元素，请从右侧资源添加。</div>}
                        </div>
                      </div>
                    </div>
                    <div className="preview-editor-panel">
                      <div className="panel-section">
                        <h5>工具</h5>
                        <div className="tool-row">
                          <button
                            type="button"
                            className={interactionMode === 'move' ? 'tool-button active' : 'tool-button'}
                            onClick={() => setInteractionMode('move')}
                          >
                            移动
                          </button>
                          <button
                            type="button"
                            className={interactionMode === 'rotate' ? 'tool-button active' : 'tool-button'}
                            onClick={() => setInteractionMode('rotate')}
                          >
                            旋转
                          </button>
                          <button
                            type="button"
                            className={interactionMode === 'scale' ? 'tool-button active' : 'tool-button'}
                            onClick={() => setInteractionMode('scale')}
                          >
                            缩放
                          </button>
                        </div>
                        <p className="hint">提示：选中元素后，按住鼠标拖动即可按当前工具进行操作。</p>
                      </div>
                      <div className="panel-section">
                        <h5>资源添加</h5>
                        {resourceSections.map((section) => (
                          <div key={section.key} className="resource-section">
                            <div className="resource-section-header">{section.label}</div>
                            <div className="resource-panel">
                              {(section.key === 'characters' ? characters : section.key === 'scenes' ? scenes : props).map(
                                (item) => {
                                  const coverImage = resolveResourceCover(section.key, item);
                                  return (
                                    <button
                                      key={item.id || item.name}
                                      type="button"
                                      className="resource-card"
                                      onClick={() =>
                                        addCompositionElement(shot.id, {
                                          id: crypto.randomUUID(),
                                          type: section.key,
                                          name: item.name,
                                          src: coverImage,
                                          x: 50,
                                          y: 50,
                                          scale: 1,
                                          rotate: 0,
                                          width: section.key === 'scenes' ? 100 : 35
                                        })
                                      }
                                      disabled={!coverImage}
                                    >
                                      <div className="resource-cover">
                                        {coverImage ? <img src={coverImage} alt={item.name} /> : <div className="cover-placeholder">无封面</div>}
                                      </div>
                                      <div className="resource-name">{item.name}</div>
                                    </button>
                                  );
                                }
                              )}
                              {(section.key === 'characters' ? characters : section.key === 'scenes' ? scenes : props).length === 0 && (
                                <div className="empty">暂无资源，请先在资源库添加。</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="panel-section">
                        <h5>元素编辑</h5>
                        {activeElement ? (
                          <>
                            <div className="element-title">
                              当前元素：{activeElement.name || activeElement.type}
                            </div>
                            <label>
                              缩放
                              <input
                                type="range"
                                min="0.2"
                                max="3"
                                step="0.05"
                                value={activeElement.scale ?? 1}
                                onChange={(event) =>
                                  updateComposition(shot.id, activeElement.id, {
                                    scale: Number(event.target.value)
                                  })
                                }
                              />
                            </label>
                            <label>
                              旋转
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={activeElement.rotate ?? 0}
                                onChange={(event) =>
                                  updateComposition(shot.id, activeElement.id, {
                                    rotate: Number(event.target.value)
                                  })
                                }
                              />
                            </label>
                            <label>
                              尺寸
                              <input
                                type="range"
                                min="10"
                                max="100"
                                step="1"
                                value={activeElement.width ?? 30}
                                onChange={(event) =>
                                  updateComposition(shot.id, activeElement.id, {
                                    width: Number(event.target.value)
                                  })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => removeCompositionElement(shot.id, activeElement.id)}
                            >
                              删除元素
                            </button>
                            <p className="hint">提示：在画布中拖动元素可调整位置。</p>
                          </>
                        ) : (
                          <div className="empty">请选择一个元素进行编辑。</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardEditor;
