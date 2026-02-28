import JSZip from 'jszip';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || '');
    reader.onerror = () => reject(new Error(`读取文件失败: ${file?.name || 'unknown'}`));
    reader.readAsDataURL(file);
  });

const readFilesAsDataUrlEntries = async (files = []) => {
  const entries = await Promise.all(
    (files || []).map(async (file) => ({
      name: file.name,
      src: await readFileAsDataUrl(file)
    }))
  );
  return entries;
};

const downloadBlob = (fileName, blob) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

const downloadJson = (fileName, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(fileName, blob);
};

const loadZip = async (file) => JSZip.loadAsync(file);

export { downloadBlob, downloadJson, loadZip, readFileAsDataUrl, readFilesAsDataUrlEntries };