const ALLOWED_LEVELS = new Set(['L1', 'L2', 'L3', 'L4']);
const ALLOWED_FRAME_MODES = new Set(['single', 'keyframes', '', undefined, null]);

const getText = (value) => (typeof value === 'string' ? value.trim() : '');

const getReadableShotKey = (item, index) =>
  getText(item?.shotNumber) || getText(item?.shotId) || `第${index + 1}条`;

export const validateImportedShotList = (source) => {
  const errors = [];
  const seenShotKeys = new Set();

  source.forEach((item, index) => {
    const rowErrors = [];
    const key = getReadableShotKey(item, index);
    const synopsis =
      getText(item?.synopsis) ||
      getText(item?.text) ||
      getText(item?.outlineText) ||
      getText(item?.content);

    if (!synopsis) {
      rowErrors.push('缺少镜头剧情文本（synopsis/text/outlineText/content）');
    }

    const level = getText(item?.level) || 'L1';
    if (!ALLOWED_LEVELS.has(level)) {
      rowErrors.push(`镜头等级不合法（${level}），仅支持 L1/L2/L3/L4`);
    }

    const frameMode = item?.frameMode;
    if (!ALLOWED_FRAME_MODES.has(frameMode)) {
      rowErrors.push(`frameMode 不合法（${String(frameMode)}），仅支持 single/keyframes`);
    }

    const shotKeyForDup = getText(item?.shotNumber) || getText(item?.shotId);
    if (shotKeyForDup) {
      if (seenShotKeys.has(shotKeyForDup)) {
        rowErrors.push(`镜号重复（${shotKeyForDup}）`);
      } else {
        seenShotKeys.add(shotKeyForDup);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ key, rowErrors });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

export const buildImportValidationMessage = (validationResult) => {
  if (validationResult.valid) return '';
  const details = validationResult.errors
    .slice(0, 5)
    .map((entry) => `${entry.key}：${entry.rowErrors.join('；')}`)
    .join('\n');

  const overflow = validationResult.errors.length > 5
    ? `\n...其余 ${validationResult.errors.length - 5} 条请修正后重试。`
    : '';

  return `导入校验失败：\n${details}${overflow}`;
};