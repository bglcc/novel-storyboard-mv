import { downloadJson } from './fileUtils';

const parseJsonFile = async (file, emptyMessage, parseErrorMessage) => {
  if (!file) return { ok: false, payload: null };
  try {
    const text = await file.text();
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    if (!cleaned) {
      alert(emptyMessage);
      return { ok: false, payload: null };
    }
    let parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return { ok: true, payload: parsed };
  } catch (error) {
    alert(parseErrorMessage);
    return { ok: false, payload: null };
  }
};

const importRelationshipGraph = async ({ file, currentNovel, updateNovel, setMeta }) => {
  const result = await parseJsonFile(file, '关系网 JSON 为空', '关系网 JSON 解析失败');
  if (!result.ok) return;
  if (currentNovel) {
    updateNovel(currentNovel.id, { relationshipGraph: result.payload });
  } else {
    setMeta((prev) => ({ ...prev, relationshipGraph: result.payload }));
  }
};

const exportRelationshipGraph = ({ currentNovel, resource, relationGraph, novelRelationshipGraph }) => {
  const graph = novelRelationshipGraph || relationGraph;
  downloadJson(`${currentNovel?.title || resource.name || 'character'}-relationship.json`, graph);
};

const exportSceneRule = ({ resource, description, normalizeTags, sceneLayout, sceneDescription, sceneElementDetails, sceneVariants, data }) => {
  const payload = {
    scene: {
      id: resource.id,
      name: resource.name,
      description,
      tags: normalizeTags(),
      meta: {
        sceneLayout,
        sceneDescription,
        sceneElementDetails,
        sceneVariants
      }
    },
    rules: (data.rules || []).filter((rule) => rule.tool === '场景资源')
  };
  downloadJson(`${resource.name || 'scene'}-rule.json`, payload);
};

const importSceneRule = async ({ file, resource, setName, setDescription, setTags, setMeta }) => {
  const result = await parseJsonFile(file, '场景规则包为空', '场景规则包解析失败');
  if (!result.ok) return;
  const payload = result.payload.scene || result.payload;
  setName(payload.name || resource.name || '');
  setDescription(payload.description || '');
  if (payload.tags) setTags((payload.tags || []).join(', '));
  setMeta((prev) => ({
    ...prev,
    sceneLayout: payload.meta?.sceneLayout || payload.sceneLayout || prev.sceneLayout,
    sceneDescription: payload.meta?.sceneDescription || payload.sceneDescription || prev.sceneDescription,
    sceneElementDetails: payload.meta?.sceneElementDetails || payload.sceneElementDetails || prev.sceneElementDetails,
    sceneVariants: payload.meta?.sceneVariants || payload.sceneVariants || prev.sceneVariants
  }));
};

const importGrowthHistory = async ({ file, setMeta }) => {
  const result = await parseJsonFile(file, '成长史 JSON 为空', '成长史 JSON 解析失败');
  if (!result.ok) return;
  const entries = Array.isArray(result.payload) ? result.payload : result.payload.characterGrowthHistory || [];
  setMeta((prev) => ({ ...prev, characterGrowthHistory: entries }));
};

const exportGrowthHistory = ({ resource, growthHistory }) => {
  downloadJson(`${resource.name || 'character'}-growth-history.json`, {
    characterGrowthHistory: growthHistory
  });
};

export {
  exportGrowthHistory,
  exportRelationshipGraph,
  exportSceneRule,
  importGrowthHistory,
  importRelationshipGraph,
  importSceneRule
};