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

  // 补全缺失的工具函数
  const createAssetId = () => {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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

  const resolveFormReferences = () => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      return activeForm.references || [];
    }
    return meta.references || [];
  };

  const updateFormReferences = (newReferences) => {
    const activeForm = forms.find((form) => form.name === activeFormName);
    if (forms.length > 1 && activeForm) {
      setForms((prev) =>
        prev.map((form) =>
          form.name === activeFormName
            ? { ...form, references: newReferences, updatedAt: Date.now() }
            : form
        )
      );
    } else {
      setMeta((prev) => ({ ...prev, references: newReferences }));
    }
  };

  const getExpressionAssets = () => {
    return meta.expressionAssets || [];
  };

  const getExpressionRules = () => {
    return (meta.expressionRules || []).sort((a, b) => (b.version || 0) - (a.version || 0));
  };

  const getExpressionStatus = () => {
    return meta.expressionStatus || 'draft';
  };

  // 补全场景导入函数（原代码截断的部分）
  const handleSceneImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
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
              character: 'string，角色名称。',
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
  
  // 成长史数据（修复导出时的变量缺失）
  const growthHistory = meta.characterGrowthHistory || [];

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

  // 保留一个整合版的成长史导入函数（修复重复定义）
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
      // 兼容数组/对象两种格式
      const entries = Array.isArray(parsed) 
        ? parsed 
        : parsed.entries || parsed.characterGrowthHistory?.entries || parsed.characterGrowthHistory || [];
      setMeta((prev) => ({ ...prev, characterGrowthHistory: entries }));
    } catch (e) {
      alert('成长史 JSON 解析失败');
    }
  };

  // 保留一个修复后的成长史导出函数（修复变量缺失）
  const handleGrowthHistoryExport = () => {
    const payload = {
      character: {
        id: resource?.id || '',
        name: resource?.name || 'unknown-character'
      },
      characterGrowthHistory: growthHistory
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource?.name || 'character'}-growth-history.json`;
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

  // 补全截断的批量上传函数
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
        // 补全批量上传的逻辑：按需求匹配文件名/标签
        const images = variant.images || [];
        const newImages = results.map((item) => {
          // 从文件名提取标签（可根据实际规则调整）
          const labelMatch = item.fileName.match(/-(.+?)\./);
          const label = labelMatch ? labelMatch[1] : requirements.find((r) => r) || 'unknown';
          return {
            id: createAssetId(),
            label,
            src: item.src,
            fileName: item.fileName,
            uploadedAt: new Date().toISOString()
          };
        });
        return {
          ...variant,
          images: [...images, ...newImages]
        };
      });
      return { ...prev, sceneVariants: nextVariants };
    });
  };

  // 组件必须返回 JSX（补全基础结构，你可根据实际UI调整）
  return (
    <div className="resource-detail-container">
      <div className="resource-detail-header">
        <button onClick={() => navigate(-1)}>返回</button>
        <h1>{typeLabels[type]}详情：{name}</h1>
      </div>
      
      {/* 基础信息区域 */}
      <div className="resource-base-info">
        <div className="form-group">
          <label>名称</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="输入资源名称"
          />
        </div>
        <div className="form-group">
          <label>描述</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="输入资源描述"
          />
        </div>
        <div className="form-group">
          <label>标签</label>
          <input 
            type="text" 
            value={tags} 
            onChange={(e) => setTags(e.target.value)} 
            placeholder="多个标签用逗号分隔"
          />
        </div>
        <div className="form-group">
          <label>别名</label>
          <input 
            type="text" 
            value={aliases} 
            onChange={(e) => setAliases(e.target.value)} 
            placeholder="多个别名用逗号分隔"
          />
        </div>
        <div className="form-group">
          <label>置顶优先级</label>
          <input 
            type="checkbox" 
            checked={priorityPin} 
            onChange={(e) => setPriorityPin(e.target.checked)} 
          />
        </div>
      </div>

      {/* 不同类型资源的专属区域（你可根据实际需求扩展） */}
      {type === 'characters' && (
        <div className="character-specific">
          <h3>角色专属配置</h3>
          <button onClick={() => handleGrowthHistoryImport({ target: { files: [] } })}>导入成长史</button>
          <button onClick={handleGrowthHistoryExport}>导出成长史</button>
        </div>
      )}

      {type === 'scenes' && (
        <div className="scene-specific">
          <h3>场景专属配置</h3>
          <button onClick={() => handleSceneImport({ target: { files: [] } })}>导入场景规则包</button>
        </div>
      )}

      {type === 'expressions' && (
        <div className="expression-specific">
          <h3>表情专属配置</h3>
          <div className="tabs">
            {expressionTabs.map((tab) => (
              <button 
                key={tab.key}
                onClick={() => setExpressionTab(tab.key)}
                className={expressionTab === tab.key ? 'active' : ''}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <textarea 
            value={expressionRuleText} 
            onChange={(e) => setExpressionRuleText(e.target.value)}
            placeholder="输入表情生成规则"
          />
        </div>
      )}

      {/* 保存按钮 */}
      <button 
        onClick={() => {
          // 保存资源逻辑（你可根据实际需求完善）
          upsertResource(type, {
            id: resourceId,
            name,
            description,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            aliases: aliases.split(',').map(t => t.trim()).filter(Boolean),
            priorityPin,
            meta,
            form: forms,
            action: actions,
            assets: assets,
            updatedAt: Date.now()
          });
          alert('保存成功');
        }}
      >
        保存资源
      </button>
    </div>
  );
};

export default ResourceDetail;