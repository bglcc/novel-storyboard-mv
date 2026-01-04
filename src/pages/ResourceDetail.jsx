import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';

const typeLabels = {
  characters: '角色',
  expressions: '表情',
  scenes: '场景',
  props: '道具'
};

const ResourceDetail = () => {
  const { type, resourceId } = useParams();
  const navigate = useNavigate();
  const { data, updateResourceImages, upsertResource } = useData();
  const resource = useMemo(() => data.resources[type].find((r) => r.id === resourceId), [data, type, resourceId]);
  const [name, setName] = useState(resource.name || '');
  const [description, setDescription] = useState(resource.description || '');
  const [loading, setLoading] = useState(false);

  if (!resource) return <div className="card">资源不存在</div>;

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const images = [];
      const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(png|jpg|jpeg|webp)$/i.test(f.name));
      for (const entry of entries) {
        const blob = await entry.async('base64');
        images.push(`data:image/${entry.name.split('.').pop()};base64,${blob}`);
      }
      const merged = [...(resource.images || []), ...images];
      updateResourceImages(type, resourceId, merged);
    } catch (e) {
      alert('解压失败，请检查 zip 文件');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const merged = [...(resource.images || []), e.target.result];
      updateResourceImages(type, resourceId, merged);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (idx) => {
    const updated = (resource.images || []).filter((_, i) => i !== idx);
    updateResourceImages(type, resourceId, updated);
  };

  const handleSaveMeta = () => {
    upsertResource(type, { ...resource, name, description });
    navigate(`/resources?tab=${type}`);
  };

  return (
    <div className="card">
      <h2>
        资源详情 - {typeLabels[type]} {resource.name}
      </h2>
      <div className="row">
        <label>
          名称
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          描述
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <div>
          <p>上传 zip（自动解压图片）</p>
          <input type="file" accept="application/zip" onChange={handleZipUpload} />
        </div>
        <div>
          <p>补充单张图片</p>
          <input type="file" accept="image/*" onChange={handleSingleUpload} />
        </div>
        <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
      </div>
      {loading && <div className="muted">正在解压...</div>}
      <div className="grid">
        {(resource.images || []).map((img, idx) => (
          <div key={idx} className="item-card">
            <img src={img} alt={`res-${idx}`} className="cover" />
            <button className="danger" onClick={() => handleDelete(idx)}>
              删除图片
            </button>
          </div>
        ))}
        {(resource.images || []).length === 0 && <div className="empty">暂无图片，上传 zip 或补充图片。</div>}
      </div>
    </div>
  );
};

export default ResourceDetail;
