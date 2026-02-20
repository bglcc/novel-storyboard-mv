import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  const location = useLocation();
  const { data, updateNovel, updateResourceImages, upsertResource, upsertRule } = useData();
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
  const [previewImage, setPreviewImage] = useState('');
  const [previewLabel, setPreviewLabel] = useState('');
  const viewInputRefs = useRef({});
  const sceneInputRefs = useRef({});
  const expressionTransferRefs = useRef({});
  const novelIdFromQuery = new URLSearchParams(location.search).get('novelId') || '';
  const currentNovel = data.novels?.find((novel) => novel.id === novelIdFromQuery);
  const novelRelationshipGraph = currentNovel?.relationshipGraph;

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
            storage: '本地部署使用 base64/Blob 存储在浏览器数据中，不支持直接写入本地路。'
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
  const resolveRelationGraph = () => novelRelationshipGraph || meta.relationshipGraph || { nodes: [], relations: [] };
  const buildCharacterRelationGraph = () => {
    const graph = resolveRelationGraph();
    if (!resource || !novelRelationshipGraph) {
      return graph;
    }
    const relations = graph.relations || [];
    const centerKeys = [resource.id, resource.name].filter(Boolean).map((value) => String(value).toLowerCase());
    const matches = (value, keys) => value && keys.includes(String(value).toLowerCase());
    const relatedRelations = relations.filter((rel) => {
      const source = rel.source ?? rel.sourceId ?? rel.from ?? rel.fromId ?? rel.sourceName;
      const target = rel.target ?? rel.targetId ?? rel.to ?? rel.toId ?? rel.targetName;
      return matches(source, centerKeys) || matches(target, centerKeys);
    });
    const relatedKeys = new Map();
    relatedRelations.forEach((rel) => {
      const source = rel.source ?? rel.sourceId ?? rel.from ?? rel.fromId ?? rel.sourceName;
      const target = rel.target ?? rel.targetId ?? rel.to ?? rel.toId ?? rel.targetName;
      if (source && !matches(source, centerKeys)) {
        const key = String(source).toLowerCase();
        if (!relatedKeys.has(key)) relatedKeys.set(key, String(source));
      }
      if (target && !matches(target, centerKeys)) {
        const key = String(target).toLowerCase();
        if (!relatedKeys.has(key)) relatedKeys.set(key, String(target));
      }
    });
    const nodes = (graph.nodes || []).filter((node) => {
      const keys = [node.id, node.name].filter(Boolean).map((value) => String(value).toLowerCase());
      return keys.some((key) => relatedKeys.has(key));
    });
    relatedKeys.forEach((rawValue, key) => {
      const exists = nodes.some((node) =>
        [node.id, node.name].filter(Boolean).map((value) => String(value).toLowerCase()).includes(key)
      );
      if (!exists) {
        nodes.push({ id: rawValue, name: rawValue });
      }
    });
    return { ...graph, nodes, relations: relatedRelations };
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
      const entries = parsed.entries || parsed.characterGrowthHistory?.entries || parsed.characterGrowthHistory || [];
      setMeta((prev) => ({ ...prev, characterGrowthHistory: entries }));
    } catch (e) {
      alert('成长史 JSON 解析失败');
    }
  };

  const handleGrowthHistoryExport = () => {
    const payload = {
      character: {
        id: resource.id,
        name: resource.name
      },
      entries: meta.characterGrowthHistory || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'character'}-growth-history.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExpressionTransferUpload = (requestId) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeta((prev) => ({
        ...prev,
        expressionTransferRequests: (prev.expressionTransferRequests || []).map((item) =>
          item.id === requestId ? { ...item, image: reader.result, fileName: file.name } : item
        )
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleExpressionTransferDownload = (request) => {
    const source = request?.image || request?.cover;
    if (!source) return;
    const link = document.createElement('a');
    link.href = source;
    link.download = `${request.character || request.name || 'expression'}.png`;
    link.click();
  };
      if (!cleaned) {
        alert('场景规则包为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      const payload = parsed.scene || parsed;
      setName(payload.name || resource.name || '');
      setDescription(payload.description || '');
      if (payload.tags) {
        setTags((payload.tags || []).join(', '));
      }
      setMeta((prev) => ({
        ...prev,
        sceneLayout: payload.meta?.sceneLayout || payload.sceneLayout || prev.sceneLayout,
        sceneDescription: payload.meta?.sceneDescription || payload.sceneDescription || prev.sceneDescription,
        sceneElementDetails: payload.meta?.sceneElementDetails || payload.sceneElementDetails || prev.sceneElementDetails,
        sceneVariants: payload.meta?.sceneVariants || payload.sceneVariants || prev.sceneVariants
      }));
    } catch (error) {
      alert('场景规则包解析失败');
    }
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
    let results = [];
    const [firstFile] = files;
    if (firstFile && /\.zip$/i.test(firstFile.name)) {
      try {
        const zip = await JSZip.loadAsync(firstFile);
        const entries = Object.values(zip.files).filter(
          (file) => !file.dir && /\.(png|jpg|jpeg|webp)$/i.test(file.name)
        );
        for (const entry of entries) {
          const base64 = await entry.async('base64');
          const extension = entry.name.split('.').pop();
          results.push({
            src: `data:image/${extension};base64,${base64}`,
            fileName: entry.name
          });
        }
      } catch (error) {
        alert('解压失败，请检查 ZIP 文件');
        return;
      }
    } else {
      const readers = files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ src: reader.result, fileName: file.name });
            reader.readAsDataURL(file);
          })
      );
      results = await Promise.all(readers);
    }
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

  const propVariants = meta.propVariants || [];

  const getPropVariantRequirements = (variant) => {
    const images = variant.images || [];
    const requirements = variant.imageRequirements || images.map((img) => img.label);
    return requirements.length ? requirements : images.map((img) => img.label);
  };

  const handlePropVariantImageUpload = (variantId, label) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeta((prev) => {
        const variants = prev.propVariants || [];
        const nextVariants = variants.map((variant) => {
          if (variant.id !== variantId) return variant;
          const images = variant.images || [];
          const filtered = images.filter((img) => img.label !== label);
          return {
            ...variant,
            images: [
              ...filtered,
              { id: createAssetId(), label, src: reader.result, uploadedAt: new Date().toISOString() }
            ]
          };
        });
        return { ...prev, propVariants: nextVariants };
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePropVariantBatchUpload = (variantId, requirements) => async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    let results = [];
    const [firstFile] = files;
    if (firstFile && /\.zip$/i.test(firstFile.name)) {
      try {
        const zip = await JSZip.loadAsync(firstFile);
        const entries = Object.values(zip.files).filter(
          (file) => !file.dir && /\.(png|jpg|jpeg|webp)$/i.test(file.name)
        );
        for (const entry of entries) {
          const base64 = await entry.async('base64');
          const extension = entry.name.split('.').pop();
          results.push({
            src: `data:image/${extension};base64,${base64}`,
            fileName: entry.name
          });
        }
      } catch (error) {
        alert('解压失败，请检查 ZIP 文件');
        return;
      }
    } else {
      const readers = files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ src: reader.result, fileName: file.name });
            reader.readAsDataURL(file);
          })
      );
      results = await Promise.all(readers);
    }
    setMeta((prev) => {
      const variants = prev.propVariants || [];
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
      return { ...prev, propVariants: nextVariants };
    });
  };

  const handlePropVariantExport = (variant) => {
    const payload = {
      id: variant.id,
      name: variant.name,
      imageRequirements: variant.imageRequirements || [],
      images: variant.images || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'prop'}-${variant.name || 'variant'}.json`;
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
                          type="number"
                          min={0}
                          max={100}
                          value={item.weight || 0}
                          onChange={(e) => {
                            const next = [...draftReferences];
                            next[idx].weight = Number(e.target.value || 0);
                            setDraftReferences(next);
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
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
                  {sortedSceneVariants.map((variant, variantIndex) => {
                    const titleParts = [
                      variant.name || resource.name || '场景',
                      variant.season,
                      variant.weather,
                      variant.time
                    ].filter(Boolean);
                    const images = variant.images || [];
                    const displayCards = getSceneVariantRequirements(variant);
                    const variantMissing = hasSceneVariantMissing(variant);
                    const variantKey = variant.id || `${variant.name || 'variant'}-${variantIndex}`;
                    return (
                      <div key={variantKey} className={`card section-card ${variantMissing ? 'variant-missing' : ''}`}>
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
                            const refKey = `${variant.id}-${label}`;
                            return (
                              <div key={`${variant.id}-${label}`} className="scene-variant-card">
                                <button
                                  type="button"
                                  className="scene-variant-preview"
                                  onClick={() => {
                                    if (image?.src) {
                                      openPreview(image.src, label);
                                    } else {
                                      sceneInputRefs.current[refKey]?.click();
                                    }
                                  }}
                                >
                                  {image?.src ? <img src={image.src} alt={label} /> : <div className="placeholder">暂无图片</div>}
                                </button>
                                <div className="scene-variant-meta">
                                  <span>{label}</span>
                                  <label className="file-button">
                                    上传
                                    <input
                                      type="file"
                                      accept="image/*"
                                      ref={(el) => {
                                        sceneInputRefs.current[refKey] = el;
                                      }}
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
                              accept="image/*,.zip,application/zip,application/x-zip-compressed"
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
                  </div>
                  <div className="expression-transfer-grid">
                    {expressionTransferRequests.length === 0 && (
                      <div className="empty">暂无生图包需求卡片。</div>
                    )}
                    {expressionTransferRequests.map((item) => (
                      <div key={item.id} className="expression-transfer-card">
                        {(() => {
                          const previewSrc = item.image || item.cover || '';
                          return (
                            <>
                        <button
                          type="button"
                          className="expression-transfer-preview"
                          onClick={() => {
                            if (previewSrc) {
                              openPreview(previewSrc, item.name || '表情需求');
                            } else {
                              expressionTransferRefs.current[item.id]?.click();
                            }
                          }}
                        >
                          {previewSrc ? (
                            <img src={previewSrc} alt={item.name || '生图包'} />
                          ) : (
                            <div className="expression-transfer-placeholder">待生成</div>
                          )}
                          {!previewSrc && <span className="status-dot" />}
                        </button>
                        <div className="expression-transfer-title">{item.name || '颜艺生图包'}</div>
                        <div className="expression-transfer-meta">{item.character || '未指定角色'}</div>
                        <div className="row">
                          <label className="file-button">
                            上传
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                expressionTransferRefs.current[item.id] = el;
                              }}
                              onChange={handleExpressionTransferUpload(item.id)}
                            />
                          </label>
                          <button type="button" onClick={() => handleExpressionTransferDownload(item)} disabled={!previewSrc}>
                            下载
                          </button>
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="muted">当前状态：{expressionStatus}</div>
            </div>
          )}
          {type === 'props' && (
            <div className="stack">
              <div className="card section-card">
                <div className="section-header">
                  <h3>道具描述</h3>
                </div>
                <textarea
                  className="large-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="补充道具外观、材质、用途等"
                />
              </div>
              <div className="card section-card">
                <div className="section-header">
                  <h3>图片管理</h3>
                </div>
                {propVariants.length === 0 && <div className="empty">暂无需求，请等待分镜头AI回传。</div>}
                {propVariants.map((variant) => {
                  const displayCards = getPropVariantRequirements(variant);
                  const images = variant.images || [];
                  return (
                    <div key={variant.id} className="stack">
                      <div className="section-header">
                        <h4>{variant.name || resource.name || '道具'}</h4>
                      </div>
                      <label>
                        持有人
                        <input
                          value={variant.ownerName || ''}
                          onChange={(event) =>
                            setMeta((prev) => ({
                              ...prev,
                              propVariants: (prev.propVariants || []).map((item) =>
                                item.id === variant.id ? { ...item, ownerName: event.target.value } : item
                              )
                            }))
                          }
                          placeholder="例如：主角A"
                        />
                      </label>
                      <div className="scene-variant-grid compact-grid">
                        {displayCards.length === 0 && <div className="empty">暂无图片需求。</div>}
                        {displayCards.map((label) => {
                          const image = images.find((img) => img.label === label);
                          const refKey = `${variant.id}-${label}-prop`;
                          return (
                            <div key={refKey} className="scene-variant-card compact-card">
                              <button
                                type="button"
                                className="scene-variant-preview"
                                onClick={() => {
                                  if (image?.src) {
                                    openPreview(image.src, label);
                                  } else {
                                    sceneInputRefs.current[refKey]?.click();
                                  }
                                }}
                              >
                                {image?.src ? (
                                  <img src={image.src} alt={label} />
                                ) : (
                                  <div className="placeholder">暂无图片</div>
                                )}
                              </button>
                              <div className="scene-variant-meta">
                                <span>{label}</span>
                                <label className="file-button">
                                  上传
                                  <input
                                    type="file"
                                    accept="image/*"
                                    ref={(el) => {
                                      sceneInputRefs.current[refKey] = el;
                                    }}
                                    onChange={handlePropVariantImageUpload(variant.id, label)}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="row align-right">
                        <button type="button" onClick={() => handlePropVariantExport(variant)}>
                          下载
                        </button>
                        <label className="file-button">
                          上传
                          <input
                            type="file"
                            accept="image/*,.zip,application/zip,application/x-zip-compressed"
                            multiple
                            onChange={handlePropVariantBatchUpload(variant.id, displayCards)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {type !== 'characters' && type !== 'scenes' && type !== 'expressions' && type !== 'props' && (
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
                    <button
                      type="button"
                      className="cover checkerboard"
                      onClick={() => openPreview(imageSrc, resource.name)}
                    >
                      <img src={imageSrc} alt={`res-${idx}`} />
                    </button>
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
