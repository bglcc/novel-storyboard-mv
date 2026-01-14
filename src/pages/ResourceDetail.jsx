import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';

const typeLabels = {
  characters: '角色',
  expressions: '表情',
  scenes: '场景',
  props: '道具',
  animations: '动画',
  music: '背景音乐',
  voiceovers: '角色配音'
};

const sceneToolItems = [
  { key: 'character', label: '添加角色' },
  { key: 'background', label: '添加背景' },
  { key: 'prop', label: '添加道具' },
  { key: 'move', label: '调整元素位置' }
];

const expressionTabs = [
  { key: 'base', label: '基础信息' },
  { key: 'assets', label: '参考图 & 素材' },
  { key: 'rules', label: '生图规则' },
  { key: 'storyboard', label: '分镜推荐用法' },
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

const usageOptions = [
  { value: 'source_frame', label: 'source_frame' },
  { value: 'style_ref', label: 'style_ref' },
  { value: 'facial_ref', label: 'facial_ref' },
  { value: 'eye_ref', label: 'eye_ref' },
  { value: 'mouth_ref', label: 'mouth_ref' }
];

const ResourceDetail = () => {
  const { type, resourceId } = useParams();
  const navigate = useNavigate();
  const { data, updateResourceImages, upsertResource } = useData();
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
  const [ruleJsonText, setRuleJsonText] = useState('{}');
  const [ruleText, setRuleText] = useState({ prompt: '', negative: '', constraints: '', params: '' });

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
      if (type === 'expressions') {
        const rules = (resource.meta?.expressionRules || []).slice().sort((a, b) => (b.version || 0) - (a.version || 0));
        if (rules[0]) {
          setRuleJsonText(JSON.stringify(rules[0].ruleJson || {}, null, 2));
          setRuleText({
            prompt: rules[0].promptTemplate || '',
            negative: rules[0].negativePrompt || '',
            constraints: rules[0].constraints || '',
            params: rules[0].recommendedParamsText || ''
          });
        } else {
          setRuleJsonText('{}');
          setRuleText({ prompt: '', negative: '', constraints: '', params: '' });
        }
        setExpressionTab('base');
      }
    }
  }, [resourceId, resource]);

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

  const resolveHeroImage = () => {
    if (type === 'characters') {
      const sorted = assets
        .slice()
        .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
      return sorted[0]?.src || meta.viewImages?.front || resource.images?.[0];
    }
    if (type === 'scenes') {
      return meta.sceneImages?.panorama || resource.images?.[0];
    }
    if (type === 'expressions') {
      return resource.images?.[0];
    }
    return null;
  };

  const getDownloadLabel = () => {
    if (type === 'characters') return '导出角色资源包';
    if (type === 'scenes') return '导出场景配置';
    if (type === 'expressions') return '下载表情规则库';
    return '下载资源';
  };

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
      alert('解压失败，请检查 zip 文件');
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
      setName(manifest.name || '');
      setDescription(manifest.description || '');
      setTags((manifest.tags || []).join(', '));
      setAliases((manifest.aliases || []).join(', '));
      setPriorityPin(Boolean(manifest.priorityPin));
      setMeta(manifest.meta || {});
      setAssets(importedAssets);
      setForms((manifest.form || []).map((form) => ({ ...form })));
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
      meta,
      assets: manifestAssets,
      form: forms,
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

  const handleSceneExport = () => {
    const payload = {
      id: resource.id,
      type: 'scenes',
      name,
      description,
      tags: normalizeTags(),
      meta
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'scene'}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
    const hasRule = rules.length > 0 && (rules[0].promptTemplate || '').trim();
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

  const handleExpressionRuleSave = () => {
    let parsedRule = {};
    try {
      parsedRule = JSON.parse(ruleJsonText || '{}');
    } catch (e) {
      alert('规则 JSON 格式不正确');
      return;
    }
    const rules = getExpressionRules();
    const nextVersion = (rules[0]?.version || 0) + 1;
    const nextRule = {
      id: createExpressionAssetId(),
      strategy: meta.strategy || '',
      promptTemplate: ruleText.prompt,
      negativePrompt: ruleText.negative,
      constraints: ruleText.constraints,
      recommendedParamsText: ruleText.params,
      ruleJson: parsedRule,
      version: nextVersion,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setMeta((prev) => ({
      ...prev,
      expressionRules: [nextRule, ...(prev.expressionRules || [])]
    }));
  };

  const handleExpressionRuleDelete = (ruleId) => {
    setMeta((prev) => ({
      ...prev,
      expressionRules: (prev.expressionRules || []).filter((rule) => rule.id !== ruleId)
    }));
  };

  const handleExpressionExportZip = async () => {
    setLoading(true);
    const assetsList = getExpressionAssets();
    const rules = getExpressionRules();
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
      assets: metaAssets,
      rules: rules.map((rule) => ({
        version: rule.version,
        strategy: rule.strategy,
        files: [`rule_v${rule.version}.json`, `rule_v${rule.version}.txt`]
      }))
    };
    folder.file('meta.json', JSON.stringify(metaPayload, null, 2));
    rules.forEach((rule) => {
      rulesFolder.file(`rule_v${rule.version}.json`, JSON.stringify(rule.ruleJson || {}, null, 2));
      rulesFolder.file(
        `rule_v${rule.version}.txt`,
        [rule.promptTemplate || '', '\n\n', rule.negativePrompt || '', '\n\n', rule.constraints || ''].join('')
      );
    });
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
        expressionAssets: nextAssets,
        expressionRules: nextRules
      }));
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
    return {
      ...resource,
      type,
      name,
      aliases: normalizeAliases(),
      status: type === 'characters' ? getCharacterStatus() : expressionStatus,
      priorityPin,
      description,
      tags: normalizeTags(),
      meta,
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

  const expressionHistory = (meta.expressionHistory || []).filter((item) => {
    if (!historyQuery.trim()) return true;
    return `${item.character || ''}${item.name || ''}`.toLowerCase().includes(historyQuery.toLowerCase());
  });
  const expressionAssets = getExpressionAssets();
  const expressionRules = getExpressionRules();
  const mainExpressionAsset = expressionAssets.find((asset) => asset.type === 'main');
  const expressionStatus = getExpressionStatus();

  const heroImage = resolveHeroImage();
  const expressionGrouping = meta.expressionGrouping || 'group';
  const sceneSettings = meta.sceneSettings || {};
  const sceneImages = meta.sceneImages || {};
  const sceneResources = meta.sceneResources || {};
  const sceneLayout = meta.sceneLayout || { elements: [] };

  return (
    <div className="card">
      <div className="space-between">
        <h2>
          资源详情 - {typeLabels[type]} {resource.name}
        </h2>
        <button
          onClick={type === 'characters' ? handleCharacterExport : type === 'scenes' ? handleSceneExport : handleDownload}
        >
          {getDownloadLabel()}
        </button>
      </div>
      {heroImage && (
        <div className="resource-hero">
          <img src={heroImage} alt="资源主图" />
          {type === 'scenes' && (
            <div className="resource-hero-actions">
              <button type="button" onClick={() => alert('即将支持场景快速编辑功能')}>
                保存并进入编辑
              </button>
            </div>
          )}
        </div>
      )}
      <div className="row">
        <label>
          名称
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          描述
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      {type === 'characters' && (
        <div className="stack">
          <div className="row">
            <label>
              别名（逗号分隔）
              <input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="如：阿晨, 主角"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={priorityPin}
                onChange={(e) => setPriorityPin(e.target.checked)}
              />
              置顶角色
            </label>
            <div className="status-chip">当前状态：{getCharacterStatus()}</div>
          </div>
          <div className="row">
            <label>
              人设
              <input
                value={meta.persona || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, persona: e.target.value }))}
                placeholder="角色人设设定"
              />
            </label>
            <label>
              外貌描述
              <input
                value={meta.appearance || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, appearance: e.target.value }))}
                placeholder="外貌特征"
              />
            </label>
            <label>
              参考人物
              <input
                value={meta.reference || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="参考人设或演员"
              />
            </label>
          </div>
          <div className="row">
            <label>
              人际关系
              <input
                value={meta.relationships || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, relationships: e.target.value }))}
                placeholder="如：与女主为师徒"
              />
            </label>
            <label>
              表情解锁规则
              <input
                value={meta.expressionUnlock || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, expressionUnlock: e.target.value }))}
                placeholder="高冷角色初期仅解锁冷淡、凝重"
              />
            </label>
          </div>
          <div className="row">
            <label className="file-button">
              导入角色资源包
              <input type="file" accept="application/zip" onChange={handleCharacterImport} />
            </label>
            <span className="muted">导入后会覆盖当前角色档案与资源。</span>
          </div>
          <div className="card subtle">
            <div className="space-between">
              <h3>角色形态资源</h3>
              <div className="row">
                <input
                  value={newFormName}
                  onChange={(e) => setNewFormName(e.target.value)}
                  placeholder="新增形态名称"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFormName.trim()) return;
                    setForms((prev) => [
                      ...prev,
                      { name: newFormName.trim(), createdAt: Date.now(), assets: [] }
                    ]);
                    setNewFormName('');
                  }}
                >
                  添加形态
                </button>
              </div>
            </div>
            {forms.length === 0 && <div className="empty">暂无形态，请先添加形态。</div>}
            <div className="asset-sections">
              {forms.map((form) => {
                const formAssets = assets.filter((asset) => asset.role === 'form' && asset.ownerName === form.name);
                return (
                  <div key={form.name} className="asset-section">
                    <div className="space-between">
                      <div>
                        <h4>{form.name}</h4>
                        <div className="muted">已上传 {formAssets.length} 项</div>
                      </div>
                      <label className="file-button">
                        上传形态资源
                        <input type="file" accept="image/*" multiple onChange={handleFormUpload(form.name)} />
                      </label>
                    </div>
                    <div className="asset-grid">
                      {formAssets.map((asset) => (
                        <div key={asset.id} className="asset-card">
                          <img src={asset.src} alt={asset.fileName || form.name} />
                          <div className="asset-meta">
                            <div>版本 v{asset.version}</div>
                            <div className="muted">{new Date(asset.uploadedAt).toLocaleString()}</div>
                          </div>
                          <button type="button" className="danger" onClick={() => handleDeleteAsset(asset.id)}>
                            删除
                          </button>
                        </div>
                      ))}
                      {formAssets.length === 0 && <div className="empty">暂无资源，请上传图片。</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card subtle">
            <div className="space-between">
              <h3>角色动作资源</h3>
              <div className="row">
                <input
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  placeholder="新增动作名称"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newActionName.trim()) return;
                    setActions((prev) => [
                      ...prev,
                      { name: newActionName.trim(), createdAt: Date.now(), assets: [] }
                    ]);
                    setNewActionName('');
                  }}
                >
                  添加动作
                </button>
              </div>
            </div>
            {actions.length === 0 && <div className="empty">暂无动作，请先添加动作。</div>}
            <div className="asset-sections">
              {actions.map((action) => {
                const actionAssets = assets.filter(
                  (asset) => asset.role === 'action' && asset.ownerName === action.name
                );
                return (
                  <div key={action.name} className="asset-section">
                    <div className="space-between">
                      <div>
                        <h4>{action.name}</h4>
                        <div className="muted">已上传 {actionAssets.length} 项</div>
                      </div>
                      <label className="file-button">
                        上传动作资源
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleActionUpload(action.name)}
                        />
                      </label>
                    </div>
                    <div className="asset-grid">
                      {actionAssets.map((asset) => (
                        <div key={asset.id} className="asset-card">
                          <img src={asset.src} alt={asset.fileName || action.name} />
                          <div className="asset-meta">
                            <div>版本 v{asset.version}</div>
                            <div className="muted">{new Date(asset.uploadedAt).toLocaleString()}</div>
                          </div>
                          <button type="button" className="danger" onClick={() => handleDeleteAsset(asset.id)}>
                            删除
                          </button>
                        </div>
                      ))}
                      {actionAssets.length === 0 && <div className="empty">暂无资源，请上传图片。</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {type === 'scenes' && (
        <div className="stack">
          <div className="card subtle">
            <h3>场景编辑器</h3>
            <div className="scene-editor">
              <div className="scene-toolbar">
                {sceneToolItems.map((tool) => (
                  <button key={tool.key} type="button" onClick={() => handleAddSceneElement(tool.key)}>
                    {tool.label}
                  </button>
                ))}
                <input
                  value={newSceneElement}
                  onChange={(e) => setNewSceneElement(e.target.value)}
                  placeholder="元素名称（如：木桌）"
                />
                <div className="muted">输入名称后点击工具按钮添加元素。</div>
              </div>
              <div className="scene-preview">
                <div className="scene-preview-header">实时预览</div>
                <div className="scene-canvas">
                  {sceneLayout.elements.length === 0 && (
                    <div className="empty">暂无元素，可从左侧工具栏添加。</div>
                  )}
                  {sceneLayout.elements.map((element) => (
                    <div key={element.id} className="scene-element">
                      {element.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="scene-settings">
              <div className="row">
                <label>
                  时间
                  <select
                    value={sceneSettings.time || ''}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        sceneSettings: { ...sceneSettings, time: e.target.value }
                      }))
                    }
                  >
                    <option value="">选择时间</option>
                    <option value="day">白天</option>
                    <option value="dusk">黄昏</option>
                    <option value="night">夜晚</option>
                  </select>
                </label>
                <label>
                  天气
                  <select
                    value={sceneSettings.weather || ''}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        sceneSettings: { ...sceneSettings, weather: e.target.value }
                      }))
                    }
                  >
                    <option value="">选择天气</option>
                    <option value="sunny">晴天</option>
                    <option value="rainy">雨天</option>
                    <option value="snowy">雪天</option>
                  </select>
                </label>
                <label>
                  季节
                  <select
                    value={sceneSettings.season || ''}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        sceneSettings: { ...sceneSettings, season: e.target.value }
                      }))
                    }
                  >
                    <option value="">选择季节</option>
                    <option value="spring">春天</option>
                    <option value="summer">夏天</option>
                    <option value="autumn">秋天</option>
                    <option value="winter">冬天</option>
                  </select>
                </label>
                <label>
                  风格
                  <select
                    value={sceneSettings.style || ''}
                    onChange={(e) =>
                      setMeta((prev) => ({
                        ...prev,
                        sceneSettings: { ...sceneSettings, style: e.target.value }
                      }))
                    }
                  >
                    <option value="">选择风格</option>
                    <option value="simple">简陋</option>
                    <option value="luxury">豪华</option>
                    <option value="retro">复古</option>
                  </select>
                </label>
              </div>
              <div className="row">
                <button type="button" onClick={() => handleSceneGenerate('panorama')}>
                  全景图生成
                </button>
                <button type="button" onClick={() => handleSceneGenerate('partials')}>
                  局部图生图
                </button>
                <button type="button" onClick={handleSceneExport}>
                  保存与导出
                </button>
              </div>
              <div className="muted">
                最近生成：{meta.sceneGeneration?.panorama || '未生成'} / {meta.sceneGeneration?.partials || '未生成'}
              </div>
            </div>
          </div>
          <div className="card subtle">
            <h3>场景基本信息</h3>
            <div className="row">
              <label>
                场景名称
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                场景描述
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="card subtle">
            <h3>场景资源管理</h3>
            <div className="scene-resource-grid">
              <div className="scene-resource-card">
                <div className="scene-resource-title">全景图</div>
                {sceneImages.panorama ? (
                  <img src={sceneImages.panorama} alt="全景图" />
                ) : (
                  <div className="placeholder">暂无全景图</div>
                )}
                <label className="file-button">
                  上传/替换
                  <input type="file" accept="image/*" onChange={handleSceneImageUpload('panorama')} />
                </label>
              </div>
              <div className="scene-resource-card">
                <div className="scene-resource-title">局部图</div>
                <div className="scene-thumb-grid">
                  {(sceneImages.partials || []).map((img, idx) => (
                    <img key={idx} src={img} alt={`局部图-${idx + 1}`} />
                  ))}
                  {(sceneImages.partials || []).length === 0 && <div className="empty">暂无局部图</div>}
                </div>
                <label className="file-button">
                  添加局部图
                  <input type="file" accept="image/*" onChange={handleSceneImageUpload('partials')} />
                </label>
              </div>
              <div className="scene-resource-card">
                <div className="scene-resource-title">分镜头场景图</div>
                <div className="scene-thumb-grid">
                  {(sceneImages.storyboardShots || []).map((img, idx) => (
                    <img key={idx} src={img} alt={`分镜头-${idx + 1}`} />
                  ))}
                  {(sceneImages.storyboardShots || []).length === 0 && <div className="empty">暂无分镜头图</div>}
                </div>
                <label className="file-button">
                  添加分镜头图
                  <input type="file" accept="image/*" onChange={handleSceneImageUpload('storyboardShots')} />
                </label>
              </div>
            </div>
            <div className="scene-assets">
              {['背景', '道具', '角色', '光照'].map((label) => {
                const key = label.toLowerCase();
                const items = sceneResources[key] || [];
                return (
                  <div key={label} className="scene-asset-list">
                    <div className="space-between">
                      <h4>{label}资源</h4>
                      <label className="file-button">
                        上传{label}
                        <input type="file" accept="image/*" onChange={handleSceneResourceUpload(key)} />
                      </label>
                    </div>
                    <div className="scene-thumb-grid">
                      {items.map((item) => (
                        <img key={item.id} src={item.src} alt={item.name} />
                      ))}
                      {items.length === 0 && <div className="empty">暂无资源</div>}
                    </div>
                  </div>
                );
              })}
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
              </button>
            ))}
          </div>
          {expressionTab === 'base' && (
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
              <div className="row align-right">
                <div className="status-chip">当前状态：{expressionStatus}</div>
                <button type="button" onClick={handleUpdateMeta}>
                  更新表情信息
                </button>
              </div>
            </div>
          )}
          {expressionTab === 'assets' && (
            <div className="stack">
              <div className="card subtle">
                <h3>主参考图</h3>
                {mainExpressionAsset?.src ? (
                  <img src={mainExpressionAsset.src} alt="主参考" className="preview" />
                ) : (
                  <div className="placeholder">请上传主参考图</div>
                )}
                <label className="file-button">
                  上传主图
                  <input type="file" accept="image/*" onChange={handleExpressionAssetUpload('main')} />
                </label>
              </div>
              <div className="card subtle">
                <h3>辅助参考图</h3>
                <div className="asset-grid">
                  {expressionAssets
                    .filter((asset) => asset.type === 'aux')
                    .map((asset) => (
                      <div key={asset.id} className="asset-card">
                        <img src={asset.src} alt={asset.fileName || asset.id} />
                        <label>
                          用途
                          <select
                            value={asset.usage || 'source_frame'}
                            onChange={(e) => handleExpressionAssetUpdate(asset.id, { usage: e.target.value })}
                          >
                            {usageOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          备注
                          <input
                            value={asset.note || ''}
                            onChange={(e) => handleExpressionAssetUpdate(asset.id, { note: e.target.value })}
                          />
                        </label>
                        <div className="row">
                          <button type="button" onClick={() => handleExpressionAssetMove(asset.id, 'up')}>
                            上移
                          </button>
                          <button type="button" onClick={() => handleExpressionAssetMove(asset.id, 'down')}>
                            下移
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleExpressionAssetDelete(asset.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  {expressionAssets.filter((asset) => asset.type === 'aux').length === 0 && (
                    <div className="empty">暂无辅助参考图。</div>
                  )}
                </div>
                <label className="file-button">
                  添加辅助图
                  <input type="file" accept="image/*" onChange={handleExpressionAssetUpload('aux')} />
                </label>
              </div>
            </div>
          )}
          {expressionTab === 'rules' && (
            <div className="stack">
              <label>
                正向提示词模板
                <textarea
                  value={ruleText.prompt}
                  onChange={(e) => setRuleText({ ...ruleText, prompt: e.target.value })}
                  className="large-input"
                />
              </label>
              <label>
                负向提示词
                <textarea
                  value={ruleText.negative}
                  onChange={(e) => setRuleText({ ...ruleText, negative: e.target.value })}
                  className="large-input"
                />
              </label>
              <label>
                关键约束
                <textarea
                  value={ruleText.constraints}
                  onChange={(e) => setRuleText({ ...ruleText, constraints: e.target.value })}
                  className="large-input"
                />
              </label>
              <label>
                建议参数
                <textarea
                  value={ruleText.params}
                  onChange={(e) => setRuleText({ ...ruleText, params: e.target.value })}
                  className="large-input"
                />
              </label>
              <label>
                结构化规则 JSON
                <textarea
                  value={ruleJsonText}
                  onChange={(e) => setRuleJsonText(e.target.value)}
                  className="large-input"
                />
              </label>
              <button type="button" onClick={handleExpressionRuleSave}>
                保存规则版本
              </button>
              <div className="list">
                {expressionRules.map((rule) => (
                  <div key={rule.id} className="list-item">
                    <div>
                      <div className="list-title">版本 v{rule.version}</div>
                      <div className="muted">策略：{rule.strategy || '未设置'}</div>
                    </div>
                    <button type="button" className="danger" onClick={() => handleExpressionRuleDelete(rule.id)}>
                      删除
                    </button>
                  </div>
                ))}
                {expressionRules.length === 0 && <div className="empty">暂无规则记录。</div>}
              </div>
            </div>
          )}
          {expressionTab === 'storyboard' && (
            <div className="card subtle">
              <h3>分镜头引用模板</h3>
              <textarea
                className="large-input"
                readOnly
                value={`使用场景：${description || ''}\n镜头建议：${(meta.shotRecommendation || []).join(' / ') || '特写'}\n用词建议：眼睛爆裂、牙关紧咬、额头青筋\n组合建议：可搭配汗滴/阴影遮眼特效，但不要叠加另一种颜艺`}
              />
              <button type="button" onClick={() => navigator.clipboard.writeText(resource.id)}>
                复制模板
              </button>
            </div>
          )}
          {expressionTab === 'transfer' && (
            <div className="stack">
              <button type="button" onClick={handleExpressionExportZip} disabled={loading}>
                导出单个表情 ZIP
              </button>
              <label className="file-button">
                导入表情 ZIP
                <input type="file" accept="application/zip" onChange={handleExpressionImportZip} />
              </label>
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
      <label>
        标签（逗号分隔）
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="角色, 主角" />
      </label>
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
          {(resource.images || []).map((img, idx) => (
            <div key={idx} className="item-card">
              <img src={img} alt={`res-${idx}`} className="cover checkerboard" />
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
          ))}
          {(resource.images || []).length === 0 && <div className="empty">暂无图片，上传 zip 或补充图片。</div>}
        </div>
      )}
      <div className="row align-right">
        <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
      </div>
    </div>
  );
};

export default ResourceDetail;
