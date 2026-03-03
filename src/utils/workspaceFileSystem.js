const HANDLE_DB = 'novel-storyboard-workspace';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'workspace-root';

export const WORKSPACE_DIRS = ['volumeInfo', 'shotData', 'material', 'exportFile', 'backup'];

export const isWorkspaceApiSupported = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window && 'indexedDB' in window;

const withDb = (callback) =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HANDLE_DB, 1);
    request.onerror = () => reject(request.error || new Error('无法打开工作目录数据库'));
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      Promise.resolve(callback(db))
        .then((result) => {
          db.close();
          resolve(result);
        })
        .catch((error) => {
          db.close();
          reject(error);
        });
    };
  });

export const saveWorkspaceHandle = async (handle) => {
  if (!isWorkspaceApiSupported() || !handle) return;
  await withDb(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, 'readwrite');
        tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('保存工作目录失败'));
      })
  );
};

export const getWorkspaceHandle = async () => {
  if (!isWorkspaceApiSupported()) return null;
  return withDb(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, 'readonly');
        const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('读取工作目录失败'));
      })
  );
};

const ensureReadWritePermission = async (directoryHandle) => {
  if (!directoryHandle) return false;
  const options = { mode: 'readwrite' };
  if ((await directoryHandle.queryPermission(options)) === 'granted') return true;
  return (await directoryHandle.requestPermission(options)) === 'granted';
};

export const pickWorkspaceHandle = async () => {
  if (!isWorkspaceApiSupported()) {
    throw new Error('当前浏览器不支持本地工作目录授权，请使用 Chrome / Edge 最新版本。');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const granted = await ensureReadWritePermission(handle);
  if (!granted) {
    throw new Error('未获得目录写入权限，请重新授权后继续。');
  }
  return handle;
};

export const hydrateWorkspaceHandle = async () => {
  const handle = await getWorkspaceHandle();
  if (!handle) return null;
  const granted = await ensureReadWritePermission(handle);
  if (!granted) return null;
  return handle;
};

export const ensureWorkspaceDirs = async (rootHandle) => {
  for (const dir of WORKSPACE_DIRS) {
    await rootHandle.getDirectoryHandle(dir, { create: true });
  }
};

export const writeJsonFile = async (rootHandle, dirName, fileName, payload) => {
  const dirHandle = await rootHandle.getDirectoryHandle(dirName, { create: true });
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
};

export const formatDateKey = (timestamp = Date.now()) => {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const pruneOldBackupDirs = async (rootHandle, retentionDays = 7) => {
  const backupRoot = await rootHandle.getDirectoryHandle('backup', { create: true });
  const now = Date.now();
  const threshold = now - retentionDays * 24 * 60 * 60 * 1000;

  for await (const [name, handle] of backupRoot.entries()) {
    if (handle.kind !== 'directory') continue;
    const parsedTime = new Date(`${name}T00:00:00`).getTime();
    if (Number.isNaN(parsedTime)) continue;
    if (parsedTime < threshold) {
      await backupRoot.removeEntry(name, { recursive: true });
    }
  }
};