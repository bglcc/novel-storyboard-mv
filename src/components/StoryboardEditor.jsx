import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';
import { saveFileWithFallback, sha256, validateFile } from '../utils/localFileBridge';
import { SHOT_LEVEL_CONFIG, FIELD_LABELS } from './StoryboardEditor/constants/shotLevelConfig';
import { RESOURCE_ABBREVIATIONS, RESOURCE_TYPE_LABELS } from './StoryboardEditor/constants/resourceConfig';
import { getShotValidation } from './StoryboardEditor/utils/validators';
import { migrateChapterStoryboard } from './StoryboardEditor/utils/migration';
import { buildImportValidationMessage, validateImportedShotList } from './StoryboardEditor/utils/importValidator';
import { getResourceStatusLabel } from '../constants/resourceStatusLabelDict';
import { ResourceService } from '../services/ResourceService';
import { ResourceErrorCodes } from '../constants/errorCodes';
import characterPlaceholder from '../assets/placeholders/character-placeholder.svg';
import scenePlaceholder from '../assets/placeholders/scene-placeholder.svg';
import propPlaceholder from '../assets/placeholders/prop-placeholder.svg';

const levels = [
  { value: 'L1', label: 'L1 静态单层' },
  { value: 'L2', label: 'L2 资源拟动' },
  { value: 'L3', label: 'L3 复杂动作' },
  { value: 'L4', label: 'L4 多人交互' }
];

const A_LEVEL_CLIP_STANDARD_PARAMS = '分辨率：1920×1080，帧率：24帧/秒，画幅比例：16:9，转场方式：硬切，转场时长：0.1秒，单镜头时长：按分镜JSON shotDuration字段，音频类型：国风纯音乐（背景）+基础音效，音量：背景乐30%，音效80%';
const B_LEVEL_MANUAL_FOCUS = '中等级镜头：优先保证节奏连贯，按动作起止点微调时长与转场。';
const C_LEVEL_MANUAL_FOCUS = '基础镜头：优先保证叙事清晰，避免复杂转场，人工复核字幕与音效落点。';

const levelToClipGrade = (level) => {
  if (level === 'L3' || level === 'L4') return 'A';
  if (level === 'L2') return 'B';
  return 'C';
};

const generateClipMethod = (shot = {}) => {
  const shotNumber = shot.shotNumber || '未编号镜头';
  const shotType = shot.shotType || '镜头';
  const shotMotion = shot.shotMotion || '固定';
  const cameraAngle = shot.cameraAngle || '平视';
  const visualContent = shot.visualContent || shot.visualDescription || shot.sceneDescription || '画面信息待补充';
  const soundEffect = shot.soundEffect || '无';
  const sceneBelong = shot.sceneBelong || shot.sceneDescription || '未标注场景';
  return `${shotNumber}：以${cameraAngle}${shotType}执行${shotMotion}，主画面为「${visualContent}」，场景定位「${sceneBelong}」，音效/台词为「${soundEffect}」。建议以前后镜头动作方向一致的硬切或轻转场衔接。`;
};

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
  shotMotion: '',
  cameraAngle: '',
  sceneBelong: '',
  sceneDescription: '',
  visualContent: '',
  materialContent: [],
  soundEffect: '',
  shotTime: '',
  visualDescription: '',
  editMethod: ''
};

const CHARACTER_DEFAULT_SUBTYPE = '正面全身';

const makeResourceRequirement = (resource = {}) => ({
  id: resource.id || crypto.randomUUID(),
  type: String(resource.type || 'props'),
  resourceName: String(resource.name || ''),
  prompt: String(resource.prompt || ''),
  anchorImageRef: String(resource.id || ''),
  shotRole: String(resource.shotRole || ''),
  notes: String(resource.notes || ''),
  styleTags: Array.isArray(resource.styleTags) ? resource.styleTags : [],
  variantLabel: String(resource.variantLabel || resource.subType || '')
});

const ensureResourceStructure = (resource = {}) => {
  const normalizedSubType = resource.type === 'characters'
    ? String(resource.subType || CHARACTER_DEFAULT_SUBTYPE)
    : String(resource.subType || '');
  const requirement = {
    ...makeResourceRequirement(resource),
    ...(resource.requirement || {})
  };
  return {
    ...resource,
    subType: normalizedSubType,
    requirement,
    statusLabel: getResourceStatusLabel(resource.status || 'missing')
  };
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
  subType: type === 'characters' ? CHARACTER_DEFAULT_SUBTYPE : '',
  requirement: makeResourceRequirement({ type }),
  prompt: '',
  status: 'missing',
  statusLabel: getResourceStatusLabel('missing'),
  fileName: '',
  localPath: '',
  remoteUrl: '',
  preview: '',
  updatedAt: null
});

const validateCharacterResource = (resource = {}) => {
  if (resource?.type !== 'characters') return { ok: true };
  if (resource?.status === 'uploaded' && resource?.fileName) return { ok: true };
  if (resource?.status === 'uploaded' || resource?.fileName) return { ok: true };
  return { ok: false, message: '角色资源创建时必须上传「正面全身图」。' };
};

const makeKeyframe = (index) => ({
  id: crypto.randomUUID(),
  name: `关键帧 ${index + 1}`,
  ...baseFrameFields,
  resources: [],
  imageAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null },
  videoAsset: { fileName: '', localPath: '', remoteUrl: '', preview: '', updatedAt: null }
});

const makeShot = (index, outlineIndex = index, volumeNumber = 1) => ({
  id: crypto.randomUUID(),
  shotNumber: toShotNumber(index, volumeNumber),
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

const toShotNumber = (index, volumeNumber = 1) => `V${volumeNumber}-S${String(index + 1).padStart(3, '0')}`;

const withReorderedShotNumbers = (shots = [], volumeNumber = 1) =>
  shots.map((shot, index) => ({
    ...shot,
    shotNumber: toShotNumber(index, volumeNumber)
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('预览读取失败'));
    reader.readAsDataURL(file);
  });
};

const safelyRevokePreview = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const dataUrlToBlob = (dataUrl) => {
  const [meta, base64] = String(dataUrl || '').split(',');
  if (!meta || !base64) return null;
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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
    return {
      id: crypto.randomUUID(),
      type: 'characters',
      code: 'unknown',
      name: raw || '未命名资源',
      status: 'uploaded',
      statusLabel: getResourceStatusLabel('uploaded')
    };
  }
  const [abbr, code, ...rest] = parts;
  const type = Object.keys(RESOURCE_ABBREVIATIONS).find((key) => RESOURCE_ABBREVIATIONS[key] === abbr) || 'characters';
  return {
    id: crypto.randomUUID(),
    type,
    code,
    name: rest.join('-') || '未命名资源',
    status: 'uploaded',
    statusLabel: getResourceStatusLabel('uploaded'),
    fileName: '',
    localPath: '',
    remoteUrl: '',
    preview: '',
    updatedAt: null
  };
};

const normalizeMaterialContentEntries = (value) => {
  const rawEntries = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim()
      ? value.split(/[;；,，\n]/).map((item) => item.trim()).filter(Boolean)
      : []);

  return rawEntries
    .map((entry) => {
      const typeMap = {
        character: 'characters',
        characters: 'characters',
        '角色': 'characters',
        scene: 'scenes',
        scenes: 'scenes',
        '场景': 'scenes',
        prop: 'props',
        props: 'props',
        '道具': 'props'
      };

      if (typeof entry === 'string') {
        const parsed = entry.split(/[:：]/).map((item) => item.trim()).filter(Boolean);
        if (parsed.length >= 2) {
          const [rawType, ...names] = parsed;
          const type = typeMap[String(rawType || '').toLowerCase()] || typeMap[rawType] || 'props';
          return { type, name: names.join(':').trim() };
        }
        return { type: 'props', name: entry.trim() };
      }

      if (!entry || typeof entry !== 'object') return null;
      const rawType = String(entry.type || '').trim().toLowerCase();
      const type = typeMap[rawType] || typeMap[String(entry.type || '').trim()] || rawType;
      const name = String(entry.name || entry.resourceName || entry.label || '').trim();
      if (!type || !name) return null;
      return { type, name };
    })
    .filter((entry) => entry?.name);
};

const getPlaceholderByType = (type) => {
  if (type === 'scenes') return scenePlaceholder;
  if (type === 'props') return propPlaceholder;
  return characterPlaceholder;
};

const normalizeResourceType = (value) => {
  const typeMap = {
    character: 'characters',
    characters: 'characters',
    '角色': 'characters',
    scene: 'scenes',
    scenes: 'scenes',
    '场景': 'scenes',
    prop: 'props',
    props: 'props',
    '道具': 'props'
  };
  const normalized = String(value || '').trim().toLowerCase();
  return typeMap[normalized] || typeMap[String(value || '').trim()] || normalized;
};

const normalizeShotLookupKey = (value) => String(value || '').trim().toLowerCase();

const collectImportedPromptItems = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.requirements)) return parsed.requirements;
  if (Array.isArray(parsed?.resourcePrompts)) return parsed.resourcePrompts;
  if (Array.isArray(parsed?.items)) return parsed.items;
  return [];
};

const toImportedResourcePrompt = (entry = {}) => {
  const type = normalizeResourceType(entry?.type || entry?.resourceType || 'props');
  const resourceName = String(entry?.resourceName || entry?.name || entry?.label || '').trim();
  if (!type || !resourceName) return null;
  return {
    ...entry,
    type,
    resourceName,
    prompt: String(entry?.prompt || ''),
    anchorImageRef: String(entry?.anchorImageRef || entry?.anchor || ''),
    variantLabel: String(entry?.variantLabel || entry?.assetProfile || '').trim()
  };
};

const normalizeImportedPromptMap = (parsed) => {
  const items = collectImportedPromptItems(parsed);
  const normalizedMap = new Map();

  items.forEach((item) => {
    const shotKey = normalizeShotLookupKey(item?.shotId || item?.shotNumber || item?.shotNo || item?.shot_no || item?.shot);
    if (!shotKey) return;
    const base = normalizedMap.get(shotKey) || {
      prompt: '',
      videoPromptDraft: '',
      resourcePrompts: []
    };

    const nestedResourcePrompts = Array.isArray(item?.resourcePrompts)
      ? item.resourcePrompts.map(toImportedResourcePrompt).filter(Boolean)
      : [];
    const inlineResourcePrompt = toImportedResourcePrompt(item);
    const mergedResourcePrompts = [...base.resourcePrompts, ...nestedResourcePrompts, ...(inlineResourcePrompt ? [inlineResourcePrompt] : [])];

    normalizedMap.set(shotKey, {
      prompt: String(item?.prompt || base.prompt || ''),
      videoPromptDraft: String(item?.videoPromptDraft || base.videoPromptDraft || ''),
      resourcePrompts: mergedResourcePrompts
    });
  });

  return normalizedMap;
};

const buildImportedPromptVariantLabel = (entry = {}) => {
  const explicit = String(entry?.variantLabel || entry?.assetProfile || '').trim();
  const prompt = String(entry?.prompt || '').trim();
  if (!prompt) return explicit;

  const segments = prompt
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const firstVisualSegment = segments.find((item) => /(?:近景|中景|远景|特写|全景|半身|面部)/.test(item)) || '';

  const actionMatch = prompt.match(/动作[:：]\s*([^，,。]+)/);
  const expressionMatch = prompt.match(/表情[:：]\s*([^，,。]+)/);
  const viewMatch = prompt.match(/视角[:：]\s*([^，,。]+)/);

  const parts = [];
  if (firstVisualSegment) parts.push(firstVisualSegment);
  if (actionMatch?.[1]) parts.push(actionMatch[1].trim());
  if (expressionMatch?.[1]) parts.push(expressionMatch[1].trim());

  const parsed = parts.join('-').trim();
  const base = parsed || explicit;
  if (viewMatch?.[1]) {
    return base ? `${base}，视角：${viewMatch[1].trim()}` : `视角：${viewMatch[1].trim()}`;
  }
  return base;
};


const CHARACTER_REQUIRED_VIEW_ANGLE = '正面-全身-站立';

const hasCharacterRequiredView = (resource = {}) => {
  const formViews = Array.isArray(resource?.form)
    ? resource.form.flatMap((form) => form?.viewAssets || [])
    : [];
  const metaViews = Array.isArray(resource?.meta?.viewAssets) ? resource.meta.viewAssets : [];
  const allViews = [...formViews, ...metaViews].map((asset) => String(asset?.viewAngle || '').trim()).filter(Boolean);
  if (allViews.some((view) => view === CHARACTER_REQUIRED_VIEW_ANGLE || view.startsWith('正面-全身'))) return true;
  if (Array.isArray(resource?.images) && resource.images.length > 0) {
    return allViews.length === 0;
  }
  return false;
};

const normalizeVariantLookupKey = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_—–]+/g, '-')
  .replace(/-+/g, '-');

const isVariantLabelMatched = (left = '', right = '') => {
  const a = normalizeVariantLookupKey(left);
  const b = normalizeVariantLookupKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const getResourcePromptTemplate = (resource = {}) => {
  const name = String(resource?.name || '').trim() || '未命名资源';
  const variant = String(resource?.requirement?.variantLabel || resource?.subType || '').trim();
  if (resource?.type === 'characters') {
    return `${name}${variant ? `，子项：${variant}` : ''}，背景：纯白干净背景，光线：自然光，风格：写实古风，无文字无水印`;
  }
  if (resource?.type === 'scenes') {
    return `场景名：${name}${variant ? `，子项：${variant}` : ''}，要求：无核心人物、无文字，干净背景层，适配角色叠加合成，风格：写实古风`;
  }
  return `道具名：${name}${variant ? `，子项：${variant}` : ''}，要求：主体清晰、背景干净，风格统一，无文字无水印`;
};

const extractVariantFromPrompt = (promptText = '') => {
  const prompt = String(promptText || '').trim();
  if (!prompt) return '';
  const directMatch = prompt.match(/(?:子项|视角|构图|机位|版本)[:：]\s*([^，,\n。]+)/);
  if (directMatch?.[1]) return directMatch[1].trim();
  return '';
};

const getResourceVariantDemand = (resource = {}) => {
  const requirement = resource?.requirement || {};
  const explicit = String(requirement?.variantLabel || requirement?.assetProfile || resource?.subType || '').trim();
  if (explicit) return explicit;
  return extractVariantFromPrompt(resource?.prompt || requirement?.prompt || '');
};

const resolveLibraryResourceAvailability = (resource = {}, libraryResource = {}) => {
  const fallbackPreview = pickResourceCover(libraryResource);
  const fallbackFileName = String(libraryResource?.fileName || '').trim();

  if (resource?.type === 'characters') {
    const requiredVariant = getResourceVariantDemand(resource);
    const viewAssetsFromForm = Array.isArray(libraryResource?.form)
      ? libraryResource.form.flatMap((form) => form?.viewAssets || [])
      : [];
    const viewAssetsFromMeta = Array.isArray(libraryResource?.meta?.viewAssets) ? libraryResource.meta.viewAssets : [];
    const viewAssets = [...viewAssetsFromForm, ...viewAssetsFromMeta].filter(Boolean);
    const matchedAsset = requiredVariant
      ? viewAssets.find((asset) => isVariantLabelMatched(asset?.viewAngle || '', requiredVariant))
      : viewAssets[0];
    const hasAnyAsset = Boolean(matchedAsset || (Array.isArray(libraryResource?.images) && libraryResource.images.length > 0));

    if (!requiredVariant) {
      return {
        available: hasAnyAsset && hasCharacterRequiredView(libraryResource),
        preview: (matchedAsset?.src || matchedAsset?.url || '') || fallbackPreview,
        fileName: String(matchedAsset?.fileName || '') || fallbackFileName
      };
    }

    return {
      available: Boolean(matchedAsset),
      preview: (matchedAsset?.src || matchedAsset?.url || '') || fallbackPreview,
      fileName: String(matchedAsset?.fileName || '') || fallbackFileName
    };
  }

  if (resource?.type === 'scenes') {
    const requiredVariant = getResourceVariantDemand(resource);
    const sceneVariants = Array.isArray(libraryResource?.meta?.sceneVariants) ? libraryResource.meta.sceneVariants : [];
    const matchedVariant = requiredVariant
      ? sceneVariants.find((variant) => isVariantLabelMatched(variant?.name || '', requiredVariant))
      : sceneVariants[0];
    const matchedImage = Array.isArray(matchedVariant?.images) ? matchedVariant.images[0] : null;
    const hasAnyAsset = Boolean((matchedVariant && Array.isArray(matchedVariant.images) && matchedVariant.images.length > 0)
      || (Array.isArray(libraryResource?.images) && libraryResource.images.length > 0));
    return {
      available: requiredVariant ? Boolean(matchedImage) : hasAnyAsset,
      preview: (matchedImage?.src || matchedImage?.url || '') || fallbackPreview,
      fileName: String(matchedImage?.fileName || '') || fallbackFileName
    };
  }

  const requiredVariant = getResourceVariantDemand(resource);
  const propVariants = Array.isArray(libraryResource?.meta?.propVariants) ? libraryResource.meta.propVariants : [];
  const matchedVariant = requiredVariant
    ? propVariants.find((variant) => isVariantLabelMatched(variant?.name || '', requiredVariant))
    : propVariants[0];
  const matchedImage = Array.isArray(matchedVariant?.images) ? matchedVariant.images[0] : null;
  const hasAnyAsset = Boolean((matchedVariant && Array.isArray(matchedVariant.images) && matchedVariant.images.length > 0)
    || (Array.isArray(libraryResource?.images) && libraryResource.images.length > 0));
  return {
    available: requiredVariant ? Boolean(matchedImage) : hasAnyAsset,
    preview: (matchedImage?.src || matchedImage?.url || '') || fallbackPreview,
    fileName: String(matchedImage?.fileName || '') || fallbackFileName
  };
};

const getResourceTextMeta = (resource = {}) => ({
  name: String(resource?.name || resource?.title || resource?.label || resource?.resourceName || '').trim(),
  type: normalizeResourceType(resource?.type || resource?.category || resource?.resourceType || 'props')
});

const pickResourceCover = (resource = {}) => {
  const direct = resource?.preview || resource?.image || resource?.cover || resource?.thumbnail || '';
  if (direct) return direct;

  const fromImages = Array.isArray(resource?.images)
    ? resource.images.find((item) => item?.src || item?.url || item?.preview || item?.path || typeof item === 'string')
    : null;
  if (fromImages) {
    if (typeof fromImages === 'string') return fromImages;
    return fromImages.src || fromImages.url || fromImages.preview || fromImages.path || '';
  }

  const fromCharacterViews = Array.isArray(resource?.form)
    ? resource.form.flatMap((form) => form?.viewAssets || [])
    : [];
  const fromMetaViews = Array.isArray(resource?.meta?.viewAssets) ? resource.meta.viewAssets : [];
  const fromSceneVariants = Array.isArray(resource?.meta?.sceneVariants)
    ? resource.meta.sceneVariants.flatMap((variant) => variant?.images || [])
    : [];
  const fromPropVariants = Array.isArray(resource?.meta?.propVariants)
    ? resource.meta.propVariants.flatMap((variant) => variant?.images || [])
    : [];

  const candidate = [...fromCharacterViews, ...fromMetaViews, ...fromSceneVariants, ...fromPropVariants]
    .find((item) => item?.src || item?.url || item?.preview || item?.path);
  return candidate?.src || candidate?.url || candidate?.preview || candidate?.path || '';
};

const pickUnknownFields = (source = {}, knownKeys = []) => {
  const known = new Set(knownKeys);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !known.has(key))
  );
};

const StoryboardEditor = ({ novelId, chapter }) => {
  const navigate = useNavigate();
  const { data, updateChapter, appendResourceOperationLog, upsertResource } = useData();
  const [activeOutlineId, setActiveOutlineId] = useState(chapter.storyboardOutlineItems?.[0]?.id || '');
  const [activeShotId, setActiveShotId] = useState(chapter.storyboardShots?.[0]?.id || '');
  const [activeFrameId, setActiveFrameId] = useState('main');
  const [zoomPreview, setZoomPreview] = useState(null);
  const [highlightIncompleteShotId, setHighlightIncompleteShotId] = useState('');
  const [draggingShotId, setDraggingShotId] = useState('');
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedShotIds, setSelectedShotIds] = useState([]);
  const [sceneInputMode, setSceneInputMode] = useState('manual');
  const [lastMaterialRequirementMeta, setLastMaterialRequirementMeta] = useState([]);
  const [tempPackageHistory, setTempPackageHistory] = useState([]);
  const [activeResourceId, setActiveResourceId] = useState('');
  const replaceInputRef = useRef(null);
  const batchUploadRef = useRef(null);
  const outlineUploadRef = useRef(null);
  const promptUploadRef = useRef(null);
  const resourceTaskUploadRefs = useRef({});
  const uploadedReplaceUploadRefs = useRef({});
  const videoTaskUploadRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const normalizedChapterRef = useRef('');
  const [expandedFolders, setExpandedFolders] = useState({
    missing: true,
    uploaded: false,
    imageUpload: true,
    videoUpload: true
  });

  const outlineItems = chapter.storyboardOutlineItems || [];
  const shots = chapter.storyboardShots || [];

  const volumeNumber = useMemo(() => {
    const targetNovel = (data?.novels || []).find((novel) => novel.id === novelId);
    if (!targetNovel) return 1;
    const index = (targetNovel.chapters || []).findIndex((chapterItem) => chapterItem.id === chapter.id);
    return index >= 0 ? index + 1 : 1;
  }, [data?.novels, novelId, chapter.id]);

  const activeShot = useMemo(() => shots.find((item) => item.id === activeShotId) || null, [shots, activeShotId]);

  const activeFrame = useMemo(() => activeShot || null, [activeShot]);

  const canImportPrompt = Boolean(chapter?.editingWorkflow?.materialPromptGeneratedAt);
  const canGenerateVideoPrompt = Boolean(chapter?.editingWorkflow?.materialPromptImportedAt);
  const promptStage = String(chapter?.editingWorkflow?.promptStage || '').trim();
  const workflowStage = promptStage || (canImportPrompt ? 'material_prompt' : 'outline_confirmed');

  const groupedShots = useMemo(
    () =>
      outlineItems.map((outline, outlineIndex) => ({
        outline,
        outlineIndex,
        shots: shots.filter((shot) => shot.outlineIndex === outlineIndex)
      })),
    [outlineItems, shots]
  );

  const visibleShots = useMemo(
    () => groupedShots.flatMap((group) => group.shots || []),
    [groupedShots]
  );

  const canGenerateMaterialPrompt = useMemo(() => {
    const targetShots = visibleShots.length > 0 ? visibleShots : shots;
    if (!targetShots.length) return false;
    return targetShots.every((shot) => shot.completed || getShotValidation(shot).isValid);
  }, [shots, visibleShots]);

  const libraryResources = useMemo(() => {
    const pool = [];
    ['characters', 'scenes', 'props'].forEach((type) => {
      const items = Array.isArray(data?.resources?.[type]) ? data.resources[type] : [];
      items.forEach((item) => {
        const meta = getResourceTextMeta({ ...item, type });
        if (!meta.name) return;
        const firstImage = Array.isArray(item?.images) ? item.images[0] : null;
        const preview = pickResourceCover(item);
        const baseAvailable = Boolean(
          item?.isAvailable ||
          (typeof item?.status === 'string' && ['已完成', 'ready', 'uploaded'].includes(item.status)) ||
          (Array.isArray(item?.images) && item.images.length > 0) ||
          preview
        );
        const available = baseAvailable;
        pool.push({
          ...item,
          id: item?.id || crypto.randomUUID(),
          type,
          name: meta.name,
          status: available ? 'uploaded' : 'missing',
          statusLabel: getResourceStatusLabel(available ? 'uploaded' : 'missing'),
          preview,
          fileName: item?.fileName || firstImage?.fileName || ''
        });
      });
    });
    return pool;
  }, [data?.resources]);



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


  useEffect(() => {
    const availableIds = new Set(shots.map((shot) => shot.id));
    setSelectedShotIds((prev) => prev.filter((shotId) => availableIds.has(shotId)));
  }, [shots]);

  useEffect(() => {
    if (!shots.length) return;
    const chapterKey = `${chapter.id}-${shots.length}`;
    if (normalizedChapterRef.current === chapterKey) return;

    let changed = false;
    const nextShots = shots.map((shot) => {
      let shotChanged = false;
      const nextResources = (shot.resources || []).map((resource) => {
        const normalized = ensureResourceStructure(resource);
        if (
          normalized.subType !== resource.subType
          || normalized.statusLabel !== resource.statusLabel
          || (normalized.requirement?.resourceName || '') !== (resource.requirement?.resourceName || '')
          || (normalized.requirement?.type || '') !== (resource.requirement?.type || '')
          || (normalized.requirement?.prompt || '') !== (resource.requirement?.prompt || '')
        ) {
          changed = true;
          shotChanged = true;
          return normalized;
        }
        return resource;
      });
      return shotChanged ? { ...shot, resources: nextResources } : shot;
    });

    normalizedChapterRef.current = chapterKey;
    if (changed) syncShotStatus(nextShots);
  }, [chapter.id]);

  useEffect(() => {
    if (!shots.length || !libraryResources.length) return;
    let changed = false;
    const nextShots = shots.map((shot) => {
      let shotChanged = false;
      const nextResources = (shot.resources || []).map((resource) => {
        const name = String(resource?.name || '').trim().toLowerCase();
        if (!name) return resource;
        const match = libraryResources.find((item) => item.type === resource.type && String(item.name || '').trim().toLowerCase() === name);
        if (!match) return resource;
        const availability = resolveLibraryResourceAvailability(resource, match);
        const nextStatus = availability.available ? 'uploaded' : 'missing';
        const nextPreview = availability.preview || resource.preview || (nextStatus === 'uploaded' ? '' : getPlaceholderByType(resource.type));
        const nextFileName = availability.fileName || resource.fileName || '';
        const nextPrompt = String(resource?.prompt || resource?.requirement?.prompt || '').trim()
          ? resource.prompt
          : getResourcePromptTemplate(resource);
        if (
          nextStatus !== resource.status
          || nextPreview !== resource.preview
          || nextFileName !== resource.fileName
          || nextPrompt !== resource.prompt
        ) {
          changed = true;
          shotChanged = true;
          return {
            ...resource,
            status: nextStatus,
            statusLabel: getResourceStatusLabel(nextStatus),
            preview: nextPreview,
            fileName: nextFileName,
            prompt: nextPrompt
          };
        }
        return resource;
      });
      return shotChanged ? { ...shot, resources: nextResources } : shot;
    });
    if (changed) syncShotStatus(nextShots);
  }, [libraryResources, shots]);

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
    const normalized = withReorderedShotNumbers(nextShots, volumeNumber).map((shot) => {
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


  const findResourceMatch = (entry, pool = []) => {
    const normalizedName = String(entry?.name || '').trim().toLowerCase();
    if (!normalizedName) return null;
    const exact = pool.find((item) => item.type === entry.type && String(item.name || '').trim().toLowerCase() === normalizedName);
    if (exact) return exact;
    return pool.find(
      (item) => item.type === entry.type && (String(item.name || '').includes(entry.name) || entry.name.includes(String(item.name || '')))
    );
  };

  const buildResourceByEntry = (entry, sourceMatch = null, contextShot = null) => ({
    ...makeResource(entry.type),
    name: entry.name,
    subType: entry.type === 'characters' ? '正面全身' : '',
    prompt: contextShot ? `镜号 ${contextShot.shotNumber}：${contextShot.visualContent || contextShot.synopsis || ''}` : '',
    status: sourceMatch ? 'uploaded' : 'missing',
    statusLabel: getResourceStatusLabel(sourceMatch ? 'uploaded' : 'missing'),
    preview: sourceMatch?.preview || (!sourceMatch ? getPlaceholderByType(entry.type) : ''),
    fileName: sourceMatch?.fileName || '',
    localPath: sourceMatch?.localPath || '',
    remoteUrl: sourceMatch?.remoteUrl || '',
    updatedAt: Date.now(),
    matchedBy: sourceMatch ? 'library' : 'placeholder'
  });


  const getShotResourceGroups = (shot) => {
    const resources = Array.isArray(shot?.resources) ? shot.resources : [];
    return {
      characters: resources.filter((item) => item.type === 'characters').slice(0, 5),
      scenes: resources.filter((item) => item.type === 'scenes').slice(0, 1),
      props: resources.filter((item) => item.type === 'props')
    };
  };


  const inferCharacterViewAngleFromFileName = (fileName = '') => {
    const raw = String(fileName || '').trim();
    if (!raw) return CHARACTER_REQUIRED_VIEW_ANGLE;
    const normalized = raw.replace(/\.[^.]+$/, '');
    const segments = normalized.split(/[-_]/).map((item) => item.trim()).filter(Boolean);
    const angleSegment = segments.find((item) => ['正面', '侧面', '背面'].includes(item)) || '正面';
    const shotSegment = segments.find((item) => ['全身', '中景', '半身', '面部特写', '特写'].includes(item)) || '全身';
    return `${angleSegment}-${shotSegment}-站立`;
  };

  const buildNamedSceneVariants = (resourceName = '', preview = '', fileName = '') => ([{
    id: crypto.randomUUID(),
    name: resourceName || '未命名场景',
    imageRequirements: [resourceName || '场景主图'],
    images: preview ? [{ id: crypto.randomUUID(), label: resourceName || '场景主图', src: preview, fileName }] : [],
    updatedAt: Date.now()
  }]);

  const buildNamedPropVariants = (resourceName = '', preview = '', fileName = '') => ([{
    id: crypto.randomUUID(),
    name: resourceName || '未命名道具',
    imageRequirements: [resourceName || '道具主图'],
    images: preview ? [{ id: crypto.randomUUID(), label: resourceName || '道具主图', src: preview, fileName }] : [],
    updatedAt: Date.now()
  }]);

  const syncUploadedResourceToLibrary = (resource, file, preview) => {
    if (!resource?.type || !resource?.name) return;
    const type = resource.type;
    const fileName = file?.name || resource.fileName || '';
    const imageEntry = {
      id: crypto.randomUUID(),
      src: preview || '',
      fileName
    };

    if (type === 'characters') {
      const explicitVariant = getResourceVariantDemand(resource);
      const { baseName, variantRequirement } = parseCharacterDemandVariant(resource.name);
      const viewAngle = explicitVariant || variantRequirement || inferCharacterViewAngleFromFileName(fileName);
      const characterPool = Array.isArray(data?.resources?.characters) ? data.resources.characters : [];
      const baseCharacter = characterPool.find((item) => String(item?.name || '').trim().toLowerCase() === baseName.toLowerCase());
      const exactCharacter = characterPool.find((item) => String(item?.name || '').trim().toLowerCase() === String(resource?.name || '').trim().toLowerCase());
      const targetCharacter = exactCharacter || baseCharacter || resource;
      const existingForms = Array.isArray(targetCharacter?.form) && targetCharacter.form.length > 0
        ? targetCharacter.form
        : [{ id: crypto.randomUUID(), name: '默认形态', viewRequirements: [], viewAssets: [] }];
      const currentForm = existingForms[0];
      const currentRequirements = Array.isArray(currentForm?.viewRequirements) ? currentForm.viewRequirements : [];
      const nextRequirements = [CHARACTER_REQUIRED_VIEW_ANGLE, ...currentRequirements, ...(viewAngle ? [viewAngle] : [])]
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index);
      const nextViewAssetsRaw = [
        ...(Array.isArray(currentForm?.viewAssets) ? currentForm.viewAssets : []),
        {
          id: crypto.randomUUID(),
          viewAngle,
          fileName,
          src: preview || '',
          uploadedAt: new Date().toISOString()
        }
      ];
      const nextViewAssets = [];
      const seenViewAssetKeys = new Set();
      nextViewAssetsRaw.forEach((asset) => {
        const key = `${normalizeVariantLookupKey(asset?.viewAngle || '')}::${String(asset?.fileName || '').trim().toLowerCase()}::${String(asset?.src || '').trim()}`;
        if (seenViewAssetKeys.has(key)) return;
        seenViewAssetKeys.add(key);
        nextViewAssets.push(asset);
      });

      const existingImages = Array.isArray(targetCharacter?.images) ? targetCharacter.images : [];
      const nextImagesRaw = [...existingImages, imageEntry];
      const nextImages = [];
      const seenImageKeys = new Set();
      nextImagesRaw.forEach((item) => {
        const key = `${String(item?.fileName || '').trim().toLowerCase()}::${String(item?.src || '').trim()}`;
        if (seenImageKeys.has(key)) return;
        seenImageKeys.add(key);
        nextImages.push(item);
      });

      const mergedFirstForm = {
        ...currentForm,
        id: currentForm.id || crypto.randomUUID(),
        name: currentForm.name || '默认形态',
        viewRequirements: nextRequirements,
        viewAssets: nextViewAssets
      };
      const nextForms = [mergedFirstForm, ...existingForms.slice(1)];
      const existingMetaViewRequirements = Array.isArray(targetCharacter?.meta?.viewRequirements)
        ? targetCharacter.meta.viewRequirements
        : [];
      const mergedMetaViewRequirements = [...existingMetaViewRequirements, ...nextRequirements]
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index);
      const existingMetaViewAssets = Array.isArray(targetCharacter?.meta?.viewAssets) ? targetCharacter.meta.viewAssets : [];
      const mergedMetaViewAssetsRaw = [...existingMetaViewAssets, ...nextViewAssets];
      const mergedMetaViewAssets = [];
      const seenMetaAssetKeys = new Set();
      mergedMetaViewAssetsRaw.forEach((asset) => {
        const key = `${normalizeVariantLookupKey(asset?.viewAngle || '')}::${String(asset?.fileName || '').trim().toLowerCase()}::${String(asset?.src || '').trim()}`;
        if (seenMetaAssetKeys.has(key)) return;
        seenMetaAssetKeys.add(key);
        mergedMetaViewAssets.push(asset);
      });

      upsertResource(type, {
        id: targetCharacter.id || resource.id,
        type,
        name: targetCharacter.name || baseName || resource.name,
        aliases: Array.isArray(targetCharacter.aliases) ? targetCharacter.aliases : [],
        description: resource.prompt || targetCharacter.description || resource.name,
        status: '已完成',
        isAvailable: mergedMetaViewRequirements.includes(CHARACTER_REQUIRED_VIEW_ANGLE),
        images: nextImages,
        image: preview || '',
        preview: preview || '',
        fileName,
        form: nextForms,
        meta: {
          ...(targetCharacter.meta || {}),
          viewRequirements: mergedMetaViewRequirements,
          viewAssets: mergedMetaViewAssets
        },
        updatedAt: Date.now()
      });
      return;
    }

    const pool = Array.isArray(data?.resources?.[type]) ? data.resources[type] : [];
    const targetResource = pool.find((item) => String(item?.name || '').trim().toLowerCase() === String(resource?.name || '').trim().toLowerCase()) || resource;
    const existingImages = Array.isArray(targetResource?.images) ? targetResource.images : [];
    const nextImagesRaw = [...existingImages, imageEntry];
    const nextImages = [];
    const seenImageKeys = new Set();
    nextImagesRaw.forEach((item) => {
      const key = `${String(item?.fileName || '').trim().toLowerCase()}::${String(item?.src || '').trim()}`;
      if (seenImageKeys.has(key)) return;
      seenImageKeys.add(key);
      nextImages.push(item);
    });

    const variantName = getResourceVariantDemand(resource) || resource.name;
    let typedMeta = { ...(targetResource?.meta || {}) };

    if (type === 'scenes') {
      const existingVariants = Array.isArray(targetResource?.meta?.sceneVariants) ? targetResource.meta.sceneVariants : [];
      const matchIndex = existingVariants.findIndex((variant) => isVariantLabelMatched(variant?.name || '', variantName));
      const nextVariantImage = {
        id: crypto.randomUUID(),
        label: variantName || resource.name || '场景主图',
        src: preview || '',
        fileName
      };
      const nextVariants = [...existingVariants];
      if (matchIndex >= 0) {
        const current = nextVariants[matchIndex] || {};
        const currentImages = Array.isArray(current?.images) ? current.images : [];
        const mergedImages = [...currentImages, nextVariantImage].filter((item, index, array) => {
          const key = `${String(item?.fileName || '').trim().toLowerCase()}::${String(item?.src || '').trim()}`;
          return array.findIndex((row) => `${String(row?.fileName || '').trim().toLowerCase()}::${String(row?.src || '').trim()}` === key) === index;
        });
        nextVariants[matchIndex] = {
          ...current,
          name: current?.name || variantName,
          imageRequirements: Array.isArray(current?.imageRequirements) && current.imageRequirements.length > 0
            ? current.imageRequirements
            : [variantName],
          images: mergedImages,
          updatedAt: Date.now()
        };
      } else {
        nextVariants.push({
          id: crypto.randomUUID(),
          name: variantName,
          imageRequirements: [variantName],
          images: [nextVariantImage],
          updatedAt: Date.now()
        });
      }
      typedMeta = {
        ...typedMeta,
        sceneVariants: nextVariants
      };
    } else if (type === 'props') {
      const existingVariants = Array.isArray(targetResource?.meta?.propVariants) ? targetResource.meta.propVariants : [];
      const matchIndex = existingVariants.findIndex((variant) => isVariantLabelMatched(variant?.name || '', variantName));
      const nextVariantImage = {
        id: crypto.randomUUID(),
        label: variantName || resource.name || '道具主图',
        src: preview || '',
        fileName
      };
      const nextVariants = [...existingVariants];
      if (matchIndex >= 0) {
        const current = nextVariants[matchIndex] || {};
        const currentImages = Array.isArray(current?.images) ? current.images : [];
        const mergedImages = [...currentImages, nextVariantImage].filter((item, index, array) => {
          const key = `${String(item?.fileName || '').trim().toLowerCase()}::${String(item?.src || '').trim()}`;
          return array.findIndex((row) => `${String(row?.fileName || '').trim().toLowerCase()}::${String(row?.src || '').trim()}` === key) === index;
        });
        nextVariants[matchIndex] = {
          ...current,
          name: current?.name || variantName,
          imageRequirements: Array.isArray(current?.imageRequirements) && current.imageRequirements.length > 0
            ? current.imageRequirements
            : [variantName],
          images: mergedImages,
          updatedAt: Date.now()
        };
      } else {
        nextVariants.push({
          id: crypto.randomUUID(),
          name: variantName,
          imageRequirements: [variantName],
          images: [nextVariantImage],
          updatedAt: Date.now()
        });
      }
      typedMeta = {
        ...typedMeta,
        propVariants: nextVariants
      };
    }

    upsertResource(type, {
      id: targetResource.id || resource.id,
      type,
      name: targetResource.name || resource.name,
      aliases: Array.isArray(targetResource?.aliases) ? targetResource.aliases : [],
      description: resource.prompt || targetResource.description || resource.name,
      status: '已完成',
      isAvailable: true,
      images: nextImages,
      image: preview || '',
      preview: preview || '',
      fileName,
      updatedAt: Date.now(),
      meta: typedMeta
    });
  };

  const mergeShotResources = (shot, fallbackResources = []) => {
    const existing = Array.isArray(shot.resources) ? shot.resources : [];
    const merged = [...existing];
    const existingKey = new Set(existing.map((res) => `${res.type}::${String(res.name || '').trim().toLowerCase()}`));
    fallbackResources.forEach((res) => {
      const key = `${res.type}::${String(res.name || '').trim().toLowerCase()}`;
      if (!existingKey.has(key)) {
        existingKey.add(key);
        merged.push(res);
      }
    });
    return merged;
  };

  const collectResourceDemandEntries = (shot = {}) => {
    const fromMaterial = normalizeMaterialContentEntries(shot.materialContent);
    const fromResources = (Array.isArray(shot.resources) ? shot.resources : [])
      .map((item) => ({ type: normalizeResourceType(item?.type), name: String(item?.name || '').trim() }))
      .filter((item) => item.name);
    const fromScene = String(shot.sceneBelong || '').trim() ? [{ type: 'scenes', name: String(shot.sceneBelong).trim() }] : [];
    const unique = new Map();
    [...fromMaterial, ...fromResources, ...fromScene].forEach((item) => {
      const key = `${item.type}::${item.name.toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return Array.from(unique.values());
  };


  const parseCharacterDemandVariant = (name = '') => {
    const normalized = String(name || '').trim();
    if (!normalized) return { baseName: '', variantRequirement: '' };
    const segments = normalized.split(/[-—–_]+/).map((item) => item.trim()).filter(Boolean);
    if (segments.length <= 1) return { baseName: normalized, variantRequirement: '' };
    const [baseName, ...rest] = segments;
    return {
      baseName: baseName || normalized,
      variantRequirement: rest.join('-')
    };
  };

  const appendCharacterViewRequirement = (resource = {}, requirement = '') => {
    const normalizedRequirement = String(requirement || '').trim();
    if (!normalizedRequirement) return resource;

    const metaViewRequirements = Array.isArray(resource?.meta?.viewRequirements)
      ? resource.meta.viewRequirements
      : [];
    const nextMetaViewRequirements = metaViewRequirements.includes(normalizedRequirement)
      ? metaViewRequirements
      : [...metaViewRequirements, normalizedRequirement];

    const existingForms = Array.isArray(resource?.form) && resource.form.length > 0
      ? resource.form
      : [{ id: crypto.randomUUID(), name: '默认形态', viewRequirements: [], viewAssets: [] }];

    const nextForms = existingForms.map((form, index) => {
      if (index !== 0) return form;
      const currentRequirements = Array.isArray(form?.viewRequirements) ? form.viewRequirements : [];
      return {
        ...form,
        viewRequirements: currentRequirements.includes(normalizedRequirement)
          ? currentRequirements
          : [...currentRequirements, normalizedRequirement],
        viewAssets: Array.isArray(form?.viewAssets) ? form.viewAssets : []
      };
    });

    return {
      ...resource,
      form: nextForms,
      meta: {
        ...(resource?.meta || {}),
        viewRequirements: nextMetaViewRequirements,
        viewAssets: Array.isArray(resource?.meta?.viewAssets) ? resource.meta.viewAssets : []
      }
    };
  };

  const createLibraryDemandsForShots = (targetShots = []) => {
    const created = [];
    const seen = new Set();
    targetShots.forEach((shot) => {
      const entries = collectResourceDemandEntries(shot);
      entries.forEach((entry) => {
        const key = `${entry.type}::${entry.name.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);

        const sameTypeResources = Array.isArray(data?.resources?.[entry.type]) ? data.resources[entry.type] : [];
        const exists = sameTypeResources.some((item) => String(item?.name || '').trim().toLowerCase() === entry.name.toLowerCase());
        if (exists) return;

        if (entry.type === 'characters') {
          const { baseName, variantRequirement } = parseCharacterDemandVariant(entry.name);
          const baseCharacter = sameTypeResources.find((item) => String(item?.name || '').trim().toLowerCase() === baseName.toLowerCase());

          if (baseCharacter && variantRequirement) {
            const patchedCharacter = appendCharacterViewRequirement(baseCharacter, variantRequirement);
            upsertResource('characters', {
              ...patchedCharacter,
              id: baseCharacter.id,
              type: 'characters',
              status: patchedCharacter?.status || '待补齐',
              isAvailable: Boolean(patchedCharacter?.isAvailable),
              images: Array.isArray(patchedCharacter?.images) ? patchedCharacter.images : []
            });
            created.push({ ...entry, linkedTo: baseName, mode: 'character-variant' });
            return;
          }

          upsertResource('characters', {
            id: crypto.randomUUID(),
            type: 'characters',
            name: entry.name,
            status: '待补齐',
            isAvailable: false,
            images: [],
            form: [{ id: crypto.randomUUID(), name: '默认形态', viewRequirements: [CHARACTER_REQUIRED_VIEW_ANGLE], viewAssets: [] }],
            meta: { viewRequirements: [CHARACTER_REQUIRED_VIEW_ANGLE], viewAssets: [] }
          });
        } else if (entry.type === 'scenes') {
          upsertResource('scenes', {
            id: crypto.randomUUID(),
            type: 'scenes',
            name: entry.name,
            status: '待补齐',
            isAvailable: false,
            images: [],
            meta: { sceneVariants: buildNamedSceneVariants(entry.name) }
          });
        } else {
          upsertResource('props', {
            id: crypto.randomUUID(),
            type: 'props',
            name: entry.name,
            status: '待补齐',
            isAvailable: false,
            images: [],
            meta: { propVariants: buildNamedPropVariants(entry.name) }
          });
        }
        created.push(entry);
      });
    });
    return created;
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

      const normalizedSource = source.map((item) => {
        const synopsis = String(item?.synopsis || item?.text || item?.outlineText || item?.content || '').trim();
        return synopsis
          ? item
          : { ...item, synopsis: item?.shotNumber || item?.shotId || '导入镜头' };
      });

      const validationResult = validateImportedShotList(normalizedSource);
      if (!validationResult.valid) {
        throw new Error(buildImportValidationMessage(validationResult));
      }
      const nextShots = normalizedSource.map((item, index) => {
        const isNewShape = item?.mainFrame || item?.shotNumber;
        const mainFrame = item?.mainFrame || {};
        const resourcesRaw = mainFrame?.resources || item?.resources || [];
        const rawTopLevelUnknown = pickUnknownFields(item, [
          'id', 'shotNumber', 'shotId', 'outlineIndex', 'synopsis', 'text', 'outlineText', 'content',
          'level', 'frameMode', 'keyframes', 'title', 'shotType', 'shotMotion', 'cameraAngle', 'sceneBelong', 'sceneDescription',
          'visualContent', 'materialContent', 'soundEffect', 'shotTime', 'visualDescription', 'editMethod', 'transitionToNext', 'duration', 'imageAsset',
          'videoAsset', 'resources', 'status', 'completed', 'updatedAt', 'completedAt',
          'audioPlaceholders', 'dialoguePlaceholder', 'bgmPlaceholder', 'sfxPlaceholder', 'mainFrame'
        ]);
        const rawMainFrameUnknown = pickUnknownFields(mainFrame, [
          'title', 'shotType', 'shotMotion', 'cameraAngle', 'sceneBelong', 'sceneDescription', 'visualContent',
          'materialContent', 'soundEffect', 'shotTime', 'visualDescription', 'editMethod', 'transitionToNext',
          'duration', 'resources', 'imageAsset', 'videoAsset'
        ]);
        const resources = (Array.isArray(resourcesRaw) ? resourcesRaw : [])
          .map((resource) => (typeof resource === 'string' ? parseResourceAbbr(resource) : resource))
          .map((resource) => ensureResourceStructure({
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
          shotNumber: item?.shotNumber || item?.shotId || toShotNumber(index, volumeNumber),
          outlineIndex: Number.isFinite(item?.outlineIndex)
            ? item.outlineIndex
            : ((chapter?.storyboardOutlineItems?.length || 0) > 0 ? 0 : -1),
          synopsis: item?.synopsis || item?.text || item?.outlineText || item?.content || '',
          level: item?.level || 'L1',
          keyframesEnabled: false,
          keyframes: [],
          title: mainFrame?.title || item?.title || '',
          shotType: mainFrame?.shotType || item?.shotType || '',
          shotMotion: mainFrame?.shotMotion || item?.shotMotion || '',
          cameraAngle: mainFrame?.cameraAngle || item?.cameraAngle || '',
          sceneBelong: mainFrame?.sceneBelong || item?.sceneBelong || sceneName || '',
          sceneDescription: mainFrame?.sceneDescription || item?.sceneDescription || sceneName,
          visualContent: mainFrame?.visualContent || item?.visualContent || mainFrame?.sceneDescription || item?.sceneDescription || '',
          materialContent: Array.isArray(mainFrame?.materialContent)
            ? mainFrame.materialContent
            : (Array.isArray(item?.materialContent) || typeof item?.materialContent === 'string' ? item.materialContent : []),
          soundEffect: mainFrame?.soundEffect || item?.soundEffect || '',
          shotTime: mainFrame?.shotTime || item?.shotTime || '',
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
          sfxPlaceholder: item?.sfxPlaceholder || item?.audioPlaceholders?.sfx || '',
          rawTopLevelUnknown,
          rawMainFrameUnknown
        };
      });

      const enhancedShots = nextShots.map((shot) => {
        const entries = normalizeMaterialContentEntries(shot.materialContent);
        const sceneEntry = String(shot.sceneBelong || '').trim()
          ? [{ type: 'scenes', name: String(shot.sceneBelong).trim() }]
          : [];
        const resolvedResources = [...entries, ...sceneEntry].map((entry) => {
          const matched = findResourceMatch(entry, libraryResources);
          return buildResourceByEntry(entry, matched, shot);
        });
        return {
          ...shot,
          prompt: shot.prompt || [shot.shotNumber, shot.shotType, shot.cameraAngle, shot.visualContent].filter(Boolean).join(' | '),
          resources: mergeShotResources(shot, resolvedResources)
        };
      });

      syncShotStatus(enhancedShots);
      const createdDemands = createLibraryDemandsForShots(enhancedShots);
      setActiveShotId(enhancedShots[0]?.id || '');
      setActiveFrameId('main');

      updateChapterPatch((currentChapter) => {
        const importedShots = Array.isArray(currentChapter?.storyboardShots) ? currentChapter.storyboardShots : [];
        const normalizedIndexes = importedShots.map((shot) => (Number.isInteger(shot?.outlineIndex) ? shot.outlineIndex : 0));
        const maxOutlineIndex = Math.max(0, ...normalizedIndexes, 0);
        const nextOutlineItems = Array.from({ length: maxOutlineIndex + 1 }, (_, index) => ({
          id: crypto.randomUUID(),
          order: index + 1,
          text: `${sceneName || '默认场景'}镜头逻辑链${maxOutlineIndex > 0 ? ` ${index + 1}` : ''}`,
          detailUploaded: true
        }));

        const patchedShots = importedShots.map((shot) => {
          const nextIndex = Number.isInteger(shot?.outlineIndex) && shot.outlineIndex >= 0
            ? Math.min(shot.outlineIndex, maxOutlineIndex)
            : 0;
          return nextIndex === shot.outlineIndex ? shot : { ...shot, outlineIndex: nextIndex };
        });

        return {
          storyboardOutlineItems: nextOutlineItems,
          storyboardShots: patchedShots,
          editingWorkflow: {
            ...(currentChapter?.editingWorkflow || {}),
            sceneId,
            sceneName
          }
        };
      });

      if (fromLegacy) {
        pushToast('检测到旧版分镜数据，已自动转换为新格式，建议补充场景关联等信息。','warning');
      } else {
        pushToast(`成功导入 ${enhancedShots.length} 条镜头逻辑链数据，并完成资源匹配与占位补齐。${createdDemands.length > 0 ? `
已自动在资源库创建 ${createdDemands.length} 条需求。` : ''}`,'success');
      }
    } catch (error) {
      pushToast(`上传失败：${error instanceof Error ? error.message : '未知错误'}`,'error');
    }
  };

  const addShot = (outlineIndex = 0) => {
    const shot = makeShot(shots.length, outlineIndex, volumeNumber);
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


  const toggleShotSelection = (shotId) => {
    setSelectedShotIds((prev) =>
      prev.includes(shotId) ? prev.filter((id) => id !== shotId) : [...prev, shotId]
    );
  };

  const selectAllShots = () => {
    setSelectedShotIds(shots.map((shot) => shot.id));
  };

  const clearSelectedShots = () => {
    setSelectedShotIds([]);
  };

  const invertSelectedShots = () => {
    const selected = new Set(selectedShotIds);
    const next = shots
      .map((shot) => shot.id)
      .filter((shotId) => !selected.has(shotId));
    setSelectedShotIds(next);
  };

  const batchDeleteSelectedShots = () => {
    if (selectedShotIds.length === 0) {
      pushToast('请先勾选要删除的镜头。', 'warning');
      return;
    }

    const selectedShots = shots.filter((shot) => selectedShotIds.includes(shot.id));
    const boundCount = selectedShots.reduce((count, shot) => count + getShotBindingCount(shot), 0);
    const message = boundCount > 0
      ? `确认删除已勾选的 ${selectedShots.length} 条镜头吗？其中包含 ${boundCount} 个已绑定素材，删除后将解除绑定且不可恢复！`
      : `确认删除已勾选的 ${selectedShots.length} 条镜头吗？删除后不可恢复！`;

    if (!window.confirm(message)) return;

    const selectedSet = new Set(selectedShotIds);
    const next = shots.filter((shot) => !selectedSet.has(shot.id));
    syncShotStatus(next);
    setSelectedShotIds([]);

    if (activeShotId && selectedSet.has(activeShotId)) {
      setActiveShotId(next[0]?.id || '');
      setActiveFrameId('main');
      setActiveResourceId('');
    }
  };

  const deleteAllShots = () => {
    if (!shots.length) {
      pushToast('当前没有可删除的镜头。', 'warning');
      return;
    }
    if (!window.confirm(`确认一键清空当前章节的 ${shots.length} 条镜头吗？该操作不可恢复！`)) return;
    syncShotStatus([]);
    setSelectedShotIds([]);
    setActiveShotId('');
    setActiveFrameId('main');
    setActiveResourceId('');
    pushToast('已清空全部分镜头。', 'success');
  };

  const getShotBindingCount = (shot) => {
    const mainBound = (shot?.resources || []).filter((resource) => resource?.status === 'uploaded').length;
    const keyframeBound = (shot?.keyframes || []).reduce(
      (count, frame) => count + (frame?.resources || []).filter((resource) => resource?.status === 'uploaded').length,
      0
    );
    return mainBound + keyframeBound;
  };

  const deleteShot = (shotId) => {
    const targetShot = shots.find((shot) => shot.id === shotId);
    if (!targetShot) return;

    const boundCount = getShotBindingCount(targetShot);
    const confirmMessage = boundCount > 0
      ? `确认删除【${targetShot.shotNumber || '未命名镜头'}】吗？该镜头包含 ${boundCount} 个已绑定素材，删除后将解除全部绑定且不可恢复！`
      : `确认删除【${targetShot.shotNumber || '未命名镜头'}】吗？删除后不可恢复！`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

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
    updateShot(activeShot.id, patch);
  };

  const addResource = () => {
    if (!activeFrame) return;
    updateActiveFrame({ resources: [...(activeFrame.resources || []), ensureResourceStructure(makeResource())] });
  };

  const addResourcesBatch = (resourcesToAdd = []) => {
    if (!activeFrame || !Array.isArray(resourcesToAdd) || resourcesToAdd.length === 0) return;
    updateActiveFrame({ resources: [...(activeFrame.resources || []), ...resourcesToAdd.map((item) => ensureResourceStructure(item))] });
  };

  const updateResource = (resourceId, patch) => {
    if (!activeFrame) return;
    const nextResources = (activeFrame.resources || []).map((resource) => {
      if (resource.id !== resourceId) return resource;
      const merged = ensureResourceStructure({ ...resource, ...patch });
      if (Object.prototype.hasOwnProperty.call(patch, 'status') && !Object.prototype.hasOwnProperty.call(patch, 'statusLabel')) {
        merged.statusLabel = getResourceStatusLabel(merged.status);
      }
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
    const resource = (activeFrame.resources || []).find((item) => item.id === resourceId);
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
      const uploadResult = await ResourceService.uploadMaterial(file, resource?.type, chapter?.id || 'default');
      if (!ResourceErrorCodes.checkVersion(uploadResult.errorCodeVersion)) {
        pushToast('资源服务错误码版本不匹配，请刷新后重试。', 'error');
        return;
      }
      if (!uploadResult.success) {
        pushToast(uploadResult.message || '资源服务返回失败。', 'error');
        return;
      }

      const { duplicate, hash } = await ensureNoDuplicateHash(file);
      if (duplicate) {
        const confirmed = window.confirm('检测到重复文件，是否覆盖并同步更新所有同 hash 资源路径？');
        if (!confirmed) {
          pushToast('已取消覆盖。', 'warning');
          return;
        }
      }

      const validation = validateCharacterResource({ ...resource, status: 'uploaded', fileName: file.name });
      if (!validation.ok) {
        pushToast(validation.message, 'error');
        return;
      }
      const targetPath = buildTargetPath(resource?.type, resource?.subType);
      const [saveResult, preview] = await Promise.all([
        saveFileWithFallback({ file, targetPath }),
        readFilePreview(file)
      ]);
      if (preview) previewUrlsRef.current.add(preview);
      safelyRevokePreview(resource?.preview);
      if (resource?.preview) previewUrlsRef.current.delete(resource.preview);

      const nextResourcePayload = {
        status: 'uploaded',
        statusLabel: getResourceStatusLabel('uploaded'),
        fileName: file.name,
        localPath: saveResult.localPath,
        preview,
        updatedAt: Date.now(),
        sourceType: saveResult.source,
        fileHash: hash
      };
      updateResource(resourceId, nextResourcePayload);
      syncUploadedResourceToLibrary({ ...resource, ...nextResourcePayload }, file, preview);
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

      appendResourceOperationLog({
        type: 'resource_upload',
        chapterId: chapter?.id,
        shotId: activeShot?.id,
        frameId: activeFrame?.id || 'main',
        resourceId,
        resourceName: resource?.name || file.name,
        status: 'uploaded'
      });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '资源上传失败，请重试。','error');
    }
  };

  const downloadResourcePromptTask = async (resource) => {
    if (!resource) return;
    try {
      const zip = new JSZip();
      const safeName = String(resource.name || 'resource').replace(/[\/:*?"<>|]/g, '-');
      const promptText = String(resource?.prompt || resource?.requirement?.prompt || '').trim() || `${resource.name || ''} 图像生成提示词待补充`;
      zip.file('prompt.txt', promptText);

      const anchor = resource.preview || '';
      if (anchor && !anchor.includes('placeholder')) {
        let blob = null;
        if (anchor.startsWith('data:')) {
          blob = dataUrlToBlob(anchor);
        } else {
          const response = await fetch(anchor);
          blob = await response.blob();
        }
        if (blob) {
          const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          zip.file(`anchor.${ext}`, blob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}-图生图任务包.zip`;
      link.click();
      URL.revokeObjectURL(url);
      pushToast(`已导出 ${resource.name || '资源'} 图生图任务包。`, 'success');
    } catch (error) {
      pushToast(`导出任务包失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  const triggerResourceTaskUpload = (resourceId) => {
    if (!resourceId) return;
    resourceTaskUploadRefs.current[resourceId]?.click();
  };

  const uploadGeneratedResourceImage = async (resourceId, file) => {
    if (!resourceId || !file) return;
    await uploadResourceFile(resourceId, file);
  };

  const downloadVideoPromptTask = async () => {
    if (!activeFrame) return;
    try {
      const zip = new JSZip();
      const anchors = (activeFrame.resources || []).filter((item) => item.status === 'uploaded' && item.preview);
      const promptText = String(activeFrame.videoPromptDraft || activeFrame.prompt || '').trim() || '视频生成提示词待补充';
      zip.file('video-prompt.txt', promptText);

      for (let index = 0; index < anchors.length; index += 1) {
        const item = anchors[index];
        let blob = null;
        if (String(item.preview).startsWith('data:')) {
          blob = dataUrlToBlob(item.preview);
        } else {
          const response = await fetch(item.preview);
          blob = await response.blob();
        }
        if (!blob) continue;
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const safeName = String(item.name || `anchor-${index + 1}`).replace(/[\/:*?"<>|]/g, '-');
        zip.file(`anchors/${index + 1}-${safeName}.${ext}`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeFrame.shotNumber || 'shot'}-视频任务包.zip`;
      link.click();
      URL.revokeObjectURL(url);
      pushToast('已导出视频任务包。', 'success');
    } catch (error) {
      pushToast(`导出视频任务包失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
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

  const toCsvCell = (value) => {
    const text = String(value ?? '');
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const exportClipGradeTable = async () => {
    const columns = ['镜号', '景别', '镜头时长（秒）', '剪辑等级', '剪映标准化参数', '人工调控重点', '音效卡点要求', '关联素材'];
    const rows = shots.map((shot) => {
      const grade = levelToClipGrade(shot.level);
      const gradeParams = grade === 'A' ? A_LEVEL_CLIP_STANDARD_PARAMS : '无固定参数';
      const linkedMaterials = (shot.resources || [])
        .filter((resource) => resource?.status === 'uploaded' && resource?.name)
        .map((resource) => resource.name)
        .join(' / ');
      const manualFocus = shot.editMethod
        || shot.visualDescription
        || (grade === 'B' ? B_LEVEL_MANUAL_FOCUS : grade === 'C' ? C_LEVEL_MANUAL_FOCUS : '按A级参数执行');

      return [
        shot.shotNumber || '',
        shot.shotType || '',
        shot.shotTime || shot.duration || '',
        grade,
        gradeParams,
        manualFocus,
        shot.audioPlaceholders?.sfx || '无',
        linkedMaterials || '无'
      ];
    });

    const allRows = [columns, ...rows];

    const escapeXml = (text) =>
      String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const cellRef = (row, col) => {
      let colName = '';
      let n = col + 1;
      while (n > 0) {
        const rem = (n - 1) % 26;
        colName = String.fromCharCode(65 + rem) + colName;
        n = Math.floor((n - 1) / 26);
      }
      return `${colName}${row + 1}`;
    };

    const sheetCells = allRows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, colIndex) => `<c r="${cellRef(rowIndex, colIndex)}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`)
          .join('');
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join('');

    const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetCells}</sheetData>
</worksheet>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="剪辑分级表" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', rootRelsXml);
    zip.folder('xl').file('workbook.xml', workbookXml);
    zip.folder('xl').folder('_rels').file('workbook.xml.rels', workbookRelsXml);
    zip.folder('xl').folder('worksheets').file('sheet1.xml', worksheetXml);
    zip.folder('xl').file('styles.xml', stylesXml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-剪辑分级表-${Date.now()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportClipPackage = () => {
    const payload = {
      novelId,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      generatedAt: new Date().toISOString(),
      chapterSummary: chapter.editingWorkflow?.chapterSummary || '',
      shots: shots.map((shot) => ({
        ...(shot.rawTopLevelUnknown || {}),
        shotNumber: shot.shotNumber,
        level: shot.level,
        synopsis: shot.synopsis,
        frameMode: 'single',
        mainFrame: {
          ...(shot.rawMainFrameUnknown || {}),
          title: shot.title,
          shotType: shot.shotType,
          shotMotion: shot.shotMotion || '',
          cameraAngle: shot.cameraAngle,
          sceneBelong: shot.sceneBelong || '',
          sceneDescription: shot.sceneDescription,
          visualContent: shot.visualContent || '',
          materialContent: Array.isArray(shot.materialContent) ? shot.materialContent : [],
          soundEffect: shot.soundEffect || '',
          shotTime: shot.shotTime,
          visualDescription: shot.visualDescription,
          editMethod: shot.editMethod,
          transitionToNext: shot.transitionToNext || '',
          resources: shot.resources,
          imageAsset: shot.imageAsset,
          videoAsset: shot.videoAsset
        },
        keyframes: [],
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

  const uploadResourceFileBatch = async (files = []) => {
    if (!activeFrame) return;
    const entries = Array.from(files || []);
    if (entries.length === 0) return;

    let success = 0;
    for (const file of entries) {
      const fileName = String(file?.name || '').toLowerCase();
      const target = (activeFrame.resources || []).find((resource) => {
        if (resource?.status === 'uploaded') return false;
        const resourceName = String(resource?.name || '').toLowerCase();
        return resourceName && fileName.includes(resourceName);
      }) || (activeFrame.resources || []).find((resource) => resource?.status !== 'uploaded');

      if (!target) continue;
      // eslint-disable-next-line no-await-in-loop
      await uploadResourceFile(target.id, file);
      success += 1;
    }
    if (success === 0) {
      pushToast('批量素材回传未匹配到可上传资源，请检查文件名与资源名称。', 'warning');
      return;
    }
    pushToast(`批量素材回传完成：成功上传 ${success} 个文件。`, 'success');
  };

  const generateClipMethodsForSelection = () => {
    const targetIds = selectedShotIds.length > 0
      ? new Set(selectedShotIds)
      : (activeShot ? new Set([activeShot.id]) : new Set());
    if (targetIds.size === 0) {
      pushToast('请先勾选镜头，或选中一个镜头后再生成剪辑手法。', 'warning');
      return;
    }
    const next = shots.map((shot) => (targetIds.has(shot.id)
      ? { ...shot, editMethod: generateClipMethod(shot) }
      : shot));
    syncShotStatus(next);
    pushToast(`已生成 ${targetIds.size} 条镜头的剪辑手法。`, 'success');
  };

  const exportClipMethodList = () => {
    const payload = shots.map((shot) => ({
      shotId: shot.id,
      shotNumber: shot.shotNumber,
      clipGrade: levelToClipGrade(shot.level),
      clipStandardParams: levelToClipGrade(shot.level) === 'A' ? A_LEVEL_CLIP_STANDARD_PARAMS : '',
      sceneBelong: shot.sceneBelong || '',
      shotType: shot.shotType || '',
      shotMotion: shot.shotMotion || '',
      visualContent: shot.visualContent || '',
      soundEffect: shot.soundEffect || '',
      editMethod: shot.editMethod || ''
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-clip-method-list.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('已导出剪辑手法清单。', 'success');
  };

  const materialCompletionCheck = () => {
    const targetIds = selectedShotIds.length > 0
      ? new Set(selectedShotIds)
      : (activeShot ? new Set([activeShot.id]) : new Set());
    if (targetIds.size === 0) {
      pushToast('请先勾选需要进行素材补齐的镜头。', 'warning');
      return;
    }

    const targetShots = shots.filter((shot) => targetIds.has(shot.id));
    const existingKeySet = new Set((activeFrame?.resources || []).map((res) => `${res.type}::${(res.name || '').trim()}`));
    const missing = [];

    targetShots.forEach((shot) => {
      const entries = normalizeMaterialContentEntries(shot.materialContent);
      entries.forEach((entry) => {
        const key = `${entry.type}::${entry.name}`;
        if (!existingKeySet.has(key)) {
          existingKeySet.add(key);
          missing.push({ ...entry, fromShotNumber: shot.shotNumber });
        }
      });

      const sceneBelong = String(shot.sceneBelong || '').trim();
      if (sceneBelong) {
        const sceneKey = `scenes::${sceneBelong}`;
        if (!existingKeySet.has(sceneKey)) {
          existingKeySet.add(sceneKey);
          missing.push({ type: 'scenes', name: sceneBelong, fromShotNumber: shot.shotNumber });
        }
      }
    });

    if (missing.length === 0) {
      pushToast('未检测到缺失资源，当前素材已完整。', 'success');
      return;
    }

    const createdResources = missing.map((item) => makeResource(item.type)).map((resource, index) => ({
      ...resource,
      name: missing[index].name,
      subType: missing[index].type === 'characters' ? CHARACTER_DEFAULT_SUBTYPE : '',
      prompt: `自动补齐：来自镜头 ${missing[index].fromShotNumber}`,
      preview: getPlaceholderByType(missing[index].type)
    }));
    addResourcesBatch(createdResources);
    pushToast(`已自动创建 ${createdResources.length} 条缺失资源。`, 'success');
  };

  const generateMaterialPrompt = () => {
    const targetIds = selectedShotIds.length > 0
      ? new Set(selectedShotIds)
      : new Set(shots.map((shot) => shot.id));
    if (targetIds.size === 0) {
      pushToast('当前无可生成提示词的镜头。', 'warning');
      return;
    }

    const targetShots = shots.filter((shot) => targetIds.has(shot.id));
    const meta = targetShots.map((shot) => {
      const resourcesForShot = normalizeMaterialContentEntries(shot.materialContent);
      const resourceText = resourcesForShot.length > 0
        ? resourcesForShot.map((item) => `${getResourceTypeLabel(item.type)}:${item.name}`).join('；')
        : '无';
      const prompt = [
        `镜号：${shot.shotNumber}`,
        `景别：${shot.shotType || '未填写'}`,
        `镜头运动：${shot.shotMotion || '固定'}`,
        `画面内容：${shot.visualContent || shot.visualDescription || '未填写'}`,
        `所属场景：${shot.sceneBelong || shot.sceneDescription || '未填写'}`,
        `音效：${shot.soundEffect || '无'}`,
        `素材需求：${resourceText}`,
        '生成要求：保持风格一致，若为图生图请尽量复用已上传资源并仅调整动作/角度。'
      ].join('\n');

      const resourcePrompts = (shot.resources || []).map((resource) => {
        const requirement = {
          ...makeResourceRequirement(resource),
          ...(resource.requirement || {})
        };
        return {
          ...requirement,
          type: normalizeResourceType(requirement.type || resource.type),
          resourceName: requirement.resourceName || resource.name || '',
          prompt: requirement.prompt || resource.prompt || '',
          anchorImageRef: requirement.anchorImageRef || resource.anchorImageRef || resource.id || '',
          variantLabel: String(requirement.variantLabel || resource.subType || '')
        };
      });

      return {
        shotId: shot.id,
        shotNumber: shot.shotNumber,
        prompt,
        resourceText,
        resourcePrompts,
        videoPromptDraft: shot.videoPromptDraft || ''
      };
    });

    const promptMap = Object.fromEntries(meta.map((item) => [item.shotId, item.prompt]));
    const next = shots.map((shot) => (promptMap[shot.id]
      ? { ...shot, prompt: promptMap[shot.id] }
      : shot));
    syncShotStatus(next);

    const payload = {
      generatedAt: new Date().toISOString(),
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      requirements: meta.map((item) => ({
        shotId: item.shotId,
        shotNumber: item.shotNumber,
        prompt: item.prompt,
        resourceText: item.resourceText,
        resourcePrompts: item.resourcePrompts,
        videoPromptDraft: item.videoPromptDraft
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-素材提示词-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setLastMaterialRequirementMeta(meta);
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        materialPromptGeneratedAt: Date.now(),
        promptStage: 'material_prompt'
      }
    }));
    pushToast(`已生成并下载 ${meta.length} 条镜头的素材提示词。`, 'success');
  };

  const importMaterialPrompt = async (file) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = parseLenientJson(raw);
      const shotPromptMap = normalizeImportedPromptMap(parsed);

      if (shotPromptMap.size === 0) {
        pushToast('未识别到可导入的提示词条目，请检查 JSON 中是否包含 shotId/shotNumber。', 'warning');
        return;
      }

      const existingLibraryByType = {
        characters: Array.isArray(data?.resources?.characters) ? data.resources.characters : [],
        scenes: Array.isArray(data?.resources?.scenes) ? data.resources.scenes : [],
        props: Array.isArray(data?.resources?.props) ? data.resources.props : []
      };
      const pendingLibraryUpserts = [];
      const pendingOperationLogs = [];

      const queueLibraryPatch = (type, resourceName, entry) => {
        const normalizedType = normalizeResourceType(type || 'props');
        const normalizedName = String(resourceName || '').trim();
        if (!normalizedName) return;
        const libraryPool = existingLibraryByType[normalizedType] || [];
        const existing = libraryPool.find((item) => String(item?.name || '').trim().toLowerCase() === normalizedName.toLowerCase());
        if (!existing) return;

        if (normalizedType === 'characters') {
          const variantLabel = buildImportedPromptVariantLabel(entry);
          if (!variantLabel) return;
          const patched = appendCharacterViewRequirement(existing, variantLabel);
          pendingLibraryUpserts.push({
            type: 'characters',
            resource: {
              ...patched,
              id: existing.id,
              type: 'characters',
              name: existing.name,
              status: patched?.status || existing.status || '待补齐',
              isAvailable: Boolean(patched?.isAvailable),
              images: Array.isArray(patched?.images) ? patched.images : []
            }
          });
          pendingOperationLogs.push({
            action: 'import_material_prompt_character_variant',
            resourceType: 'characters',
            resourceName: existing.name,
            detail: `导入提示词补充角色子项：${variantLabel}`
          });
          return;
        }

        if (normalizedType === 'scenes') {
          const variantName = String(entry?.variantLabel || entry?.assetProfile || '').trim() || `${existing.name}-导入子项`;
          const existingVariants = Array.isArray(existing?.meta?.sceneVariants) ? existing.meta.sceneVariants : [];
          if (existingVariants.some((variant) => String(variant?.name || '').trim().toLowerCase() === variantName.toLowerCase())) return;
          pendingLibraryUpserts.push({
            type: 'scenes',
            resource: {
              ...existing,
              meta: {
                ...(existing?.meta || {}),
                sceneVariants: [...existingVariants, {
                  id: crypto.randomUUID(),
                  name: variantName,
                  imageRequirements: [String(entry?.prompt || '').trim() || variantName],
                  images: [],
                  updatedAt: Date.now()
                }]
              },
              updatedAt: Date.now()
            }
          });
          pendingOperationLogs.push({
            action: 'import_material_prompt_scene_variant',
            resourceType: 'scenes',
            resourceName: existing.name,
            detail: `导入提示词补充场景子项：${variantName}`
          });
          return;
        }

        const variantName = String(entry?.variantLabel || entry?.assetProfile || '').trim() || `${existing.name}-导入子项`;
        const existingVariants = Array.isArray(existing?.meta?.propVariants) ? existing.meta.propVariants : [];
        if (existingVariants.some((variant) => String(variant?.name || '').trim().toLowerCase() === variantName.toLowerCase())) return;
        pendingLibraryUpserts.push({
          type: 'props',
          resource: {
            ...existing,
            meta: {
              ...(existing?.meta || {}),
              propVariants: [...existingVariants, {
                id: crypto.randomUUID(),
                name: variantName,
                imageRequirements: [String(entry?.prompt || '').trim() || variantName],
                images: [],
                updatedAt: Date.now()
              }]
            },
            updatedAt: Date.now()
          }
        });
        pendingOperationLogs.push({
          action: 'import_material_prompt_prop_variant',
          resourceType: 'props',
          resourceName: existing.name,
          detail: `导入提示词补充道具子项：${variantName}`
        });
      };

      const nextShots = shots.map((shot) => {
        const source = shotPromptMap.get(normalizeShotLookupKey(shot.id)) || shotPromptMap.get(normalizeShotLookupKey(shot.shotNumber));
        if (!source) return shot;
        const sourceResourcePrompts = Array.isArray(source.resourcePrompts) ? source.resourcePrompts : [];
        const groupedPromptMap = new Map();
        sourceResourcePrompts.forEach((entry) => {
          const type = normalizeResourceType(entry?.type || 'props');
          const resourceName = String(entry?.resourceName || entry?.name || '').trim();
          if (!resourceName) return;
          const key = `${type}::${resourceName.toLowerCase()}`;
          const list = groupedPromptMap.get(key) || [];
          list.push({
            ...entry,
            type,
            resourceName,
            variantLabel: String(entry?.variantLabel || entry?.assetProfile || '').trim()
          });
          groupedPromptMap.set(key, list);
        });

        const consumeMap = new Map();

        const nextResources = (shot.resources || []).map((resource) => {
          const key = `${normalizeResourceType(resource?.type || 'props')}::${String(resource?.name || '').trim().toLowerCase()}`;
          const candidates = groupedPromptMap.get(key) || [];
          if (candidates.length === 0) return resource;
          const consumedIndexes = consumeMap.get(key) || new Set();
          const resourceVariant = String(resource?.requirement?.variantLabel || resource?.subType || '').trim();
          let targetIndex = candidates.findIndex((entry, index) => !consumedIndexes.has(index) && resourceVariant && String(entry?.variantLabel || '').trim() === resourceVariant);
          if (targetIndex < 0) {
            targetIndex = candidates.findIndex((_, index) => !consumedIndexes.has(index));
          }
          if (targetIndex < 0) return resource;
          consumedIndexes.add(targetIndex);
          consumeMap.set(key, consumedIndexes);
          const matched = candidates[targetIndex];
          queueLibraryPatch(resource?.type, resource?.name, matched);
          return ensureResourceStructure({
            ...resource,
            prompt: matched.prompt || resource.prompt,
            anchorImageRef: matched.anchorImageRef || resource.anchorImageRef || '',
            subType: resource.type === 'characters' ? (matched.variantLabel || resource.subType || CHARACTER_DEFAULT_SUBTYPE) : resource.subType,
            requirement: {
              ...makeResourceRequirement(resource),
              ...(resource.requirement || {}),
              ...(matched || {}),
              variantLabel: matched.variantLabel || resource?.requirement?.variantLabel || resource?.subType || ''
            }
          });
        });

        return {
          ...shot,
          resources: nextResources,
          prompt: source.prompt || shot.prompt || '',
          videoPromptDraft: source.videoPromptDraft || shot.videoPromptDraft || ''
        };
      });

      const mergedUpserts = new Map();
      pendingLibraryUpserts.forEach((item) => {
        const id = String(item?.resource?.id || '');
        if (!id) return;
        const key = `${item.type}::${id}`;
        const previous = mergedUpserts.get(key);
        if (!previous) {
          mergedUpserts.set(key, item);
          return;
        }

        if (item.type === 'characters') {
          const prevRequirements = Array.isArray(previous.resource?.meta?.viewRequirements)
            ? previous.resource.meta.viewRequirements
            : [];
          const nextRequirements = Array.isArray(item.resource?.meta?.viewRequirements)
            ? item.resource.meta.viewRequirements
            : [];
          const mergedRequirements = Array.from(new Set([...prevRequirements, ...nextRequirements].filter(Boolean)));

          const prevForms = Array.isArray(previous.resource?.form) ? previous.resource.form : [];
          const nextForms = Array.isArray(item.resource?.form) ? item.resource.form : [];
          const mergedForm = {
            ...(prevForms[0] || {}),
            ...(nextForms[0] || {}),
            viewRequirements: Array.from(new Set([
              ...((prevForms[0]?.viewRequirements) || []),
              ...((nextForms[0]?.viewRequirements) || [])
            ].filter(Boolean))),
            viewAssets: Array.isArray(prevForms[0]?.viewAssets) ? prevForms[0].viewAssets : []
          };

          mergedUpserts.set(key, {
            ...item,
            resource: {
              ...previous.resource,
              ...item.resource,
              form: [mergedForm],
              meta: {
                ...(previous.resource?.meta || {}),
                ...(item.resource?.meta || {}),
                viewRequirements: mergedRequirements,
                viewAssets: Array.isArray(previous.resource?.meta?.viewAssets)
                  ? previous.resource.meta.viewAssets
                  : []
              }
            }
          });
          return;
        }

        if (item.type === 'scenes') {
          const prevVariants = Array.isArray(previous.resource?.meta?.sceneVariants) ? previous.resource.meta.sceneVariants : [];
          const nextVariants = Array.isArray(item.resource?.meta?.sceneVariants) ? item.resource.meta.sceneVariants : [];
          const variantMap = new Map();
          [...prevVariants, ...nextVariants].forEach((variant) => {
            const name = String(variant?.name || '').trim().toLowerCase();
            if (!name) return;
            variantMap.set(name, variant);
          });
          mergedUpserts.set(key, {
            ...item,
            resource: {
              ...previous.resource,
              ...item.resource,
              meta: {
                ...(previous.resource?.meta || {}),
                ...(item.resource?.meta || {}),
                sceneVariants: Array.from(variantMap.values())
              }
            }
          });
          return;
        }

        const prevVariants = Array.isArray(previous.resource?.meta?.propVariants) ? previous.resource.meta.propVariants : [];
        const nextVariants = Array.isArray(item.resource?.meta?.propVariants) ? item.resource.meta.propVariants : [];
        const variantMap = new Map();
        [...prevVariants, ...nextVariants].forEach((variant) => {
          const name = String(variant?.name || '').trim().toLowerCase();
          if (!name) return;
          variantMap.set(name, variant);
        });
        mergedUpserts.set(key, {
          ...item,
          resource: {
            ...previous.resource,
            ...item.resource,
            meta: {
              ...(previous.resource?.meta || {}),
              ...(item.resource?.meta || {}),
              propVariants: Array.from(variantMap.values())
            }
          }
        });
      });
      mergedUpserts.forEach((item) => {
        upsertResource(item.type, item.resource);
      });
      pendingOperationLogs.forEach((log) => appendResourceOperationLog(log));

      syncShotStatus(nextShots);
      updateChapterPatch((currentChapter) => ({
        editingWorkflow: {
          ...(currentChapter.editingWorkflow || {}),
          materialPromptImportedAt: Date.now(),
          promptStage: 'material_prompt',
          strictConvergeMode: false
        }
      }));
      pushToast('提示词导入成功。\n已覆盖镜头提示词，并按匹配资源自动补充资源库子项需求。', 'success');
    } catch (error) {
      pushToast(`提示词导入失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  const exportMaterialRequirement = () => {
    const sourceMeta = shots.map((shot) => ({
      shotId: shot.id,
      shotNumber: shot.shotNumber,
      prompt: shot.prompt || '',
      resourceText: normalizeMaterialContentEntries(shot.materialContent)
        .map((item) => `${getResourceTypeLabel(item.type)}:${item.name}`)
        .join('；'),
      resourcePrompts: (shot.resources || []).map((resource) => {
        const requirement = {
          ...makeResourceRequirement(resource),
          ...(resource.requirement || {})
        };
        const sceneVariantNames = (resource?.meta?.sceneVariants || []).map((variant) => variant?.name).filter(Boolean);
        const propVariantNames = (resource?.meta?.propVariants || []).map((variant) => variant?.name).filter(Boolean);
        return {
          ...requirement,
          assetProfile: resource.type === 'characters'
            ? CHARACTER_REQUIRED_VIEW_ANGLE
            : (sceneVariantNames[0] || propVariantNames[0] || resource.name || '')
        };
      }),
      videoPromptDraft: shot.videoPromptDraft || '',
      motionType: shot.motionType || 'static',
      videoNeeded: ['L3', 'L4'].includes(shot.level),
      videoSegments: Array.isArray(shot.videoSegments) ? shot.videoSegments : []
    }));
    const payload = {
      generatedAt: new Date().toISOString(),
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      requirements: sourceMeta
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-素材需求元信息.json`;
    link.click();
    URL.revokeObjectURL(url);

    const zip = new JSZip();
    zip.file('素材需求元信息.json', JSON.stringify(payload, null, 2));
    const references = (activeFrame?.resources || [])
      .filter((item) => item?.status === 'uploaded')
      .map((item) => `${getResourceTypeLabel(item.type)} / ${item.name} / ${item.localPath || item.fileName || '未记录路径'}`)
      .join('\n');
    zip.file('参考素材清单.txt', references || '暂无已上传参考素材');
    zip.generateAsync({ type: 'blob' }).then((zipBlob) => {
      const zipUrl = URL.createObjectURL(zipBlob);
      const zipLink = document.createElement('a');
      zipLink.href = zipUrl;
      zipLink.download = `${chapter.title}-图生图参考素材包.zip`;
      zipLink.click();
      URL.revokeObjectURL(zipUrl);
      setTempPackageHistory((prev) => [...prev, {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        name: `${chapter.title}-图生图参考素材包.zip`
      }]);
    });
    updateChapterPatch((currentChapter) => ({
      editingWorkflow: {
        ...(currentChapter.editingWorkflow || {}),
        promptStage: 'video_prompt'
      }
    }));
    pushToast('已导出素材需求元信息。', 'success');
  };

  const cleanTempReferencePackage = () => {
    previewUrlsRef.current.forEach((url) => safelyRevokePreview(url));
    previewUrlsRef.current.clear();
    setTempPackageHistory([]);
    setLastMaterialRequirementMeta([]);
    pushToast('已清理临时参考包记录与预览缓存。', 'success');
  };

  const applyShotTemplate = (template) => {
    if (!activeShot || !template) return;
    updateShot(activeShot.id, {
      level: template.level,
      shotType: template.shotType,
      cameraAngle: template.cameraAngle,
      sceneDescription: template.sceneDescription,
      visualContent: template.sceneDescription,
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
  const sceneLibraryOptions = uploadedResources.filter((item) => item.type === 'scenes');
  const materialContentDraft = JSON.stringify(Array.isArray(activeFrame?.materialContent) ? activeFrame.materialContent : [], null, 2);
  const needsImageUpload = activeShot && ['L1', 'L3'].includes(activeShot.level);
  const needsVideoUpload = activeShot && activeShot.level === 'L3';
  const resourceStoragePath = buildTargetPath('characters', 'default');
  const frameAssetStoragePath = buildTargetPath('shot-assets', activeShot?.level || 'L1');

  const handleResourceEntryClick = (resource) => {
    if (!resource) return;
    setActiveResourceId(resource.id);
  };

  const triggerReplaceUploadedResource = (resourceId) => {
    if (!resourceId) return;
    uploadedReplaceUploadRefs.current[resourceId]?.click();
  };

  const replaceUploadedResource = async (resourceId, file) => {
    if (!resourceId || !file) return;
    await uploadResourceFile(resourceId, file);
  };

  const activeShotResourceGroups = useMemo(() => {
    const source = Array.isArray(activeFrame?.resources) ? activeFrame.resources : [];
    return {
      characters: source.filter((item) => item.type === 'characters').slice(0, 5),
      scenes: source.filter((item) => item.type === 'scenes').slice(0, 1),
      props: source.filter((item) => item.type === 'props')
    };
  }, [activeFrame?.resources]);

  const selectedResource = useMemo(
    () => (activeFrame?.resources || []).find((item) => item.id === activeResourceId) || null,
    [activeFrame?.resources, activeResourceId]
  );

  const [leftPanelWidth, setLeftPanelWidth] = useState(20);
  const [rightPanelWidth, setRightPanelWidth] = useState(30);
  const [dragTarget, setDragTarget] = useState('');

  useEffect(() => {
    if (!dragTarget) return undefined;
    const handleMove = (event) => {
      const viewport = window.innerWidth;
      if (dragTarget === 'left') {
        const next = Math.min(Math.max(((event.clientX - 20) / viewport) * 100, 16), 30);
        setLeftPanelWidth(next);
      }
      if (dragTarget === 'right') {
        const next = Math.min(Math.max(((viewport - event.clientX - 20) / viewport) * 100, 24), 36);
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
      style={{ '--left-panel-width': `${leftPanelWidth}%`, '--right-panel-width': `${rightPanelWidth}%` }}
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
                </div>
              </div>
              {!shotValidationById[activeShot.id]?.isValid && (
                <div className="muted" style={{ color: '#F5222D' }}>
                  缺失项：{(shotValidationById[activeShot.id]?.missingLabels || []).join('、')}
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
                    镜头运动
                    <input
                      value={activeFrame.shotMotion || ''}
                      onChange={(event) => updateActiveFrame({ shotMotion: event.target.value })}
                      placeholder="例如：固定 / 横拉 / 跟拍"
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
                    所属场景
                    <input
                      value={activeFrame.sceneBelong || ''}
                      onChange={(event) => updateActiveFrame({ sceneBelong: event.target.value })}
                      placeholder="例如：试剑台"
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
                    场景描述（必填）
                    <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                      <button type="button" className={sceneInputMode === 'manual' ? 'tab active' : 'tab'} onClick={() => setSceneInputMode('manual')}>手动填写</button>
                      <button type="button" className={sceneInputMode === 'library' ? 'tab active' : 'tab'} onClick={() => setSceneInputMode('library')}>从资源库选择</button>
                    </div>
                    {sceneInputMode === 'manual' ? (
                      <textarea
                        className="large-input compact-input"
                        value={activeFrame.sceneDescription || ''}
                        placeholder="例如：空白背景 / 无场景 / Q版渐变背景"
                        onChange={(event) => updateActiveFrame({ sceneDescription: event.target.value })}
                      />
                    ) : (
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          const selected = sceneLibraryOptions.find((item) => item.id === event.target.value);
                          if (selected) {
                            updateActiveFrame({ sceneDescription: selected.prompt || selected.name || '' });
                          }
                        }}
                      >
                        <option value="">请选择场景资源（将自动填充场景描述）</option>
                        {sceneLibraryOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.name || '未命名场景资源'}</option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label className="span-2">
                    画面内容
                    <textarea
                      className="large-input compact-input"
                      value={activeFrame.visualContent || ''}
                      onChange={(event) => updateActiveFrame({ visualContent: event.target.value })}
                      placeholder="分镜核心画面描述"
                    />
                  </label>
                  <label className="span-2">
                    素材内容（JSON 数组）
                    <textarea
                      key={`${activeShot?.id || 'none'}-${activeFrameId}-material-content`}
                      className="large-input compact-input"
                      defaultValue={materialContentDraft}
                      onBlur={(event) => {
                        const raw = event.target.value;
                        try {
                          const parsed = raw.trim() ? JSON.parse(raw) : [];
                          if (!Array.isArray(parsed)) throw new Error('素材内容必须是数组');
                          updateActiveFrame({ materialContent: parsed });
                        } catch (error) {
                          pushToast('素材内容需为 JSON 数组，示例：[{"type":"character","name":"苏婉"}]', 'warning');
                        }
                      }}
                    />
                  </label>
                  <label className="span-2">
                    音效 / 台词 / 旁白
                    <textarea
                      className="large-input compact-input"
                      value={activeFrame.soundEffect || ''}
                      onChange={(event) => updateActiveFrame({ soundEffect: event.target.value })}
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
              className={`button-stage ${canGenerateMaterialPrompt ? 'ready' : 'disabled'}`}
              onClick={generateMaterialPrompt}
              disabled={!canGenerateMaterialPrompt}
              title={canGenerateMaterialPrompt ? '为当前章节生成素材提示词' : '请先补齐所有资源'}
            >
              生成素材提示词
            </button>
            <button
              type="button"
              className={`button-stage ${canImportPrompt ? 'ready' : 'disabled'}`}
              onClick={() => promptUploadRef.current?.click()}
              disabled={!canImportPrompt}
              title={canImportPrompt ? '导入提示词 JSON' : '请先完成生成素材提示词'}
            >
              导入提示词
            </button>
            <input
              ref={promptUploadRef}
              type="file"
              accept="application/json,text/plain"
              style={{ display: 'none' }}
              onChange={(event) => importMaterialPrompt(event.target.files?.[0])}
            />
            <button
              type="button"
              className={`button-stage ${canGenerateVideoPrompt ? 'ready' : 'disabled'}`}
              onClick={exportMaterialRequirement}
              disabled={!canGenerateVideoPrompt}
              title={canGenerateVideoPrompt ? '导出视频提示词与素材元信息' : '请先导入提示词'}
            >
              生成视频提示词
            </button>
          </div>
        </div>

        <div className="storyboard-main-scroll">
          <div className="section-header">
            <h3>核心镜头脉络</h3>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="danger" onClick={deleteAllShots}>一键清空镜头</button>
              <label className="row" style={{ gap: 6 }}>
                时间轴缩放
                <input type="range" min="0.8" max="1.2" step="0.1" value={timelineZoom} onChange={(event) => setTimelineZoom(Number(event.target.value))} />
                <span>{timelineZoom.toFixed(1)}x</span>
              </label>
              <button type="button" onClick={addOutline}>新增场景</button>
              <button type="button" className="tab" onClick={selectAllShots}>全选镜头</button>
              <button type="button" className="tab" onClick={invertSelectedShots}>反选镜头</button>
              <button type="button" className="tab" onClick={clearSelectedShots}>清空勾选</button>
              <span className="status-chip">已勾选 {selectedShotIds.length} 条</span>
              <button type="button" className="danger" onClick={batchDeleteSelectedShots}>批量删除</button>
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
                      <div
                        key={shot.id}
                        className={`shot-stage-list-item ${activeShotId === shot.id ? 'active' : ''} ${highlightIncompleteShotId === shot.id ? 'highlight-danger' : ''} ${!validation.isValid ? 'highlight-danger' : ''}`}
                        draggable
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
                          setActiveResourceId('');
                        }}
                      >
                        <div className="shot-stage-list-head">
                          <label className="row" style={{ gap: 8 }} onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedShotIds.includes(shot.id)}
                              onChange={() => toggleShotSelection(shot.id)}
                            />
                            <strong>#{shot.shotNumber}</strong>
                          </label>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="status-chip">{shot.level}</span>
                            <span className={`status-pill ${shot.completed ? 'green' : 'orange'}`}>{shot.completed ? '已完成' : '缺失'}</span>
                            <button
                              type="button"
                              className="tab"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteShot(shot.id);
                              }}
                            >删除</button>
                          </div>
                        </div>
                        <div className="storage-path-hint">{shot.synopsis || shot.title || '未命名镜头'}</div>
                        <div className="storage-path-hint">{shot.shotType || '景别待填'} · 时长 {shot.shotDuration || shot.shotTime || '-'} · {shot.shotMotion || '固定'} · {shot.cameraAngle || '平视'} · {shot.sceneBelong || '未关联场景'}</div>
                        <div className="shot-stage-inline-groups">
                          {['characters', 'scenes', 'props'].map((type) => {
                            const groups = getShotResourceGroups(shot);
                            const items = groups[type].slice(0, type === 'props' ? 4 : 2);
                            return (
                              <div key={type} className="shot-stage-inline-group">
                                <span>{getResourceTypeLabel(type)}</span>
                                <div className="shot-stage-inline-track">
                                  {items.map((resource) => (
                                    <div key={resource.id} className="shot-stage-inline-chip">
                                      <img src={resource.preview || getPlaceholderByType(resource.type)} alt={resource.name || 'resource'} />
                                      <em>{resource.name || '未命名'}</em>
                                    </div>
                                  ))}
                                  {items.length === 0 && <em className="muted">暂无</em>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
        <div className="storyboard-side-header compact-header">
          <h3>资源面板</h3>
          <button type="button" className="button-secondary" onClick={addResource}>创建资源需求</button>
          <label className="file-button compact">
            批量素材回传
            <input
              ref={batchUploadRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.mp4,.mov"
              onChange={(event) => uploadResourceFileBatch(event.target.files)}
            />
          </label>
        </div>

        {!activeFrame && <div className="empty">请选择镜头后编辑资源。</div>}

        {activeFrame && (
          <div className="storyboard-side-scroll">
            {workflowStage === 'material_prompt' && (
            <div className="resource-square-section">
              <div className="resource-square-section-title">图像提示词任务（缺失资源）</div>
              <div className="prompt-task-list">
                {missingResources.map((resource) => (
                  <div key={resource.id} className={`prompt-task-card ${activeResourceId === resource.id ? 'active' : ''}`}>
                    <div className="prompt-task-anchor">
                      <img
                        src={resource.preview || getPlaceholderByType(resource.type)}
                        alt={resource.name || 'anchor'}
                        onClick={() => handleResourceEntryClick(resource)}
                      />
                    </div>
                    <div className="prompt-task-body">
                      <strong>{resource.name || '未命名资源'}</strong>
                      <span className="muted">{getResourceTypeLabel(resource.type)} · 缺失</span>
                      <textarea
                        value={resource.prompt || resource.requirement?.prompt || ''}
                        onChange={(event) => updateResource(resource.id, { prompt: event.target.value })}
                        placeholder="输入该资源的图生图提示词"
                      />
                      <div className="row" style={{ gap: 8 }}>
                        <button type="button" onClick={() => downloadResourcePromptTask(resource)}>下载任务包</button>
                        <button type="button" className="button-secondary" onClick={() => triggerResourceTaskUpload(resource.id)}>上传生成图</button>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp"
                          style={{ display: 'none' }}
                          ref={(el) => { resourceTaskUploadRefs.current[resource.id] = el; }}
                          onChange={(event) => uploadGeneratedResourceImage(resource.id, event.target.files?.[0])}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {missingResources.length === 0 && <div className="empty">无缺失资源。</div>}
              </div>
            </div>
            )}

            {workflowStage === 'video_prompt' && (
            <div className="resource-square-section">
              <div className="resource-square-section-title">视频提示词任务</div>
              <div className="prompt-task-card">
                <div className="prompt-task-anchor-group">
                  {(uploadedResources || []).filter((item) => item.preview).slice(0, 6).map((resource) => (
                    <img key={resource.id} src={resource.preview} alt={resource.name || 'anchor'} title={resource.name || ''} />
                  ))}
                  {(uploadedResources || []).filter((item) => item.preview).length === 0 && <div className="muted">暂无可用锚定图，请先上传上方图像任务结果。</div>}
                </div>
                <div className="prompt-task-body">
                  <textarea
                    value={activeFrame.videoPromptDraft || ''}
                    onChange={(event) => updateActiveFrame({ videoPromptDraft: event.target.value })}
                    placeholder="输入视频生成提示词"
                  />
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" onClick={downloadVideoPromptTask}>下载视频任务包</button>
                    <button type="button" className="button-secondary" onClick={() => videoTaskUploadRef.current?.click()}>上传生成视频</button>
                    <input
                      ref={videoTaskUploadRef}
                      type="file"
                      accept=".mp4,.mov"
                      style={{ display: 'none' }}
                      onChange={(event) => uploadFrameAsset('videoAsset', event.target.files?.[0])}
                    />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="resource-square-section">
              <div className="resource-square-section-title">已上传资源</div>
              <div className="resource-square-grid">
                {uploadedResources.map((resource) => (
                  <div
                    key={resource.id}
                    className={`resource-square-card uploaded ${activeResourceId === resource.id ? 'active' : ''}`}
                    onClick={() => handleResourceEntryClick(resource)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => event.key === 'Enter' && handleResourceEntryClick(resource)}
                  >
                    <img src={resource.preview || getPlaceholderByType(resource.type)} alt={resource.name || 'resource'} />
                    <strong>{resource.name || '未命名资源'}</strong>
                    <span>{getResourceTypeLabel(resource.type)} · 已上传</span>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        triggerReplaceUploadedResource(resource.id);
                      }}
                    >
                      替换
                    </button>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.mp4,.mov"
                      style={{ display: 'none' }}
                      ref={(el) => { uploadedReplaceUploadRefs.current[resource.id] = el; }}
                      onChange={(event) => replaceUploadedResource(resource.id, event.target.files?.[0])}
                    />
                  </div>
                ))}
                {uploadedResources.length === 0 && <div className="empty">暂无已上传资源。</div>}
              </div>
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
