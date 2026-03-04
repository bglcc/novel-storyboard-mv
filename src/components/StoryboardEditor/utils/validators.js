import { FIELD_LABELS, SHOT_LEVEL_CONFIG } from '../constants/shotLevelConfig';
import { RESOURCE_TYPE_LABELS } from '../constants/resourceConfig';

const isMissing = (value) => {
  if (typeof value === 'number') return Number.isNaN(value);
  return String(value ?? '').trim() === '';
};

const countUploadedByType = (resources = []) =>
  resources.reduce((acc, resource) => {
    if (resource?.status !== 'uploaded') return acc;
    const key = resource?.type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const toResourceMessage = (rule) => `${RESOURCE_TYPE_LABELS[rule.type] || rule.type}资源需至少关联 ${rule.min} 个`;

const validateResourceRequirements = (requirements = {}, uploadedByType = {}) => {
  const missingMessages = [];
  const allOf = requirements?.allOf || [];
  const anyOf = requirements?.anyOf || [];
  const optionalTypes = new Set(['characters', 'scenes']);

  allOf.forEach((rule) => {
    if (optionalTypes.has(rule.type)) return;
    const count = uploadedByType[rule.type] || 0;
    if (count < rule.min) missingMessages.push(toResourceMessage(rule));
  });

  if (anyOf.length > 0) {
    const effectiveRules = anyOf.filter((rule) => !optionalTypes.has(rule.type));
    if (effectiveRules.length === 0) return missingMessages;
    const matched = effectiveRules.some((rule) => (uploadedByType[rule.type] || 0) >= rule.min);
    if (!matched) {
      const options = effectiveRules.map((rule) => `${rule.min}个${RESOURCE_TYPE_LABELS[rule.type] || rule.type}资源`).join('或');
      missingMessages.push(`需至少关联 ${options}`);
    }
  }

  return missingMessages;
};

export const getShotValidation = (shot) => {
  const level = shot?.level || 'L1';
  const config = SHOT_LEVEL_CONFIG[level] || SHOT_LEVEL_CONFIG.L1;
  const resources = shot?.resources || [];
  const uploadedByType = countUploadedByType(resources);

  const missingFields = (config.requiredFields || [])
    .filter((field) => isMissing(shot?.[field]))
    .map((field) => `${FIELD_LABELS[field] || field}未填写`);

  if (isMissing(shot?.sceneDescription)) {
    missingFields.push('请填写场景描述');
  }

  const missingAssets = (config.requiredAssets || [])
    .filter((asset) => isMissing(shot?.[asset]?.fileName))
    .map((asset) => `${FIELD_LABELS[asset] || asset}未上传`);

  const missingResources = validateResourceRequirements(config.resourceRequirements, uploadedByType);

  const missingLabels = [...missingFields, ...missingAssets, ...missingResources];

  return {
    isValid: missingLabels.length === 0,
    missingLabels
  };
};