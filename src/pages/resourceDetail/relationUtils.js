const getRelationByTarget = ({ relationGraph, resource, node }) => {
  const relations = relationGraph?.relations || [];
  const centerKeys = [resource?.id, resource?.name].filter(Boolean).map((value) => String(value).toLowerCase());
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

const getSceneVariantRequirements = (variant) => {
  const images = variant?.images || [];
  const requirements = variant?.imageRequirements || images.map((img) => img.label);
  return requirements.length ? requirements : images.map((img) => img.label);
};

const hasSceneVariantMissing = (variant) => {
  const requirements = getSceneVariantRequirements(variant);
  if (!requirements.length) return false;
  return requirements.some((label) => !(variant?.images || []).some((img) => img.label === label));
};

const sortSceneVariantsByMissing = (sceneVariants = []) => {
  return [...sceneVariants].sort((a, b) => {
    const aMissing = hasSceneVariantMissing(a);
    const bMissing = hasSceneVariantMissing(b);
    if (aMissing === bMissing) return 0;
    return aMissing ? -1 : 1;
  });
};

export { getRelationByTarget, getSceneVariantRequirements, hasSceneVariantMissing, sortSceneVariantsByMissing };