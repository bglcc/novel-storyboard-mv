import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { useData } from '../context/DataContext';

const typeLabels = {
  characters: '角色',
  expressions: '表情',
  scenes: '场景',
  props: '道具',
  animations: '动画',
  music: '背景音乐',
  voiceovers: '角色配音'
};

const ResourceDetail = () => {
  const { type, resourceId } = useParams();
  const navigate = useNavigate();
  const { data, updateResourceImages, upsertResource } = useData();
  const resourceList = data.resources[type] || [];
  const resource = useMemo(
    () => resourceList.find((r) => r.id === resourceId),
    [resourceList, resourceId]
  );
  const [name, setName] = useState(resource?.name || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState((resource?.tags || []).join(', '));
  const [meta, setMeta] = useState(resource?.meta || {});
  const [historyQuery, setHistoryQuery] = useState('');

  useEffect(() => {
    if (resource) {
      setName(resource.name || '');
      setDescription(resource.description || '');
      setTags((resource.tags || []).join(', '));
      setMeta(resource.meta || {});
    }
  }, [resourceId, resource]);

  if (!data.resources[type]) return <div className="card">资源类型不存在</div>;
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
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        })
    );
    const images = await Promise.all(readers);
    const merged = [...(resource.images || []), ...images];
    updateResourceImages(type, resourceId, merged);
  };

  const handleDelete = (idx) => {
    const updated = (resource.images || []).filter((_, i) => i !== idx);
    updateResourceImages(type, resourceId, updated);
  };

  const handleSaveMeta = () => {
    const normalizedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    upsertResource(type, { ...resource, name, description, tags: normalizedTags, meta });
    navigate(`/resources?tab=${type}`);
  };

  const handleDownload = () => {
    const payload = {
      type,
      id: resource.id,
      name,
      description,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      meta,
      images: resource.images || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.name || 'resource'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const expressionHistory = (meta.expressionHistory || []).filter((item) => {
    if (!historyQuery.trim()) return true;
    return `${item.character || ''}${item.name || ''}`.toLowerCase().includes(historyQuery.toLowerCase());
  });

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
      {type === 'characters' && (
        <div className="row">
          <label>
            人设
            <input
              value={meta.persona || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, persona: e.target.value }))}
              placeholder="角色人设设定"
            />
          </label>
          <label>
            外貌描述
            <input
              value={meta.appearance || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, appearance: e.target.value }))}
              placeholder="外貌特征"
            />
          </label>
          <label>
            参考人物
            <input
              value={meta.reference || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="参考人设或演员"
            />
          </label>
        </div>
      )}
      {type === 'expressions' && (
        <div className="row">
          <label>
            情绪类型
            <input
              value={meta.emotionType || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, emotionType: e.target.value }))}
              placeholder="如：开心、愤怒"
            />
          </label>
          <label>
            情绪值
            <input
              value={meta.emotionValue || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, emotionValue: e.target.value }))}
              placeholder="如：80%"
            />
          </label>
          <label>
            匹配背景
            <input
              value={meta.background || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, background: e.target.value }))}
              placeholder="适用场景/背景"
            />
          </label>
        </div>
      )}
      {type === 'scenes' && (
        <div className="row">
          <label>
            场景简述
            <input
              value={meta.shortDescription || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, shortDescription: e.target.value }))}
              placeholder="如：小炒店、破旧"
            />
          </label>
        </div>
      )}
      <div className="row">
        <div>
          <p>上传 zip（自动解压图片）</p>
          <input type="file" accept="application/zip" onChange={handleZipUpload} />
        </div>
        <div>
          <p>补充图片（可多选）</p>
          <input type="file" accept="image/*" multiple onChange={handleSingleUpload} />
        </div>
        <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
        <button onClick={handleDownload}>下载资源</button>
      </div>
      <label>
        标签（逗号分隔）
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="角色, 主角" />
      </label>
      {loading && <div className="muted">正在解压...</div>}
      {type === 'expressions' && (
        <div className="card subtle">
          <h3>表情历史记录</h3>
          <div className="row">
            <input
              placeholder="搜索角色或表情"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
            />
            <span className="muted">同表情在不同角色间的复用记录</span>
          </div>
          <div className="list">
            {expressionHistory.map((item, idx) => (
              <div key={idx} className="list-item">
                <div>
                  <div className="list-title">{item.name || '表情'}</div>
                  <div className="muted">角色：{item.character || '未知'}</div>
                  <div className="muted">情绪值：{item.value || '-'}</div>
                </div>
                <button type="button" onClick={handleDownload}>
                  下载规则
                </button>
              </div>
            ))}
            {expressionHistory.length === 0 && <div className="empty">暂无历史记录。</div>}
          </div>
        </div>
      )}
      <div className="grid">
        {(resource.images || []).map((img, idx) => (
          <div key={idx} className="item-card">
            <img src={img} alt={`res-${idx}`} className="cover checkerboard" />
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
