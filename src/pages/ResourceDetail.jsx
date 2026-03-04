import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';
import {
  expressionTabs,
  riskOptions,
  scopeOptions,
  strategyOptions,
  typeLabels
} from './resourceDetail/constants';
import { ensureResourceRule } from './resourceDetail/ruleTemplates';
import { downloadJson, loadZip, readFileAsDataUrl, readFilesAsDataUrlEntries } from './resourceDetail/fileUtils';
import {
  exportGrowthHistory,
  exportRelationshipGraph,
  exportSceneRule,
  importGrowthHistory,
  importRelationshipGraph,
  importSceneRule
} from './resourceDetail/jsonHandlers';
import { buildAssetEntries, mergeImagesFromFiles, mergeImagesFromZip } from './resourceDetail/uploadHandlers';
import {
  getRelationByTarget,
  getSceneVariantRequirements,
  hasSceneVariantMissing,
  sortSceneVariantsByMissing
} from './resourceDetail/relationUtils';
import CharacterBaseSection from './resourceDetail/CharacterBaseSection';
import CharacterGrowthSection from './resourceDetail/CharacterGrowthSection';
import CharacterEditModalSection from './resourceDetail/CharacterEditModalSection';
import CharacterPreviewFooterSection from './resourceDetail/CharacterPreviewFooterSection';
import CharacterAppearanceSection from './resourceDetail/CharacterAppearanceSection';
import CharacterRelationsSection from './resourceDetail/CharacterRelationsSection';
import SceneSection from './resourceDetail/SceneSection';
import SceneEditModalSection from './resourceDetail/SceneEditModalSection';
import ExpressionSection from './resourceDetail/ExpressionSection';
import PropSection from './resourceDetail/PropSection';
import NonCharacterHeaderSection from './resourceDetail/NonCharacterHeaderSection';
import NonCharacterFooterMetaSection from './resourceDetail/NonCharacterFooterMetaSection';
import '../styles/resource-enhancements.css';

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
    ensureResourceRule({ type, rules: data.rules, upsertRule });
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
    const nextAssets = await buildAssetEntries({
      files,
      assets,
      role,
      ownerName,
      createAssetId
    });
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
    const merged = await mergeImagesFromFiles({
      files,
      currentImages: resource.images || []
    });
    updateResourceImages(type, resourceId, merged);
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const merged = await mergeImagesFromZip({
        file,
        currentImages: resource.images || []
      });
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
      const zip = await loadZip(file);
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
      const zip = await loadZip(file);
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
      alert('导入失败请检查 ZIP 文件');
    } finally {
      setLoading(false);
    }
  };

  const buildUpdatedResource = () => {
    const expressionAssets = getExpressionAssets();
    const expressionStatus = type === 'expressions' ? getExpressionStatus() : resource.status;
    const characterStatus = type === 'characters' ? getCharacterStatus() : resource.status;
    const expressionImages = type === 'expressions' ? syncExpressionImages(expressionAssets) : resource.images || [];
    const updatedMeta = type === 'expressions' ? { ...meta, expressionRuleText } : meta;
    const sceneHasImages =
      type === 'scenes'
        ? (meta.sceneVariants || []).some((variant) => (variant.images || []).length > 0) ||
          (resource.images || []).length > 0
        : false;
    const propHasImages =
      type === 'props'
        ? (meta.propVariants || []).some((variant) => (variant.images || []).length > 0) ||
          (resource.images || []).length > 0
        : false;
    const nextStatus =
      type === 'characters'
        ? characterStatus
        : type === 'expressions'
          ? expressionStatus
          : type === 'scenes'
            ? sceneHasImages
              ? '已完成'
              : '待补齐'
            : type === 'props'
              ? propHasImages
                ? '已完成'
                : '待补齐'
              : resource.status;
    const nextAvailable =
      type === 'characters'
        ? characterStatus === '已完成'
        : type === 'expressions'
        ? expressionStatus === '已完成'
        : type === 'scenes'
          ? sceneHasImages
          : type === 'props'
            ? propHasImages
            : resource.isAvailable;
    return {
      ...resource,
      type,
      name,
      aliases: normalizeAliases(),
      status: nextStatus,
      priorityPin,
      description,
      tags: normalizeTags(),
      meta: updatedMeta,
      assets,
      form: forms,
      action: actions,
      images: type === 'expressions' ? expressionImages : resource.images || [],
      isAvailable: nextAvailable,
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
    downloadJson(`${resource.name || 'resource'}.json`, payload);
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
    const src = await readFileAsDataUrl(file);
    const { assets: currentAssets } = resolveFormViews();
    const filtered = currentAssets.filter((asset) => asset.viewAngle !== viewAngle);
    updateFormViews([
      ...filtered,
      {
        id: createAssetId(),
        viewAngle,
        fileName: file.name,
        src,
        uploadedAt: new Date().toISOString()
      }
    ]);
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
  const CHARACTER_REQUIRED_VIEWS = ['正面-全身-站立'];
  const CHARACTER_OPTIONAL_VIEWS = ['侧面-全身-站立', '背面-全身-站立', '正面-中景', 'Q版形象'];
  const storyboardViewRequirements = Array.from(new Set((viewRequirements || []).filter(Boolean)));
  const viewList = Array.from(
    new Set([
      ...CHARACTER_REQUIRED_VIEWS,
      ...CHARACTER_OPTIONAL_VIEWS,
      ...storyboardViewRequirements,
      ...viewAssets.map((asset) => asset.viewAngle)
    ])
  );
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
      if (!nodes.find((node) => [node.id, node.name].filter(Boolean).some((v) => String(v).toLowerCase() === key))) {
        nodes.push({ id: rawValue, name: rawValue });
      }
    });
    return { nodes, relations: relatedRelations };
  };

  const handleExpressionTransferUpload = (requestId) => async (event) => {
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

  const openPreview = (src, label = '') => {
    if (!src) return;
    setPreviewImage(src);
    setPreviewLabel(label);
  };

  const closePreview = () => {
    setPreviewImage('');
    setPreviewLabel('');
  };
  const relationGraph = buildCharacterRelationGraph();
  const growthHistory = meta.characterGrowthHistory || [];
  const relationNodes = (() => {
    const nodes = relationGraph.nodes || [];
    const relations = relationGraph.relations || [];
    const collected = nodes.length
      ? nodes
      : Array.from(
          new Set(
            relations.flatMap((rel) => [
              rel.source,
              rel.sourceId,
              rel.from,
              rel.fromId,
              rel.sourceName,
              rel.target,
              rel.targetId,
              rel.to,
              rel.toId,
              rel.targetName
            ])
          )
        )
          .filter(Boolean)
          .map((name) => ({ id: name, name }));
    const seen = new Set();
    return collected.reduce((acc, node) => {
      const key = String(node.id || node.name || '').toLowerCase();
      if (!key || seen.has(key)) return acc;
      seen.add(key);
      acc.push({ ...node, name: node.name || node.id || '' });
      return acc;
    }, []);
  })();
  const relationPositions = relationNodes.map((node, index) => {
    const angle = (index / relationNodes.length) * Math.PI * 2;
    const x = 50 + 38 * Math.cos(angle);
    const y = 50 + 38 * Math.sin(angle);
    return { ...node, position: { x, y }, key: node.id || node.name || `node-${index}` };
  });
  const relationImageMap = new Map(
    relationNodes.map((node) => {
      const match = data.resources.characters.find(
        (character) => character.id === node.id || character.name === node.name
      );
      return [node.id || node.name, resolveReferenceImage(match, match?.form?.[0]?.name || '默认形态')];
    })
  );
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
  const sortedSceneVariants = sortSceneVariantsByMissing(sceneVariants);


  const handleRelationshipImport = async (event) => {
    await importRelationshipGraph({
      file: event.target.files?.[0],
      currentNovel,
      updateNovel,
      setMeta
    });
  };

  const handleRelationshipExport = () => {
    exportRelationshipGraph({
      currentNovel,
      resource,
      relationGraph,
      novelRelationshipGraph
    });
  };

  const handleSceneRuleExport = () => {
    exportSceneRule({
      resource,
      description,
      normalizeTags,
      sceneLayout,
      sceneDescription,
      sceneElementDetails,
      sceneVariants,
      data
    });
  };

  const handleSceneRuleImport = async (event) => {
    await importSceneRule({
      file: event.target.files?.[0],
      resource,
      setName,
      setDescription,
      setTags,
      setMeta
    });
  };

  const handleGrowthHistoryImport = async (event) => {
    await importGrowthHistory({
      file: event.target.files?.[0],
      setMeta
    });
  };

  const handleGrowthHistoryExport = () => {
    exportGrowthHistory({
      resource,
      growthHistory
    });
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

  const resolveRelationByTarget = (node) =>
    getRelationByTarget({
      relationGraph,
      resource,
      node
    });

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
        <CharacterBaseSection
          name={name}
          normalizeTags={normalizeTags}
          resolveFormValue={resolveFormValue}
          meta={meta}
          priorityPin={priorityPin}
          getCharacterStatus={getCharacterStatus}
          handleOpenEdit={handleOpenEdit}
        />
      )}

      {characterTab === 'appearance' && (
        <CharacterAppearanceSection
          forms={forms}
          activeFormName={activeFormName}
          setActiveFormName={setActiveFormName}
          handleOpenEdit={handleOpenEdit}
          resolveFormValue={resolveFormValue}
          characterReferences={characterReferences}
          data={data}
          resolveReferenceImage={resolveReferenceImage}
          handleCharacterImport={handleCharacterImport}
          handleCharacterExport={handleCharacterExport}
          viewList={viewList}
          viewAssets={viewAssets}
          requiredViewList={CHARACTER_REQUIRED_VIEWS}
          optionalViewList={CHARACTER_OPTIONAL_VIEWS}
          storyboardViewList={storyboardViewRequirements}
          openPreview={openPreview}
          viewInputRefs={viewInputRefs}
          handleViewUpload={handleViewUpload}
        />
      )}


      {characterTab === 'relations' && (
        <CharacterRelationsSection
          handleRelationshipExport={handleRelationshipExport}
          handleRelationshipImport={handleRelationshipImport}
          relationNodes={relationNodes}
          relationPositions={relationPositions}
          relationImageMap={relationImageMap}
          setFocusedRelation={setFocusedRelation}
          resolveReferenceImage={resolveReferenceImage}
          resource={resource}
          focusedRelation={focusedRelation}
          resolveRelationByTarget={resolveRelationByTarget}
        />
      )}


      {characterTab === 'growth' && (
        <CharacterGrowthSection
          growthHistory={growthHistory}
          handleGrowthHistoryExport={handleGrowthHistoryExport}
          handleGrowthHistoryImport={handleGrowthHistoryImport}
        />
      )}

      {editingSection && (
        <CharacterEditModalSection
          editingSection={editingSection}
          name={name}
          setName={setName}
          tags={tags}
          setTags={setTags}
          resolveFormValue={resolveFormValue}
          updateFormValue={updateFormValue}
          meta={meta}
          setMeta={setMeta}
          priorityPin={priorityPin}
          setPriorityPin={setPriorityPin}
          draftReferences={draftReferences}
          data={data}
          getCharacterFormOptions={getCharacterFormOptions}
          setDraftReferences={setDraftReferences}
          createAssetId={createAssetId}
          handleCloseEdit={handleCloseEdit}
          handleSaveEdit={handleSaveEdit}
        />
      )}


      <CharacterPreviewFooterSection
        previewImage={previewImage}
        previewLabel={previewLabel}
        closePreview={closePreview}
        handleBack={handleBack}
        handleSaveMeta={handleSaveMeta}
      />
    </div>
  );

  return (
    <div className="resource-detail">
      {type === 'characters' && renderCharacterDetail()}
      {type !== 'characters' && (
        <div className="card">
          <NonCharacterHeaderSection
            isEditingTitle={isEditingTitle}
            draftTitle={draftTitle}
            setDraftTitle={setDraftTitle}
            setName={setName}
            setIsEditingTitle={setIsEditingTitle}
            name={name}
            typeLabels={typeLabels}
            type={type}
            resource={resource}
            handleBack={handleBack}
          />
          {type === 'scenes' && (
            <SceneSection
              sceneTab={sceneTab}
              setSceneTab={setSceneTab}
              handleSceneRuleExport={handleSceneRuleExport}
              handleSceneRuleImport={handleSceneRuleImport}
              handleSceneEditOpen={handleSceneEditOpen}
              sceneLayout={sceneLayout}
              sceneDescription={sceneDescription}
              sceneElementDetails={sceneElementDetails}
              sceneVariants={sceneVariants}
              sortedSceneVariants={sortedSceneVariants}
              resource={resource}
              getSceneVariantRequirements={getSceneVariantRequirements}
              hasSceneVariantMissing={hasSceneVariantMissing}
              openPreview={openPreview}
              sceneInputRefs={sceneInputRefs}
              handleSceneVariantImageUpload={handleSceneVariantImageUpload}
              handleSceneVariantExport={handleSceneVariantExport}
              handleSceneVariantBatchUpload={handleSceneVariantBatchUpload}
            />
          )}

          {sceneEditingSection && type === 'scenes' && (
            <SceneEditModalSection
              sceneEditingSection={sceneEditingSection}
              sceneDraft={sceneDraft}
              setSceneDraft={setSceneDraft}
              handleSceneEditClose={handleSceneEditClose}
              handleSceneEditSave={handleSceneEditSave}
            />
          )}

          {type === 'expressions' && (
            <ExpressionSection
              expressionTabs={expressionTabs}
              expressionTab={expressionTab}
              setExpressionTab={setExpressionTab}
              expressionStatus={expressionStatus}
              meta={meta}
              setMeta={setMeta}
              scopeOptions={scopeOptions}
              riskOptions={riskOptions}
              strategyOptions={strategyOptions}
              description={description}
              setDescription={setDescription}
              expressionPreviewImage={expressionPreviewImage}
              resource={resource}
              handleUpdateMeta={handleUpdateMeta}
              handleExpressionRuleUpload={handleExpressionRuleUpload}
              expressionRuleText={expressionRuleText}
              setExpressionRuleText={setExpressionRuleText}
              handleExpressionRuleSave={handleExpressionRuleSave}
              mainExpressionAsset={mainExpressionAsset}
              handleExpressionAssetUpload={handleExpressionAssetUpload}
              transferQuery={transferQuery}
              setTransferQuery={setTransferQuery}
              expressionTransferRequests={expressionTransferRequests}
              openPreview={openPreview}
              expressionTransferRefs={expressionTransferRefs}
              handleExpressionTransferUpload={handleExpressionTransferUpload}
              handleExpressionTransferDownload={handleExpressionTransferDownload}
            />
          )}

          {type === 'props' && (
            <PropSection
              description={description}
              setDescription={setDescription}
              propVariants={propVariants}
              getPropVariantRequirements={getPropVariantRequirements}
              resource={resource}
              openPreview={openPreview}
              sceneInputRefs={sceneInputRefs}
              handlePropVariantImageUpload={handlePropVariantImageUpload}
              handlePropVariantExport={handlePropVariantExport}
              handlePropVariantBatchUpload={handlePropVariantBatchUpload}
            />
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


          <NonCharacterFooterMetaSection
            loading={loading}
            type={type}
            historyQuery={historyQuery}
            setHistoryQuery={setHistoryQuery}
            expressionHistory={expressionHistory}
            handleDownload={handleDownload}
            handleSaveMeta={handleSaveMeta}
          />
          </div>
      )}
    </div>
  );
};

export default ResourceDetail;