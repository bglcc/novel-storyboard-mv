import { loadZip, readFilesAsDataUrlEntries } from './fileUtils';

const buildAssetEntries = async ({ files, assets, role, ownerName, createAssetId }) => {
  const uploadedAt = new Date().toISOString();
  const nextVersion =
    Math.max(
      0,
      ...assets
        .filter((asset) => asset.role === role && asset.ownerName === ownerName)
        .map((asset) => asset.version || 0)
    ) + 1;

  const entries = await readFilesAsDataUrlEntries(files);

  return entries.map((entry) => ({
    id: createAssetId(),
    role,
    ownerName,
    version: nextVersion,
    uploadedAt,
    fileName: entry.name,
    src: entry.src
  }));
};

const mergeImagesFromFiles = async ({ files, currentImages = [] }) => {
  const entries = await readFilesAsDataUrlEntries(files);
  return [...currentImages, ...entries.map((entry) => entry.src)];
};

const mergeImagesFromZip = async ({ file, currentImages = [] }) => {
  const zip = await loadZip(file);
  const images = [];
  const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
  for (const entry of entries) {
    const base64 = await entry.async('base64');
    images.push(`data:image/${entry.name.split('.').pop()};base64,${base64}`);
  }
  return [...currentImages, ...images];
};

export { buildAssetEntries, mergeImagesFromFiles, mergeImagesFromZip };