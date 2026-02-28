export const STORYBOARD_SCHEMA_VERSION = 2;

export const migrateChapterStoryboard = (chapter) => {
  const workflow = chapter?.editingWorkflow || {};
  if ((workflow.schemaVersion || 1) >= STORYBOARD_SCHEMA_VERSION) return null;

  const legacyAudioFields = {};
  (chapter?.storyboardShots || []).forEach((shot, index) => {
    if (shot?.dialoguePlaceholder || shot?.bgmPlaceholder || shot?.sfxPlaceholder) {
      legacyAudioFields[shot?.id || String(index)] = {
        dialoguePlaceholder: shot?.dialoguePlaceholder || '',
        bgmPlaceholder: shot?.bgmPlaceholder || '',
        sfxPlaceholder: shot?.sfxPlaceholder || ''
      };
    }
  });

  return {
    editingWorkflow: {
      ...workflow,
      schemaVersion: STORYBOARD_SCHEMA_VERSION,
      legacyStoryboardBackup: {
        ...(workflow.legacyStoryboardBackup || {}),
        storyboardOutlineItems: chapter?.storyboardOutlineItems || [],
        storyboardShots: chapter?.storyboardShots || [],
        legacyAudioFields
      },
      legacyFields: {
        ...(workflow.legacyFields || {}),
        outlineSplit: workflow.legacyFields?.outlineSplit || workflow.outlineSplit || null
      }
    }
  };
};