const MAX_NOVEL_RESULTS = 5;
const MAX_SHOT_RESULTS = 8;
const MAX_RESOURCE_RESULTS = 8;

export const normalizeSearchText = (value) =>
  (value || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/gu, '')
    .replace(/[\p{P}\p{S}]/gu, '');

const createNovelResults = (novels, keyword) =>
  (novels || [])
    .filter((novel) => normalizeSearchText(novel.title).includes(keyword))
    .slice(0, MAX_NOVEL_RESULTS)
    .map((novel) => ({
      id: novel.id,
      label: novel.title,
      path: `/novel/${novel.id}`
    }));

const createShotResults = (novels, keyword) =>
  (novels || [])
    .flatMap((novel) =>
      (novel.chapters || []).flatMap((chapter) =>
        (chapter.storyboardShots || []).map((shot) => ({
          id: shot.id,
          label: `${novel.title} / ${chapter.title} / ${shot.shotNumber || shot.shotId || shot.title || '镜头'}`,
          path: `/novel/${novel.id}/chapter/${chapter.id}`,
          raw: [
            novel.title || '',
            shot.shotNumber || shot.shotId || '',
            shot.title || '',
            shot.scene || shot.mainScene || '',
            ...(shot.resources || [])
              .filter((resource) => ['characters', 'scenes', 'props'].includes(resource.type))
              .map((resource) => resource.name || '')
          ].join(' ')
        }))
      )
    )
    .filter((entry) => normalizeSearchText(entry.raw || entry.label).includes(keyword))
    .slice(0, MAX_SHOT_RESULTS);

const createResourceResults = (resources, keyword) =>
  Object.values(resources || {})
    .flat()
    .filter((resource) => normalizeSearchText(resource.name).includes(keyword))
    .slice(0, MAX_RESOURCE_RESULTS)
    .map((resource) => ({
      id: resource.id,
      label: resource.name,
      path: `/resources/${resource.type || 'characters'}/${resource.id}`
    }));

export const buildGlobalSearchResults = (data, keywordInput) => {
  const keyword = normalizeSearchText(keywordInput);
  if (!keyword) return { novels: [], shots: [], resources: [] };

  return {
    novels: createNovelResults(data?.novels, keyword),
    shots: createShotResults(data?.novels, keyword),
    resources: createResourceResults(data?.resources, keyword)
  };
};