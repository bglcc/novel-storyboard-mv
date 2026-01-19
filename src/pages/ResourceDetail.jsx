import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';
import '../styles/resource-enhancements.css';

const typeLabels = {
  characters: '角色',
  expressions: '表情',
  scenes: '场景',
  props: '道具',
  animations: '动画',
  music: '背景音乐',
  voiceovers: '角色配音'
};

const expressionTabs = [
  { key: 'base', label: '基础信息' },
  { key: 'assets', label: '参考图 & 素材' },
  { key: 'transfer', label: '导出/导入' }
];

const scopeOptions = [
  { value: 'chibi', label: 'Q版' },
  { value: 'normal', label: '普通比例' },
  { value: 'universal', label: '通用' }
];

const riskOptions = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' }
];

const strategyOptions = [
  { value: 'direct_generate', label: '直接生图' },
  { value: 'img2img_character', label: '图生图' },
  { value: 'hybrid', label: '混合' }
];

const ResourceDetail = () => {
  const { type, resourceId } = useParams();
  const navigate = useNavigate();
  const { data, updateResourceImages, upsertResource, upsertRule } = useData();
  const resourceList = data.resources[type] || [];
  const resource = useMemo(
    () => resourceList.find((r) => r.id === resourceId),
    [resourceList, resourceId]
  );
  const [name, setName] = useState(resource?.name || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState((resource?.tags || []).join(', '));
  const [meta, setMeta] = useState(resource?.meta || {});
  const [historyQuery, setHistoryQuery] = useState('');
  const [aliases, setAliases] = useState((resource?.aliases || []).join(', '));
  const [priorityPin, setPriorityPin] = useState(Boolean(resource?.priorityPin));
  const [forms, setForms] = useState(resource?.form || []);
  const [actions, setActions] = useState(resource?.action || []);
  const [assets, setAssets] = useState(resource?.assets || []);
  const [newFormName, setNewFormName] = useState('');
  const [newActionName, setNewActionName] = useState('');
  const [newSceneElement, setNewSceneElement] = useState('');
  const [expressionTab, setExpressionTab] = useState('base');
  const [expressionRuleText, setExpressionRuleText] = useState('');
  const [characterTab, setCharacterTab] = useState('base');
  const [activeFormName, setActiveFormName] = useState('');
  const [editingSection, setEditingSection] = useState('');
  const [draftReferences, setDraftReferences] = useState([]);
  const [focusedRelation, setFocusedRelation] = useState(null);
  const [sceneTab, setSceneTab] = useState('structure');
  const [sceneEditingSection, setSceneEditingSection] = useState('');
  const [sceneDraft, setSceneDraft] = useState({});
  const [transferQuery, setTransferQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  useEffect(() => {
    if (resource) {
      setName(resource.name || '');
      setDescription(resource.description || '');
      setTags((resource.tags || []).join(', '));
      setMeta(resource.meta || {});
      setAliases((resource.aliases || []).join(', '));
      setPriorityPin(Boolean(resource.priorityPin));
      setForms(resource.form || []);
      setActions(resource.action || []);
      setAssets(resource.assets || []);
      setDraftTitle(resource.name || '');
      if (type === 'expressions') {
        const rules = (resource.meta?.expressionRules || []).slice().sort((a, b) => (b.version || 0) - (a.version || 0));
        const ruleTextValue = resource.meta?.expressionRuleText || rules[0]?.promptTemplate || '';
        setExpressionRuleText(ruleTextValue);
        setExpressionTab('base');
      }
      if (type === 'characters') {
        const nextFormName = resource.form?.[0]?.name || '默认形态';
        setActiveFormName(nextFormName);
      }
    }
  }, [resourceId, resource, type]);

  useEffect(() => {
    if (type !== 'characters') return;
    const existing = (data.rules || []).some((rule) => rule.tool === '角色资源');
    if (existing) return;
    upsertRule({
      tool: '角色资源',
      description: '角色资源库与分镜头 AI / 图片回传交互规则说明。',
      parameters: {
        storyboardRules: {
          overview: '分镜头 AI 负责回传角色基础信息、形态信息、关系网等结构化内容。',
          baseInfo: {
            name: 'string，角色名称。',
            tags: 'string[]，角色标签数组。',
            background: 'string，角色背景描述，默认映射为基础信息展示内容。',
            priorityPin: 'boolean，是否置顶角色。',
            personalitySetting: 'string，性格设定（心理特征、动机、恐惧点等）。',
            growthTrajectory: 'string，成长轨迹描述（变化与转折点）。'
          },
          formInfo: {
            formName: 'string，形态名称；当需要新增形态时需提供。',
            persona: 'string，角色人设内容。',
            appearance: 'string，外貌描写内容，用于导出提示词。'
          },
          references: {
            referenceCharacterId: 'string，参考角色 ID。',
            referenceFormName: 'string，参考角色形态名称。',
            target: 'string，参考目标特征（如发型/服饰）。',
            weight: 'number，权重 0-100。'
          },
          relationshipGraph: {
            nodes: 'array，其他角色节点（id/name）。',
            relations:
              'array，中心角色与目标角色关系。字段示例：source/target/relation/emotions/currentEmotion/cause/consequence。'
          },
          characterGrowthHistory: {
            entries: 'array，角色成长史节点（chapter/change/description）。'
          }
        },
        imageRules: {
          overview: '图片由分镜头 AI 生成后回传，需标注视角或特征名称。',
          viewRequirements: 'string[]，视角需求列表（如正面、侧面、背面、45°等）。',
          viewAsset: {
            viewAngle: 'string，视角名称，需与 viewRequirements 对应。',
            fileName: 'string，建议命名：角色名-形态名-视角名-序号.ext。',
            storage: '本地部署使用 base64/Blob 存储在浏览器数据中，不支持直接写入本地路径。'
          }
        }
      }
    });
  }, [data.rules, type, upsertRule]);

  useEffect(() => {
    if (type !== 'scenes') return;
    const existing = (data.rules || []).some((rule) => rule.tool === '场景资源');
    if (existing) return;
    upsertRule({
      tool: '场景资源',
      description: '场景资源库与分镜头 AI 的交互规则说明。',
      parameters: {
        storyboardRules: {
          overview: '分镜头 AI 负责回传场景结构、描述与图片需求。',
          sceneLayout: {
            elements: [
              {
                type: 'character|prop|background',
                name: '元素名称',
                x: '0~1 场景坐标',
                y: '0~1 场景坐标',
                direction: '0~360，仅角色需要'
              }
            ]
          },
          sceneDescription: 'string，场景整体描述。',
          sceneElementDetails: [
            {
              element: '元素名称',
              detail: '补充描写'
            }
          ],
          sceneVariants: [
            {
              name: '可选，场景版本名称',
              season: '季节',
              weather: '天气',
              time: '时间',
              imageRequirements: ['全景图-1', '全景图-2'],
              images: [{ label: '全景图-1', src: 'base64' }]
            }
          ]
        },
        imageRules: {
          overview: '图片由分镜头 AI 回传创建需求卡片，再人工或自动上传。',
          fileName: '建议命名：场景名-季节-时间-序号.ext（可在需求内说明）'
        },
        questions: [
          '是否需要将同类型场景（例如小炒店）归为同一标签以便参考？',
          '是否需要额外提供局部图或关键元素图的需求？'
        ]
      }
    });
  }, [data.rules, type, upsertRule]);

  useEffect(() => {
    if (type !== 'expressions') return;
    const existing = (data.rules || []).some((rule) => rule.tool === '表情资源');
    if (existing) return;
    upsertRule({
      tool: '表情资源',
      description: '表情资源库（颜艺）与分镜头 AI 的交互规则说明。',
      parameters: {
        storyboardRules: {
          overview: '分镜头 AI 负责回传表情基础信息、规则说明与生图包需求。',
          baseInfo: {
            name: 'string，表情名称。',
            tags: 'string[]，表情标签数组。',
            emotionType: 'string，情绪类型。',
            emotionValue: 'string，情绪强度。',
            background: 'string，匹配场景背景。'
          },
          ruleText: 'string，自然语言规则说明。',
          transferRequests: [
            {
              id: 'string，需求卡片 ID。',
              name: 'string，需求名称。',
              character: 'string，角色称。',
              cover: 'string，可选，封面图 base64。'
            }
          ]
        },
        imageRules: {
          overview: '上传主参考图作为表情视觉锚点。',
          mainReference: '上传主参考图，建议命名：表情名-主参考.ext。'
        }
      }
    });
  }, [data.rules, type, upsertRule]);

  if (!data.resources[type]) return <div className="card">资源类型不存在</div>;
  if (!resource) return <div className="card">资源不存在</div>;

  const normalizeTags = () =>
    tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const normalizeAliases = () =>
    aliases
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const getCharacterStatus = () => {
    if (!assets.length) return '待完成';
    if (!forms.length || !actions.length) return '部分完成';
    return '已完成';
  };

  const createAssetId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const addAssets = async (files, role, ownerName) => {
    const uploadedAt = new Date().toISOString();
    const nextVersion =
      Math.max(
        0,
        ...assets
          .filter((asset) => asset.role === role && asset.ownerName === ownerName)
          .map((asset) => asset.version || 0)
      ) + 1;
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ src: e.target.result, name: file.name });
          reader.readAsDataURL(file);
        })
    );
    const results = await Promise.all(readers);
    const nextAssets = results.map((result) => ({
      id: createAssetId(),
      role,
      ownerName,
      version: nextVersion,
      uploadedAt,
      fileName: result.name,
      src: result.src
    }));
    setAssets((prev) => [...prev, ...nextAssets]);
    return nextAssets;
  };

  const handleFormUpload = (formName) => async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const nextAssets = await addAssets(files, 'form', formName);
    setForms((prev) =>
      prev.map((form) =>
        form.name === formName
          ? {
              ...form,
              assets: [...(form.assets || []), ...nextAssets.map((asset) => asset.id)],
              updatedAt: Date.now()
            }
          : form
      )
    );
  };

  const handleActionUpload = (actionName) => async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const nextAssets = await addAssets(files, 'action', actionName);
    setActions((prev) =>
      prev.map((action) =>
        action.name === actionName
          ? {
              ...action,
              assets: [...(action.assets || []), ...nextAssets.map((asset) => asset.id)],
              updatedAt: Date.now()
            }
          : action
      )
    );
  };

  const handleDeleteAsset = (assetId) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
    setForms((prev) =>
      prev.map((form) => ({
        ...form,
        assets: (form.assets || []).filter((id) => id != assetId)
      }))
    );
    setActions((prev) =>
      prev.map((action) => ({
        ...action,
        assets: (action.assets || []).filter((id) => id != assetId)
      }))
    );
  };

  const handleSingleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        })
    );
    const images = await Promise.all(readers);
    const merged = [...(resource.images || []), ...images];
    updateResourceImages(type, resourceId, merged);
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const images = [];
      const entries = Object.values(zip.files).filter(
        (f) => !f.dir && /\.(png|jpg|jpeg|webp)$/i.test(f.name)
      );
      for (const entry of entries) {
        const blob = await entry.async('base64');
        images.push(`data:image/${entry.name.split('.').pop()};base64,${blob}`);
      }
      const merged = [...(resource.images || []), ...images];
      updateResourceImages(type, resourceId, merged);
    } catch (e) {
      alert('解压失败，请检 zip 文件');
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestEntry = Object.values(zip.files).find((f) => /character\.json$/i.test(f.name));
      if (!manifestEntry) {
        alert('未找到角色资源档案文件');
        return;
      }
      const manifest = JSON.parse(await manifestEntry.async('string'));
      const importedAssets = [];
      for (const asset of manifest.assets || []) {
        if (!asset.file) continue;
        const assetFile = zip.file(asset.file);
        if (!assetFile) continue;
        const base64 = await assetFile.async('base64');
        const extension = asset.file.split('.').pop();
        importedAssets.push({
          ...asset,
          src: `data:image/${extension};base64,${base64}`
        });
      }
      const loadViewAssets = async (viewAssets) => {
        const results = [];
        for (const asset of viewAssets || []) {
          if (!asset.file) {
            results.push({ ...asset });
            continue;
          }
          const assetFile = zip.file(asset.file);
          if (!assetFile) continue;
          const base64 = await assetFile.async('base64');
          const extension = asset.file.split('.').pop();
          results.push({
            ...asset,
            src: `data:image/${extension};base64,${base64}`
          });
        }
        return results;
      };
      const importedMetaViews = await loadViewAssets(manifest.meta?.viewAssets || []);
      const importedForms = await Promise.all(
        (manifest.form || []).map(async (form) => ({
          ...form,
          viewAssets: await loadViewAssets(form.viewAssets || [])
        }))
      );
      setName(manifest.name || '');
      setDescription(manifest.description || '');
      setTags((manifest.tags || []).join(', '));
      setAliases((manifest.aliases || []).join(', '));
      setPriorityPin(Boolean(manifest.priorityPin));
      setMeta({ ...(manifest.meta || {}), viewAssets: importedMetaViews });
      setAssets(importedAssets);
      setForms(importedForms);
      setActions((manifest.action || []).map((action) => ({ ...action })));
    } catch (e) {
      alert('导入失败，请检查资源包');
    } finally {
      setLoading(false);
    }
  };

  const handleCharacterExport = async () => {
    const zip = new JSZip();
    const assetsFolder = zip.folder('assets');
    const viewsFolder = zip.folder('views');
    const manifestAssets = [];
    for (const asset of assets) {
      if (!asset.src) continue;
      const match = asset.src.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) continue;
      const ext = match[1].split('/')[1];
      const filename = `assets/${asset.id}-v${asset.version}.${ext}`;
      assetsFolder.file(`${asset.id}-v${asset.version}.${ext}`, match[2], { base64: true });
      manifestAssets.push({ ...asset, src: undefined, file: filename });
    }

    const mapViewAssets = (viewAssets, prefix) =>
      (viewAssets || []).map((asset) => {
        if (!asset.src) return asset;
        const match = asset.src.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) return asset;
        const ext = match[1].split('/')[1];
        const safeAngle = (asset.viewAngle || 'view').replace(/\s+/g, '-');
        const filename = `views/${prefix}-${safeAngle}-${asset.id}.${ext}`;
        viewsFolder.file(`${prefix}-${safeAngle}-${asset.id}.${ext}`, match[2], { base64: true });
        return { ...asset, src: undefined, file: filename };
      });

    const exportForms = forms.map((form) => ({
      ...form,
      viewAssets: mapViewAssets(form.viewAssets, `${form.name}`)
    }));

    const manifest = {
      id: resource.id,
      type: 'characters',
      name,
      aliases: normalizeAliases(),
      status: getCharacterStatus(),
      priorityPin,
      description,
      tags: normalizeTags(),
      createdAt: resource.createdAt || Date.now(),
      updatedAt: Date.now(),
      meta: {
        ...meta,
        viewAssets: mapViewAssets(meta.viewAssets, `${resource.id}-default`)
      },
      assets: manifestAssets,
      form: exportForms,
      action: actions
    };
    zip.file('character.json', JSON.stringify(manifest, null, 2));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'character'}-assets.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSceneImageUpload = (key, index = null) => async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeta((prev) => {
        const sceneImages = { ...(prev.sceneImages || {}) };
        if (key === 'partials') {
          const nextPartials = [...(sceneImages.partials || [])];
          if (index === null) {
            nextPartials.push(reader.result);
          } else {
            nextPartials[index] = reader.result;
          }
          sceneImages.partials = nextPartials;
        } else if (key === 'storyboardShots') {
          const nextShots = [...(sceneImages.storyboardShots || [])];
          if (index === null) {
            nextShots.push(reader.result);
          } else {
            nextShots[index] = reader.result;
          }
          sceneImages.storyboardShots = nextShots;
        } else {
          sceneImages[key] = reader.result;
        }
        return { ...prev, sceneImages };
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSceneResourceUpload = (category) => async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeta((prev) => {
        const sceneResources = { ...(prev.sceneResources || {}) };
        const nextItems = [
          ...(sceneResources[category] || []),
          {
            id: createAssetId(),
            name: file.name,
            src: reader.result,
            uploadedAt: new Date().toISOString()
          }
        ];
        return {
          ...prev,
          sceneResources: { ...sceneResources, [category]: nextItems }
        };
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddSceneElement = (toolKey) => {
    if (!newSceneElement.trim()) return;
    setMeta((prev) => ({
      ...prev,
      sceneLayout: {
        ...(prev.sceneLayout || {}),
        elements: [
          ...((prev.sceneLayout || {}).elements || []),
          {
            id: createAssetId(),
            type: toolKey,
            name: newSceneElement.trim(),
            x: 0,
            y: 0,
            scale: 1
          }
        ]
      }
    }));
    setNewSceneElement('');
  };

  const handleSceneGenerate = (key) => {
    setMeta((prev) => ({
      ...prev,
      sceneGeneration: {
        ...(prev.sceneGeneration || {}),
        [key]: new Date().toISOString()
      }
    }));
  };

  const createExpressionAssetId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const getExpressionAssets = () => meta.expressionAssets || [];

  const getExpressionRules = () =>
    (meta.expressionRules || []).slice().sort((a, b) => (b.version || 0) - (a.version || 0));

  const getExpressionStatus = () => {
    const assetsList = getExpressionAssets();
    const mainAsset = assetsList.find((asset) => asset.type === 'main');
    const rules = getExpressionRules();
    const hasRule = Boolean(
      (expressionRuleText || '').trim() ||
      (rules.length > 0 && (rules[0].promptTemplate || '').trim())
    );
    if (!mainAsset || !meta.strategy || !hasRule) return '待补齐';
    return '已完成';
  };

  const syncExpressionImages = (assetsList) => {
    const mainAsset = assetsList.find((asset) => asset.type === 'main');
    const auxAssets = assetsList.filter((asset) => asset.type === 'aux');
    const images = [
      ...(mainAsset?.src ? [mainAsset.src] : []),
      ...auxAssets.map((asset) => asset.src).filter(Boolean)
    ];
    return images;
  };

  const handleExpressionAssetUpload = (type) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const assetsList = getExpressionAssets();
      const nextAsset = {
        id: createExpressionAssetId(),
        type,
        usage: 'source_frame',
        note: '',
        order: type === 'main' ? 0 : assetsList.filter((asset) => asset.type === 'aux').length + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fileName: file.name,
        src: reader.result
      };
      const nextAssets =
        type === 'main'
          ? [nextAsset, ...assetsList.filter((asset) => asset.type !== 'main')]
          : [...assetsList, nextAsset];
      setMeta((prev) => ({
        ...prev,
        expressionAssets: nextAssets
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleExpressionAssetUpdate = (assetId, updates) => {
    const assetsList = getExpressionAssets();
    setMeta((prev) => ({
      ...prev,
      expressionAssets: assetsList.map((asset) =>
        asset.id === assetId ? { ...asset, ...updates, updatedAt: Date.now() } : asset
      )
    }));
  };

  const handleExpressionAssetDelete = (assetId) => {
    const assetsList = getExpressionAssets();
    setMeta((prev) => ({
      ...prev,
      expressionAssets: assetsList.filter((asset) => asset.id !== assetId)
    }));
  };

  const handleExpressionAssetMove = (assetId, direction) => {
    const assetsList = getExpressionAssets();
    const auxAssets = assetsList.filter((asset) => asset.type === 'aux');
    const index = auxAssets.findIndex((asset) => asset.id === assetId);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= auxAssets.length) return;
    const nextAux = [...auxAssets];
    [nextAux[index], nextAux[swapIndex]] = [nextAux[swapIndex], nextAux[index]];
    const reordered = [
      ...assetsList.filter((asset) => asset.type === 'main'),
      ...nextAux.map((asset, idx) => ({ ...asset, order: idx + 1 }))
    ];
    setMeta((prev) => ({ ...prev, expressionAssets: reordered }));
  };

  const handleExpressionRuleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setExpressionRuleText(text);
  };

  const handleExpressionRuleSave = () => {
    setMeta((prev) => ({
      ...prev,
      expressionRuleText
    }));
  };

  const handleExpressionExportZip = async () => {
    setLoading(true);
    const assetsList = getExpressionAssets();
    const rules = getExpressionRules();
    const ruleTextValue = expressionRuleText || rules[0]?.promptTemplate || '';
    const zip = new JSZip();
    const folder = zip.folder(`ExpressionForms/${resource.id}`);
    const refsFolder = folder.folder('refs');
    const rulesFolder = folder.folder('rules');
    const metaAssets = [];
    for (const asset of assetsList) {
      if (!asset.src) continue;
      const match = asset.src.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) continue;
      const ext = match[1].split('/')[1] || 'png';
      const fileName = asset.type === 'main' ? 'main' : `aux_${asset.order || 1}`;
      const fullName = `${fileName}.${ext}`;
      refsFolder.file(fullName, match[2], { base64: true });
      metaAssets.push({
        file: fullName,
        type: asset.type,
        usage: asset.usage,
        note: asset.note,
        order: asset.order
      });
    }
    const metaPayload = {
      id: resource.id,
      name,
      category: meta.category,
      tags: normalizeTags(),
      scope: meta.scope,
      riskLevel: meta.riskLevel,
      templateAnime: meta.templateAnime,
      templateCharacter: meta.templateCharacter,
      templateExpression: meta.templateExpression,
      status: getExpressionStatus() === '已完成' ? 'ready' : 'todo',
      description,
      shotRecommendation: meta.shotRecommendation || [],
      prohibitions: meta.prohibitions || '',
      ruleText: ruleTextValue,
      assets: metaAssets,
      rules: rules.length
        ? rules.map((rule) => ({
            version: rule.version,
            strategy: rule.strategy,
            files: [`rule_v${rule.version}.json`, `rule_v${rule.version}.txt`]
          }))
        : ruleTextValue
          ? [{ version: 1, strategy: meta.strategy || '', files: ['rule_v1.json', 'rule_v1.txt'] }]
          : []
    };
    folder.file('meta.json', JSON.stringify(metaPayload, null, 2));
    if (rules.length) {
      rules.forEach((rule) => {
        rulesFolder.file(`rule_v${rule.version}.json`, JSON.stringify(rule.ruleJson || {}, null, 2));
        rulesFolder.file(
          `rule_v${rule.version}.txt`,
          [rule.promptTemplate || '', '\n\n', rule.negativePrompt || '', '\n\n', rule.constraints || ''].join('')
        );
      });
    } else if (ruleTextValue) {
      rulesFolder.file('rule_v1.json', JSON.stringify({}, null, 2));
      rulesFolder.file('rule_v1.txt', ruleTextValue);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name || resource.id}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  const handleExpressionImportZip = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const metaFile = zip.file(`ExpressionForms/${resource.id}/meta.json`);
      if (!metaFile) {
        alert('未找到 meta.json');
        setLoading(false);
        return;
      }
      const metaPayload = JSON.parse(await metaFile.async('string'));
      const nextAssets = [];
      for (const asset of metaPayload.assets || []) {
        const refFile = zip.file(`ExpressionForms/${resource.id}/refs/${asset.file}`);
        if (!refFile) continue;
        const base64 = await refFile.async('base64');
        const extension = asset.file.split('.').pop();
        nextAssets.push({
          id: createExpressionAssetId(),
          type: asset.type,
          usage: asset.usage,
          note: asset.note,
          order: asset.order,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          fileName: asset.file,
          src: `data:image/${extension};base64,${base64}`
        });
      }
      const nextRules = [];
      for (const ruleMeta of metaPayload.rules || []) {
        const jsonFile = zip.file(`ExpressionForms/${resource.id}/rules/${ruleMeta.files[0]}`);
        const txtFile = zip.file(`ExpressionForms/${resource.id}/rules/${ruleMeta.files[1]}`);
        const ruleJson = jsonFile ? JSON.parse(await jsonFile.async('string')) : {};
        const text = txtFile ? await txtFile.async('string') : '';
        nextRules.push({
          id: createExpressionAssetId(),
          strategy: ruleMeta.strategy,
          promptTemplate: text.split('\n\n')[0] || '',
          negativePrompt: text.split('\n\n')[1] || '',
          constraints: text.split('\n\n')[2] || '',
          recommendedParamsText: '',
          ruleJson,
          version: ruleMeta.version,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      const importedRuleText = metaPayload.ruleText || nextRules[0]?.promptTemplate || '';
      setName(metaPayload.name || name);
      setDescription(metaPayload.description || description);
      setTags((metaPayload.tags || []).join(', '));
      setMeta((prev) => ({
        ...prev,
        category: metaPayload.category || prev.category,
        scope: metaPayload.scope || prev.scope,
        riskLevel: metaPayload.riskLevel || prev.riskLevel,
        templateAnime: metaPayload.templateAnime || prev.templateAnime,
        templateCharacter: metaPayload.templateCharacter || prev.templateCharacter,
        templateExpression: metaPayload.templateExpression || prev.templateExpression,
        shotRecommendation: metaPayload.shotRecommendation || prev.shotRecommendation || [],
        prohibitions: metaPayload.prohibitions || prev.prohibitions || '',
        expressionRuleText: importedRuleText,
        expressionAssets: nextAssets,
        expressionRules: nextRules
      }));
      setExpressionRuleText(importedRuleText);
    } catch (e) {
      alert('导入失败，请检查 ZIP 文件');
    } finally {
      setLoading(false);
    }
  };

  const buildUpdatedResource = () => {
    const expressionAssets = getExpressionAssets();
    const expressionStatus = type === 'expressions' ? getExpressionStatus() : resource.status;
    const expressionImages = type === 'expressions' ? syncExpressionImages(expressionAssets) : resource.images || [];
    const updatedMeta = type === 'expressions' ? { ...meta, expressionRuleText } : meta;
    return {
      ...resource,
      type,
      name,
      aliases: normalizeAliases(),
      status: type === 'characters' ? getCharacterStatus() : expressionStatus,
      priorityPin,
      description,
      tags: normalizeTags(),
      meta: updatedMeta,
      assets,
      form: forms,
      action: actions,
      images: type === 'expressions' ? expressionImages : resource.images || [],
      isAvailable: type === 'expressions' ? expressionStatus === '已完成' : resource.isAvailable,
      createdAt: resource.createdAt || Date.now(),
      updatedAt: Date.now()
    };
  };

  const handleSaveMeta = () => {
    const updatedResource = buildUpdatedResource();
    upsertResource(type, updatedResource);
    navigate(`/resources?tab=${type}`);
  };

  const handleUpdateMeta = () => {
    const updatedResource = buildUpdatedResource();
    upsertResource(type, updatedResource);
  };

  const handleDownload = () => {
    const payload = {
      type,
      id: resource.id,
      name,
      description,
      tags: normalizeTags(),
      meta,
      images: resource.images || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'resource'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    navigate(`/resources?tab=${type}`);
  };

  const resolveFormValue = (field) => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) return activeForm[field] || '';
    return meta[field] || '';
  };

  const updateFormValue = (field, value) => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      setForms((prev) =>
        prev.map((form) =>
          form.name === activeFormName
            ? {
                ...form,
                [field]: value,
                updatedAt: Date.now()
              }
            : form
        )
      );
    } else {
      setMeta((prev) => ({ ...prev, [field]: value }));
    }
  };

  const resolveFormReferences = () => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) return activeForm.referenceProfiles || [];
    return meta.referenceProfiles || [];
  };

  const updateFormReferences = (nextReferences) => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      setForms((prev) =>
        prev.map((form) =>
          form.name === activeFormName
            ? {
                ...form,
                referenceProfiles: nextReferences,
                updatedAt: Date.now()
              }
            : form
        )
      );
    } else {
      setMeta((prev) => ({ ...prev, referenceProfiles: nextReferences }));
    }
  };

  const resolveFormViews = () => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      return {
        requirements: activeForm.viewRequirements || [],
        assets: activeForm.viewAssets || []
      };
    }
    return {
      requirements: meta.viewRequirements || [],
      assets: meta.viewAssets || []
    };
  };

  const updateFormViews = (nextAssets) => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      setForms((prev) =>
        prev.map((form) =>
          form.name === activeFormName
            ? {
                ...form,
                viewAssets: nextAssets,
                updatedAt: Date.now()
              }
            : form
        )
      );
    } else {
      setMeta((prev) => ({ ...prev, viewAssets: nextAssets }));
    }
  };

  const handleViewUpload = (viewAngle) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { assets: currentAssets } = resolveFormViews();
      const filtered = currentAssets.filter((asset) => asset.viewAngle !== viewAngle);
      updateFormViews([
        ...filtered,
        {
          id: createAssetId(),
          viewAngle,
          fileName: file.name,
          src: reader.result,
          uploadedAt: new Date().toISOString()
        }
      ]);
    };
    reader.readAsDataURL(file);
  };

  const getCharacterFormOptions = (character) => {
    if (!character) return ['默认形态'];
    if (character.form && character.form.length > 0) {
      return character.form.map((form) => form.name);
    }
    return ['默认形态'];
  };

  const resolveReferenceImage = (character, formName) => {
    if (!character) return null;
    if (character.form && character.form.length > 0) {
      const matchedForm = character.form.find((form) => form.name === formName);
      const viewAssets = matchedForm?.viewAssets || [];
      const front = viewAssets.find((asset) => asset.viewAngle === '正面');
      return front?.src || viewAssets[0]?.src || character.images?.[0];
    }
    const viewAssets = character.meta?.viewAssets || [];
    const front = viewAssets.find((asset) => asset.viewAngle === '正面');
    return front?.src || viewAssets[0]?.src || character.images?.[0];
  };

  const characterReferences = resolveFormReferences();
  const { requirements: viewRequirements, assets: viewAssets } = resolveFormViews();
  const viewList = viewRequirements.length
    ? viewRequirements
    : Array.from(new Set(viewAssets.map((asset) => asset.viewAngle)));
  const expressionHistory = (meta.expressionHistory || []).filter((item) => {
    if (!historyQuery.trim()) return true;
    return `${item.character || ''}${item.name || ''}`.toLowerCase().includes(historyQuery.toLowerCase());
  });
  const expressionAssets = getExpressionAssets();
  const expressionRules = getExpressionRules();
  const mainExpressionAsset = expressionAssets.find((asset) => asset.type === 'main');
  const expressionStatus = getExpressionStatus();

  const expressionGrouping = meta.expressionGrouping || 'group';
  const sceneSettings = meta.sceneSettings || {};
  const sceneImages = meta.sceneImages || {};
  const sceneResources = meta.sceneResources || {};
  const sceneLayout = meta.sceneLayout || { elements: [] };
  const sceneDescription = meta.sceneDescription || '';
  const sceneElementDetails = meta.sceneElementDetails || [];
  const sceneVariants = meta.sceneVariants || [];
  const relationGraph = meta.relationshipGraph || { nodes: [], relations: [] };
  const growthHistory = meta.characterGrowthHistory || [];
  const relationNodes = relationGraph.nodes || [];
  const relationPositions = relationNodes.map((node, index) => {
    const angle = (index / relationNodes.length) * Math.PI * 2;
    const x = 50 + 38 * Math.cos(angle);
    const y = 50 + 38 * Math.sin(angle);
    return { ...node, position: { x, y }, key: node.id || node.name || `node-${index}` };
  });
  const expressionPreviewCharacter = data.resources.characters?.[0];
  const expressionPreviewImage = resolveReferenceImage(
    expressionPreviewCharacter,
    expressionPreviewCharacter?.form?.[0]?.name || '默认形态'
  );
  const expressionTransferRequests = (meta.expressionTransferRequests || []).filter((item) => {
    if (!transferQuery.trim()) return true;
    return `${item.name || ''}${item.character || ''}`.toLowerCase().includes(transferQuery.toLowerCase());
  });
  const characterStatus = getCharacterStatus();
  const hasCharacterMissing = characterStatus !== '已完成';

  const getSceneVariantRequirements = (variant) => {
    const images = variant.images || [];
    const requirements = variant.imageRequirements || images.map((img) => img.label);
    return requirements.length ? requirements : images.map((img) => img.label);
  };

  const hasSceneVariantMissing = (variant) => {
    const requirements = getSceneVariantRequirements(variant);
    if (!requirements.length) return false;
    return requirements.some((label) => !(variant.images || []).some((img) => img.label === label));
  };

  const sortedSceneVariants = [...sceneVariants].sort((a, b) => {
    const aMissing = hasSceneVariantMissing(a);
    const bMissing = hasSceneVariantMissing(b);
    if (aMissing === bMissing) return 0;
    return aMissing ? -1 : 1;
  });

  const handleRelationshipImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('关系网 JSON 为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      setMeta((prev) => ({ ...prev, relationshipGraph: parsed }));
    } catch (e) {
      alert('关系网 JSON 解析失败');
    }
  };

  const handleRelationshipExport = () => {
    const blob = new Blob([JSON.stringify(relationGraph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'character'}-relationship.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGrowthHistoryImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('成长史 JSON 为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      const entries = Array.isArray(parsed) ? parsed : parsed.characterGrowthHistory || [];
      setMeta((prev) => ({ ...prev, characterGrowthHistory: entries }));
    } catch (e) {
      alert('成长史 JSON 解析失败');
    }
  };

  const handleGrowthHistoryExport = () => {
    const payload = {
      characterGrowthHistory: growthHistory
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'character'}-growth-history.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenEdit = (section) => {
    if (section === 'references') {
      setDraftReferences(characterReferences.map((ref) => ({ ...ref })));
    }
    setEditingSection(section);
  };

  const handleCloseEdit = () => {
    setEditingSection('');
    setDraftReferences([]);
  };

  const handleSaveEdit = () => {
    if (editingSection === 'references') {
      updateFormReferences(draftReferences);
    }
    handleCloseEdit();
  };

  const handleSceneEditOpen = (section) => {
    if (section === 'structure') {
      setSceneDraft({
        sceneLayout: meta.sceneLayout || { elements: [] }
      });
    }
    if (section === 'description') {
      setSceneDraft({
        sceneDescription: meta.sceneDescription || '',
        sceneElementDetails: meta.sceneElementDetails || []
      });
    }
    if (section === 'variants') {
      setSceneDraft({
        sceneVariants: meta.sceneVariants || []
      });
    }
    setSceneEditingSection(section);
  };

  const handleSceneEditClose = () => {
    setSceneEditingSection('');
    setSceneDraft({});
  };

  const handleSceneEditSave = () => {
    if (sceneEditingSection === 'structure') {
      setMeta((prev) => ({ ...prev, sceneLayout: sceneDraft.sceneLayout || { elements: [] } }));
    }
    if (sceneEditingSection === 'description') {
      setMeta((prev) => ({
        ...prev,
        sceneDescription: sceneDraft.sceneDescription || '',
        sceneElementDetails: sceneDraft.sceneElementDetails || []
      }));
    }
    if (sceneEditingSection === 'variants') {
      setMeta((prev) => ({ ...prev, sceneVariants: sceneDraft.sceneVariants || [] }));
    }
    handleSceneEditClose();
  };

  const handleSceneVariantImageUpload = (variantId, label) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeta((prev) => {
        const variants = prev.sceneVariants || [];
        const nextVariants = variants.map((variant) => {
          if (variant.id !== variantId) return variant;
          const images = variant.images || [];
          const filtered = images.filter((img) => img.label !== label);
          return {
            ...variant,
            images: [
              ...filtered,
              {
                id: createAssetId(),
                label,
                src: reader.result,
                uploadedAt: new Date().toISOString()
              }
            ]
          };
        });
        return { ...prev, sceneVariants: nextVariants };
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSceneVariantBatchUpload = (variantId, requirements) => async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ src: reader.result, fileName: file.name });
          reader.readAsDataURL(file);
        })
    );
    const results = await Promise.all(readers);
    setMeta((prev) => {
      const variants = prev.sceneVariants || [];
      const nextVariants = variants.map((variant) => {
        if (variant.id !== variantId) return variant;
        const images = variant.images || [];
        const existingLabels = new Set(images.map((img) => img.label));
        const missingLabels = requirements.filter((label) => !existingLabels.has(label));
        const nextImages = [...images];
        results.forEach((result, index) => {
          const label = missingLabels[index] || result.fileName;
          nextImages.push({
            id: createAssetId(),
            label,
            src: result.src,
            uploadedAt: new Date().toISOString()
          });
        });
        return { ...variant, images: nextImages };
      });
      return { ...prev, sceneVariants: nextVariants };
    });
  };

  const handleSceneVariantExport = (variant) => {
    const payload = {
      id: variant.id,
      name: variant.name,
      season: variant.season,
      weather: variant.weather,
      time: variant.time,
      imageRequirements: variant.imageRequirements || [],
      images: variant.images || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'scene'}-${variant.name || 'variant'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getRelationByTarget = (node) => {
    const relations = relationGraph.relations || [];
    const centerKeys = [resource.id, resource.name].filter(Boolean).map((value) => String(value).toLowerCase());
    const nodeKeys = [node?.id, node?.name].filter(Boolean).map((value) => String(value).toLowerCase());
    const matches = (value, keys) => value && keys.includes(String(value).toLowerCase());
    return relations.find((rel) => {
      if (rel.targetId) {
        return rel.targetId === node?.id || rel.targetId === node?.name;
      }
      const source = rel.source ?? rel.sourceId ?? rel.from ?? rel.fromId ?? rel.sourceName;
      const target = rel.target ?? rel.targetId ?? rel.to ?? rel.toId ?? rel.targetName;
      const isSourceCenter = matches(source, centerKeys);
      const isTargetCenter = matches(target, centerKeys);
      const isSourceNode = matches(source, nodeKeys);
      const isTargetNode = matches(target, nodeKeys);
      return (isSourceCenter && isTargetNode) || (isTargetCenter && isSourceNode);
    });
  };

  const renderCharacterDetail = () => (
    <div className="character-detail">
      <div className="resource-header">
        <div>
          <h2>角色资源 - {resource.name}</h2>
        </div>
        <div className="resource-header-actions">
          <button type="button" className="ghost-button" onClick={handleBack}>
            返回列表
          </button>
        </div>
      </div>

      <div className="resource-tabs">
        {[
          { key: 'base', label: '基础信息' },
          { key: 'appearance', label: '形象管理' },
          { key: 'relations', label: '关系网' },
          { key: 'growth', label: '角色成长史' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={characterTab === tab.key ? 'tab active' : 'tab'}
            onClick={() => setCharacterTab(tab.key)}
          >
            {tab.label}
            {tab.key === 'appearance' && hasCharacterMissing && <span className="tab-dot" />}
          </button>
        ))}
      </div>

      {characterTab === 'base' && (
        <div className="card-grid">
          <div className="card section-card">
            <div className="section-header">
              <h3>基础信息</h3>
              <button type="button" className="ghost-button" onClick={() => handleOpenEdit('base')}>
                修改
              </button>
            </div>
            <div className="info-grid">
              <div>
                <div className="label">角色名称</div>
                <div className="readonly-field">{name || '未填写'}</div>
              </div>
              <div>
                <div className="label">角色标签</div>
                <div className="readonly-field">{normalizeTags().join('、') || '未填写'}</div>
              </div>
              <div className="span-2">
                <div className="label">角色背景描述</div>
                <div className="readonly-field">{resolveFormValue('persona') || '未填写'}</div>
              </div>
              <div className="span-2">
                <div className="label">性格设定</div>
                <div className="readonly-field multi-line">{meta.personalitySetting || '未填写'}</div>
              </div>
              <div className="span-2">
                <div className="label">成长轨迹</div>
                <div className="readonly-field multi-line">{meta.growthTrajectory || '未填写'}</div>
              </div>
              <div>
                <div className="label">置顶角色</div>
                <div className="readonly-field">{priorityPin ? '是' : '否'}</div>
              </div>
              <div>
                <div className="label">当前状态</div>
                <div className="readonly-field">{getCharacterStatus()}</div>
              </div>
            </div>
          </div>
          <div className="card section-card">
            <h3>角色操作</h3>
            <div className="muted">后续角色整体的操作按钮将集中在此处。</div>
            <div className="action-hint">当前暂无更多可用操作。</div>
          </div>
        </div>
      )}

      {characterTab === 'appearance' && (
        <div className="card-grid">
          {forms.length > 1 && (
            <div className="sub-tabs">
              {forms.map((form) => (
                <button
                  key={form.name}
                  type="button"
                  className={activeFormName === form.name ? 'tab active' : 'tab'}
                  onClick={() => setActiveFormName(form.name)}
                >
                  {form.name}
                </button>
              ))}
            </div>
          )}
          <div className="card section-card">
            <div className="section-header">
              <h3>形态信息</h3>
              <button type="button" className="ghost-button" onClick={() => handleOpenEdit('formInfo')}>
                修改
              </button>
            </div>
            <div className="info-stack">
              <div>
                <div className="label">人设</div>
                <div className="readonly-field multi-line">{resolveFormValue('persona') || '未填写'}</div>
              </div>
              <div>
                <div className="label">外貌描写（导出提示词）</div>
                <div className="readonly-field multi-line">{resolveFormValue('appearance') || '未填写'}</div>
              </div>
            </div>
          </div>
          <div className="card section-card">
            <div className="section-header">
              <h3>参考人物</h3>
              <button type="button" className="ghost-button" onClick={() => handleOpenEdit('references')}>
                修改
              </button>
            </div>
            <div className="reference-table">
              <div className="reference-header">
                <div>参考角色</div>
                <div>参考目标</div>
                <div>权重</div>
              </div>
              {characterReferences.length === 0 && <div className="empty">暂无参考人物记录。</div>}
              {characterReferences.map((ref) => {
                const character = data.resources.characters.find((item) => item.id === ref.characterId);
                const formLabel = ref.formName || '默认形态';
                const preview = resolveReferenceImage(character, formLabel);
                return (
                  <div key={ref.id} className="reference-row">
                    <div className="reference-cell">
                      <div className="reference-avatar">
                        {preview ? <img src={preview} alt={character?.name || '参考角色'} /> : <div className="placeholder" />}
                      </div>
                      <div>
                        <div className="reference-name">{character?.name || '未知角色'}</div>
                        <div className="muted">{formLabel}</div>
                      </div>
                    </div>
                    <div className="reference-cell">{ref.target || '未填写'}</div>
                    <div className="reference-cell">{ref.weight ?? 0}%</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card section-card">
            <div className="section-header">
              <h3>上传下载</h3>
              <div className="resource-header-actions">
                <label className="file-button">
                  导入角色资源包
                  <input type="file" accept="application/zip" onChange={handleCharacterImport} />
                </label>
                <button type="button" onClick={handleCharacterExport}>
                  导出角色资源包
                </button>
              </div>
            </div>
            {viewList.length === 0 ? (
              <div className="empty">暂无视角需求，请等待分镜头AI回传。</div>
            ) : (
              <div className="portrait-grid">
                {viewList.map((viewAngle) => {
                  const asset = viewAssets.find((item) => item.viewAngle === viewAngle);
                  return (
                    <div key={viewAngle} className="portrait-card">
                      <button
                        type="button"
                        className="portrait-preview"
                        onClick={() => asset?.src && window.open(asset.src, '_blank')}
                      >
                        {asset?.src ? <img src={asset.src} alt={viewAngle} /> : <div className="portrait-placeholder">暂无图片</div>}
                      </button>
                      <div className="portrait-meta">
                        <span>{viewAngle}</span>
                        <label className="file-button">
                          上传
                          <input type="file" accept="image/*" onChange={handleViewUpload(viewAngle)} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {characterTab === 'relations' && (
        <div className="card section-card">
          <div className="section-header">
            <h3>关系网</h3>
            <div className="resource-header-actions">
              <button type="button" className="ghost-button" onClick={handleRelationshipExport}>
                导出关系网
              </button>
              <label className="file-button">
                导入关系网
                <input type="file" accept="application/json" onChange={handleRelationshipImport} />
              </label>
            </div>
          </div>
          <div className="relation-board">
            {relationNodes.length ? (
              <div className="relation-network">
                <svg className="relation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {relationPositions.map((node) => (
                    <line
                      key={`line-${node.key}`}
                      x1="50"
                      y1="50"
                      x2={node.position.x}
                      y2={node.position.y}
                    />
                  ))}
                </svg>
                {relationPositions.map((node) => (
                  <button
                    key={node.key}
                    type="button"
                    className="relation-node"
                    style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
                    onClick={() => setFocusedRelation(node)}
                  >
                    {node.name}
                  </button>
                ))}
                <div className="relation-center">{resource.name}</div>
              </div>
            ) : (
              <div className="empty">暂无关系网数据，可导入 JSON 进行展示。</div>
            )}
          </div>
          {focusedRelation && (
            <div className="relation-focus">
              <div className="relation-focus-node">{focusedRelation.name}</div>
              {(() => {
                const relationDetail = getRelationByTarget(focusedRelation);
                return (
                  <div className="relation-focus-card">
                    <div className="label">
                      {resource.name} ⇄ {focusedRelation.name}
                    </div>
                    <div className="muted">{relationDetail?.relation || '关系待补充'}</div>
                    {(relationDetail?.emotions || []).map((emotion, idx) => (
                      <div key={idx} className="muted">
                        {emotion.label}：{emotion.value}
                      </div>
                    ))}
                    {relationDetail?.currentEmotion && (
                      <div className="muted">当下情绪：{relationDetail.currentEmotion}</div>
                    )}
                    {relationDetail?.cause && (
                      <div className="muted">前因：{relationDetail.cause}</div>
                    )}
                    {relationDetail?.consequence && (
                      <div className="muted">后果：{relationDetail.consequence}</div>
                    )}
                  </div>
                );
              })()}
              <div className="relation-focus-node">{resource.name}</div>
            </div>
          )}
        </div>
      )}

      {characterTab === 'growth' && (
        <div className="card section-card">
          <div className="section-header">
            <h3>角色成长史</h3>
            <div className="resource-header-actions">
              <button type="button" className="ghost-button" onClick={handleGrowthHistoryExport}>
                导出成长史
              </button>
              <label className="file-button">
                导入成长史
                <input type="file" accept="application/json" onChange={handleGrowthHistoryImport} />
              </label>
            </div>
          </div>
          {growthHistory.length ? (
            <div className="growth-history-list">
              {growthHistory.map((entry, index) => (
                <div key={`${entry.chapter || 'chapter'}-${index}`} className="growth-history-card">
                  <div className="label">{entry.chapter || '未标注章节'}</div>
                  <div className="growth-history-change">{entry.change || '变化待补充'}</div>
                  <div className="muted">{entry.description || '暂无描述'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无成长史数据，可导入 JSON 进行展示。</div>
          )}
        </div>
      )}

      {editingSection && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>编辑{editingSection === 'base' ? '基础信息' : editingSection === 'formInfo' ? '形态信息' : '参考人物'}</h3>
            </div>
            {editingSection === 'base' && (
              <div className="form-grid cols-2">
                <label>
                  角色名称
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  角色标签（逗号分隔）
                  <input value={tags} onChange={(e) => setTags(e.target.value)} />
                </label>
                <label className="span-2">
                  角色背景描述
                  <textarea
                    value={resolveFormValue('persona')}
                    onChange={(e) => updateFormValue('persona', e.target.value)}
                    className="large-input"
                  />
                </label>
                <label className="span-2">
                  性格设定
                  <textarea
                    value={meta.personalitySetting || ''}
                    onChange={(e) => setMeta((prev) => ({ ...prev, personalitySetting: e.target.value }))}
                    className="large-input"
                  />
                </label>
                <label className="span-2">
                  成长轨迹
                  <textarea
                    value={meta.growthTrajectory || ''}
                    onChange={(e) => setMeta((prev) => ({ ...prev, growthTrajectory: e.target.value }))}
                    className="large-input"
                  />
                </label>
                <label>
                  置顶角色
                  <select value={priorityPin ? 'yes' : 'no'} onChange={(e) => setPriorityPin(e.target.value === 'yes')}>
                    <option value="no">否</option>
                    <option value="yes">是</option>
                  </select>
                </label>
              </div>
            )}
            {editingSection === 'formInfo' && (
              <div className="form-grid cols-1">
                <label>
                  人设
                  <textarea
                    value={resolveFormValue('persona')}
                    onChange={(e) => updateFormValue('persona', e.target.value)}
                    className="large-input"
                  />
                </label>
                <label>
                  外貌描写（导出提示词）
                  <textarea
                    value={resolveFormValue('appearance')}
                    onChange={(e) => updateFormValue('appearance', e.target.value)}
                    className="large-input"
                  />
                </label>
              </div>
            )}
            {editingSection === 'references' && (
              <div className="reference-editor">
                {draftReferences.length === 0 && <div className="empty">暂无参考人物，请添加。</div>}
                {draftReferences.map((item, idx) => {
                  const character = data.resources.characters.find((entry) => entry.id === item.characterId);
                  const formOptions = getCharacterFormOptions(character);
                  return (
                    <div key={item.id || idx} className="reference-editor-row">
                      <label>
                        参考角色
                        <select
                          value={item.characterId || ''}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].characterId = e.target.value;
                            const targetCharacter = data.resources.characters.find(
                              (entry) => entry.id === e.target.value
                            );
                            next[idx].formName = getCharacterFormOptions(targetCharacter)[0];
                            setDraftReferences(next);
                          }}
                        >
                          <option value="">请选择角色</option>
                          {data.resources.characters.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        参考形态
                        <select
                          value={item.formName || formOptions[0]}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].formName = e.target.value;
                            setDraftReferences(next);
                          }}
                        >
                          {formOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        参考目标
                        <input
                          value={item.target || ''}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].target = e.target.value;
                            setDraftReferences(next);
                          }}
                        />
                      </label>
                      <label>
                        权重值
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={item.weight ?? 50}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].weight = Number(e.target.value);
                            setDraftReferences(next);
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.weight ?? 50}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].weight = Number(e.target.value);
                            setDraftReferences(next);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => setDraftReferences((prev) => prev.filter((_, refIdx) => refIdx !== idx))}
                      >
                        删除
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setDraftReferences((prev) => [
                      ...prev,
                      { id: createAssetId(), characterId: '', formName: '', target: '', weight: 50 }
                    ])
                  }
                >
                  添加参考人物
                </button>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={handleCloseEdit}>
                取消
              </button>
              <button type="button" onClick={handleSaveEdit}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="resource-footer">
        <div className="resource-footer-actions">
          <button type="button" className="ghost-button" onClick={handleBack}>
            返回列表
          </button>
          <button type="button" onClick={handleSaveMeta}>
            保存并返回
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="resource-detail">
      {type === 'characters' && renderCharacterDetail()}
      {type !== 'characters' && (
        <div className="card">
          <div className="resource-header">
            <div className="resource-title">
              {isEditingTitle ? (
                <div className="title-edit">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="资源名称"
                  />
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setName(draftTitle.trim());
                      setIsEditingTitle(false);
                    }}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setDraftTitle(name);
                      setIsEditingTitle(false);
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="title-row">
                  <h2>{typeLabels[type]} - {resource.name}</h2>
                  <button type="button" className="text-link" onClick={() => setIsEditingTitle(true)}>
                    修改
                  </button>
                </div>
              )}
            </div>
            <div className="resource-header-actions">
              <button type="button" className="ghost-button" onClick={handleBack}>
                返回列表
              </button>
            </div>
          </div>
          {type === 'scenes' && (
            <div className="stack">
              <div className="resource-tabs">
                {[
                  { key: 'structure', label: '场景结构图展示' },
                  { key: 'images', label: '图片管理' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={sceneTab === tab.key ? 'tab active' : 'tab'}
                    onClick={() => setSceneTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {sceneTab === 'structure' && (
                <div className="card section-card">
                  <div className="section-header">
                    <h3>场景结构图展示</h3>
                    <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('structure')}>
                      修改
                    </button>
                  </div>
                  <div className="scene-preview scene-readonly">
                    <div className="scene-preview-header">结构图展示</div>
                    <div className="scene-canvas scene-canvas-grid">
                      {sceneLayout.elements.length === 0 && (
                        <div className="empty">暂无结构图元素，等待分镜头AI回传。</div>
                      )}
                      {sceneLayout.elements.map((element) => {
                        const left = `${(element.x || 0) * 100}%`;
                        const top = `${(element.y || 0) * 100}%`;
                        if (element.type === 'character') {
                          return (
                            <div
                              key={element.id || `${element.name}-${left}`}
                              className="scene-node character-node"
                              style={{ left, top, transform: `translate(-50%, -50%) rotate(${element.direction || 0}deg)` }}
                            >
                              <span>{element.name}</span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={element.id || `${element.name}-${left}`}
                            className="scene-node"
                            style={{ left, top }}
                          >
                            {element.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="scene-description">
                    <div className="section-header">
                      <h3>画面描述</h3>
                      <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('description')}>
                        修改
                      </button>
                    </div>
                    <div className="info-stack">
                      <div>
                        <div className="label">场景整体描述</div>
                        <div className="readonly-field multi-line">{sceneDescription || '未填写'}</div>
                      </div>
                      <div>
                        <div className="label">元素详述</div>
                        {sceneElementDetails.length === 0 && <div className="empty">暂无元素详述。</div>}
                        {sceneElementDetails.map((detail, idx) => (
                          <div key={idx} className="readonly-field multi-line scene-detail-card">
                            <strong>{detail.element}</strong>
                            <div>{detail.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {sceneTab === 'images' && (
                <div className="stack">
                  {sceneVariants.length === 0 && (
                    <div className="card section-card">
                      <div className="empty">暂无场景版本，请等待分镜头AI回传需求。</div>
                    </div>
                  )}
                  {sortedSceneVariants.map((variant) => {
                    const titleParts = [
                      variant.name || resource.name || '场景',
                      variant.season,
                      variant.weather,
                      variant.time
                    ].filter(Boolean);
                    const images = variant.images || [];
                    const displayCards = getSceneVariantRequirements(variant);
                    const variantMissing = hasSceneVariantMissing(variant);
                    return (
                      <div key={variant.id} className={`card section-card ${variantMissing ? 'variant-missing' : ''}`}>
                        <div className="section-header">
                          <h3>
                            {titleParts.join('-')}
                            {variantMissing && <span className="status-dot" />}
                          </h3>
                          <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('variants')}>
                            修改
                          </button>
                        </div>
                        <div className="scene-variant-grid">
                          {displayCards.length === 0 && <div className="empty">暂无图片需求。</div>}
                          {displayCards.map((label) => {
                            const image = images.find((img) => img.label === label);
                            return (
                              <div key={`${variant.id}-${label}`} className="scene-variant-card">
                                <div className="scene-variant-preview">
                                  {image?.src ? <img src={image.src} alt={label} /> : <div className="placeholder">暂无图片</div>}
                                </div>
                                <div className="scene-variant-meta">
                                  <span>{label}</span>
                                  <label className="file-button">
                                    上传
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleSceneVariantImageUpload(variant.id, label)}
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="row align-right">
                          <button type="button" onClick={() => handleSceneVariantExport(variant)}>
                            下载
                          </button>
                          <label className="file-button">
                            上传
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleSceneVariantBatchUpload(variant.id, displayCards)}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {sceneEditingSection && type === 'scenes' && (
            <div className="modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>
                    编辑
                    {sceneEditingSection === 'structure'
                      ? '场景结构图'
                      : sceneEditingSection === 'description'
                        ? '画面描述'
                        : '场景版本'}
                  </h3>
                </div>
                {sceneEditingSection === 'structure' && (
                  <label>
                    场景结构 JSON
                    <textarea
                      className="large-input"
                      value={JSON.stringify(sceneDraft.sceneLayout || { elements: [] }, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '{}');
                          setSceneDraft((prev) => ({ ...prev, sceneLayout: parsed }));
                        } catch (err) {
                          setSceneDraft((prev) => ({ ...prev, sceneLayout: prev.sceneLayout }));
                        }
                      }}
                    />
                  </label>
                )}
                {sceneEditingSection === 'description' && (
                  <div className="form-grid cols-1">
                    <label>
                      场景整体描述
                      <textarea
                        className="large-input"
                        value={sceneDraft.sceneDescription || ''}
                        onChange={(e) => setSceneDraft((prev) => ({ ...prev, sceneDescription: e.target.value }))}
                      />
                    </label>
                    <label>
                      元素详述 JSON（数组）
                      <textarea
                        className="large-input"
                        value={JSON.stringify(sceneDraft.sceneElementDetails || [], null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || '[]');
                            setSceneDraft((prev) => ({ ...prev, sceneElementDetails: parsed }));
                          } catch (err) {
                            setSceneDraft((prev) => ({ ...prev }));
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                {sceneEditingSection === 'variants' && (
                  <label>
                    场景版本 JSON（数组）
                    <textarea
                      className="large-input"
                      value={JSON.stringify(sceneDraft.sceneVariants || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '[]');
                          setSceneDraft((prev) => ({ ...prev, sceneVariants: parsed }));
                        } catch (err) {
                          setSceneDraft((prev) => ({ ...prev }));
                        }
                      }}
                    />
                  </label>
                )}
                <div className="modal-actions">
                  <button type="button" className="ghost-button" onClick={handleSceneEditClose}>
                    取消
                  </button>
                  <button type="button" onClick={handleSceneEditSave}>
                    确认
                  </button>
                </div>
              </div>
            </div>
          )}
          {type === 'expressions' && (
            <div className="stack">
              <div className="tabs">
                {expressionTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={expressionTab === tab.key ? 'tab active' : 'tab'}
                    onClick={() => setExpressionTab(tab.key)}
                  >
                    {tab.label}
                    {tab.key === 'transfer' && expressionStatus !== '已完成' && <span className="tab-dot" />}
                  </button>
                ))}
              </div>
              {expressionTab === 'base' && (
                <div className="stack">
                  <div className="expression-base-layout">
                    <div className="stack">
                      <div className="row">
                        <label>
                          情绪类型
                          <input
                            value={meta.emotionType || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, emotionType: e.target.value }))}
                            placeholder="如：开心、愤怒"
                          />
                        </label>
                        <label>
                          情绪值
                          <input
                            value={meta.emotionValue || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, emotionValue: e.target.value }))}
                            placeholder="如：80%"
                          />
                        </label>
                        <label>
                          匹配背景
                          <input
                            value={meta.background || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, background: e.target.value }))}
                            placeholder="适用场景/背景"
                          />
                        </label>
                      </div>
                      <div className="row">
                        <label>
                          表情分类
                          <input
                            value={meta.category || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, category: e.target.value }))}
                            placeholder="如：情绪爆发类"
                          />
                        </label>
                        <label>
                          适用范围
                          <select
                            value={meta.scope || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, scope: e.target.value }))}
                          >
                            {scopeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          风险等级
                          <select
                            value={meta.riskLevel || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, riskLevel: e.target.value }))}
                          >
                            {riskOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          生图策略
                          <select
                            value={meta.strategy || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, strategy: e.target.value }))}
                          >
                            <option value="">选择策略</option>
                            {strategyOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        表情描述
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="large-input"
                          placeholder="描述表情的适用场景与表现重点。"
                        />
                      </label>
                      <div className="row">
                        <label>
                          模板动漫来源
                          <input
                            value={meta.templateAnime || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, templateAnime: e.target.value }))}
                          />
                        </label>
                        <label>
                          模板角色
                          <input
                            value={meta.templateCharacter || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, templateCharacter: e.target.value }))}
                          />
                        </label>
                        <label>
                          模板表情描述
                          <input
                            value={meta.templateExpression || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, templateExpression: e.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="row">
                        <label>
                          表情卡片归纳方式
                          <select
                            value={expressionGrouping}
                            onChange={(e) => setMeta((prev) => ({ ...prev, expressionGrouping: e.target.value }))}
                          >
                            <option value="group">多个情绪值合并一张卡片</option>
                            <option value="split">每个情绪值独立卡片</option>
                          </select>
                        </label>
                        <label>
                          推荐镜头（逗号分隔）
                          <input
                            value={(meta.shotRecommendation || []).join(', ')}
                            onChange={(e) =>
                              setMeta((prev) => ({
                                ...prev,
                                shotRecommendation: e.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                              }))
                            }
                            placeholder="closeup, medium"
                          />
                        </label>
                        <label>
                          禁止事项
                          <input
                            value={meta.prohibitions || ''}
                            onChange={(e) => setMeta((prev) => ({ ...prev, prohibitions: e.target.value }))}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="expression-preview-panel">
                      {expressionPreviewImage ? (
                        <img src={expressionPreviewImage} alt="颜艺示例" className="expression-preview-image" />
                      ) : (
                        <div className="expression-preview-placeholder">暂无示例图</div>
                      )}
                    </div>
                  </div>
                  <div className="card subtle">
                    <h3>分镜推荐用法</h3>
                    <textarea
                      className="large-input"
                      readOnly
                      value={`使用场景：${description || ''}\n镜头建议：${(meta.shotRecommendation || []).join(' / ') || '特写'}\n用词建议：眼睛爆裂、牙关紧咬、额头青筋\n组合建议：可搭配汗滴/阴影遮眼特效，但不要叠加另一种颜艺`}
                    />
                    <button type="button" onClick={() => navigator.clipboard.writeText(resource.id)}>
                      复制模板
                    </button>
                  </div>
                  <div className="row align-right">
                    <div className="status-chip">当前状态：{expressionStatus}</div>
                    <button type="button" onClick={handleUpdateMeta}>
                      更新表情信息
                    </button>
                  </div>
                </div>
              )}
              {expressionTab === 'assets' && (
                <div className="expression-asset-layout">
                  <div className="card subtle expression-rule-panel">
                    <div className="section-header">
                      <h3>规则说明</h3>
                      <label className="file-button">
                        上传规则
                        <input type="file" accept=".txt" onChange={handleExpressionRuleUpload} />
                      </label>
                    </div>
                    <textarea
                      value={expressionRuleText}
                      onChange={(e) => setExpressionRuleText(e.target.value)}
                      className="large-input"
                      placeholder="请在此填写颜艺生成规则（自然语言描述即可）。"
                    />
                    <div className="row align-right">
                      <button type="button" onClick={handleExpressionRuleSave}>
                        保存规则
                      </button>
                    </div>
                  </div>
                  <div className="card subtle expression-image-panel">
                    <h3>主参考图</h3>
                    {mainExpressionAsset?.src ? (
                      <img src={mainExpressionAsset.src} alt="主参考" className="expression-main-image" />
                    ) : (
                      <div className="expression-main-placeholder">请上传主参考图</div>
                    )}
                    <label className="file-button">
                      上传主图
                      <input type="file" accept="image/*" onChange={handleExpressionAssetUpload('main')} />
                    </label>
                  </div>
                </div>
              )}
              {expressionTab === 'transfer' && (
                <div className="stack">
                  <div className="row card-actions">
                    <div className="row">
                      <input
                        value={transferQuery}
                        onChange={(e) => setTransferQuery(e.target.value)}
                        placeholder="搜索角色或表情"
                      />
                    </div>
                    <div className="row">
                      <button type="button" onClick={handleExpressionExportZip} disabled={loading}>
                        导出表情资源包
                      </button>
                      <label className="file-button">
                        表情规则库-表情-导入/导出-对应角色-上传
                        <input type="file" accept="application/zip" onChange={handleExpressionImportZip} />
                      </label>
                    </div>
                  </div>
                  <div className="expression-transfer-grid">
                    {expressionTransferRequests.length === 0 && (
                      <div className="empty">暂无生图包需求卡片。</div>
                    )}
                      {expressionTransferRequests.map((item) => (
                        <div key={item.id} className="expression-transfer-card">
                          <div className="expression-transfer-preview">
                            {item.cover ? (
                              <img src={item.cover} alt={item.name || '生图包'} />
                            ) : (
                              <div className="expression-transfer-placeholder">待生成</div>
                            )}
                            {!item.cover && <span className="status-dot" />}
                          </div>
                          <div className="expression-transfer-title">{item.name || '颜艺生图包'}</div>
                          <div className="expression-transfer-meta">{item.character || '未指定角色'}</div>
                          <button type="button">下载生图包</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="muted">当前状态：{expressionStatus}</div>
            </div>
          )}
          {type !== 'characters' && type !== 'scenes' && type !== 'expressions' && (
            <div className="row">
              <div>
                <p>上传 zip（自动解压图片）</p>
                <input type="file" accept="application/zip" onChange={handleZipUpload} />
              </div>
              <div>
                <p>补充图片（可多选）</p>
                <input type="file" accept="image/*" multiple onChange={handleSingleUpload} />
              </div>
              <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
            </div>
          )}
          {type !== 'scenes' && type !== 'expressions' && (
            <label>
              标签（逗号分隔）
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="角色, 主角" />
            </label>
          )}
          {loading && <div className="muted">正在处理...</div>}
          {type === 'expressions' && (
            <div className="card subtle">
              <h3>表情历史记录</h3>
              <div className="row">
                <input
                  placeholder="搜索角色或表情"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                />
                <span className="muted">同表情在不同角色间的复用记录</span>
              </div>
              <div className="list">
                {expressionHistory.map((item, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <div className="list-title">{item.name || '表情'}</div>
                      <div className="muted">角色：{item.character || '未知'}</div>
                      <div className="muted">情绪值：{item.value || '-'}</div>
                    </div>
                    <button type="button" onClick={handleDownload}>
                      下载更新规则
                    </button>
                  </div>
                ))}
                {expressionHistory.length === 0 && <div className="empty">暂无历史记录。</div>}
              </div>
            </div>
          )}
          {type !== 'characters' && type !== 'scenes' && type !== 'expressions' && (
            <div className="grid">
              {(resource.images || []).map((img, idx) => {
                const imageSrc = img?.src || img;
                const imageKey = img?.id || imageSrc || idx;
                return (
                  <div key={imageKey} className="item-card">
                    <img src={imageSrc} alt={`res-${idx}`} className="cover checkerboard" />
                    <button
                      className="danger"
                      onClick={() =>
                        updateResourceImages(
                          type,
                          resourceId,
                          resource.images.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      删除图片
                    </button>
                  </div>
                );
              })}
              {(resource.images || []).length === 0 && <div className="empty">暂无图片，上传 zip 或补充图片。</div>}
            </div>
          )}
          <div className="row align-right">
            <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceDetail;
