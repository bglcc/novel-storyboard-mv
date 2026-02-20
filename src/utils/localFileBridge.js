const DEFAULT_ENDPOINT = 'http://127.0.0.1:47952';
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 255;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('无法读取文件内容'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

const sha256 = async (file) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const validateFile = (file) => {
  if (!file) return { ok: false, message: '未选择文件' };
  if (!file.name || file.name.length > MAX_FILE_NAME_LENGTH) {
    return { ok: false, message: '文件名无效或长度超限（最大 255 字符）' };
  }
  if (file.size <= 0) {
    return { ok: false, message: '文件内容为空' };
  }
  if (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
    if (file.size > MAX_VIDEO_SIZE) {
      return { ok: false, message: 'MP4 文件超过 2GB 上限' };
    }
  }
  return { ok: true, message: '' };
};

const saveWithLocalService = async ({ file, targetPath, endpoint = DEFAULT_ENDPOINT }) => {
  const base64 = await fileToBase64(file);
  const response = await fetch(`${endpoint}/api/files/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetPath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      contentBase64: base64
    })
  });
  if (!response.ok) {
    throw new Error(`本地服务保存失败: ${response.status}`);
  }
  const payload = await response.json();
  return payload.localPath || `${targetPath}/${file.name}`;
};

const saveFileWithFallback = async ({ file, targetPath, endpoint = DEFAULT_ENDPOINT }) => {
  try {
    const localPath = await saveWithLocalService({ file, targetPath, endpoint });
    return { localPath, source: 'service' };
  } catch (error) {
    return { localPath: `LOCAL://${targetPath}/${file.name}`, source: 'fallback', error };
  }
};

export { DEFAULT_ENDPOINT, MAX_VIDEO_SIZE, MAX_FILE_NAME_LENGTH, sha256, validateFile, saveFileWithFallback };
