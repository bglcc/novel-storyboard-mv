import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const emptyShot = () => ({
  id: crypto.randomUUID(),
  shotNumber: '',
  description: '',
  shotType: '',
  cameraAngle: '',
  cameraMovement: '',
  scene: '',
  characters: [],
  expressions: [],
  props: [],
  previewImage: ''
});

const StoryboardEditor = ({ novelId, chapter }) => {
  const { updateChapter, data, ensurePlaceholderResources } = useData();
  const [missingResources, setMissingResources] = useState([]);

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const shots = Array.isArray(parsed) ? parsed : parsed.storyboard || [];
        const normalized = shots.map((shot) => ({
          id: shot.id || crypto.randomUUID(),
          shotNumber: shot.shotNumber || '',
          description: shot.description || '',
          shotType: shot.shotType || '',
          cameraAngle: shot.cameraAngle || '',
          cameraMovement: shot.cameraMovement || '',
          scene: shot.scene || '',
          characters: shot.characters || [],
          expressions: shot.expressions || [],
          props: shot.props || [],
          previewImage: shot.previewImage || ''
        }));
        updateChapter(novelId, chapter.id, {
          storyboards: normalized,
          storyboardUpdatedAt: Date.now()
        });
        const missing = detectMissingResources(normalized);
        if (missing.length) {
          ensurePlaceholderResources(missing);
          setMissingResources(missing);
        } else {
          setMissingResources([]);
        }
      } catch (err) {
        alert('JSON 解析失败');
      }
    };
    reader.readAsText(file);
  };

  const detectMissingResources = (shots) => {
    const missing = [];
    const { resources } = data;
    const ensureItem = (type, name) => {
      if (!name) return;
      const exists = resources[type].some((r) => r.name === name);
      if (!exists && !missing.find((m) => m.type === type && m.name === name)) {
        missing.push({ type, name });
      }
    };

    shots.forEach((shot) => {
      ensureItem('scenes', shot.scene);
      (shot.characters || []).forEach((c) => ensureItem('characters', c));
      (shot.props || []).forEach((p) => ensureItem('props', p));
      (shot.expressions || []).forEach((exp) => ensureItem('expressions', exp));
    });
    return missing;
  };

  const updateShotField = (shotId, field, value) => {
    const updated = (chapter.storyboards || []).map((shot) =>
      shot.id === shotId ? { ...shot, [field]: value } : shot
    );
    updateChapter(novelId, chapter.id, { storyboards: updated, storyboardUpdatedAt: Date.now() });
  };

  const updateArrayField = (shotId, field, value) => {
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateShotField(shotId, field, items);
  };

  const handleAddShot = () => {
    updateChapter(novelId, chapter.id, {
      storyboards: [...(chapter.storyboards || []), emptyShot()],
      storyboardUpdatedAt: Date.now()
    });
  };

  const handleDeleteShot = (shotId) => {
    updateChapter(novelId, chapter.id, {
      storyboards: (chapter.storyboards || []).filter((s) => s.id !== shotId),
      storyboardUpdatedAt: Date.now()
    });
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(chapter.storyboards || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title}-storyboard.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="space-between">
        <h3>分镜导入与编辑</h3>
        <div className="row">
          <input type="file" accept="application/json" onChange={handleImport} />
          <button onClick={handleDownload}>下载分镜数据</button>
          <button onClick={handleAddShot}>新增镜头</button>
        </div>
      </div>
      <div className="grid">
        {(chapter.storyboards || []).map((shot) => (
          <div key={shot.id} className="item-card">
            <div className="item-header">
              <strong>镜头 {shot.shotNumber || '未编号'}</strong>
              <button className="danger" onClick={() => handleDeleteShot(shot.id)}>
                删除
              </button>
            </div>
            <label>
              镜头编号
              <input value={shot.shotNumber} onChange={(e) => updateShotField(shot.id, 'shotNumber', e.target.value)} />
            </label>
            <label>
              描述
              <textarea value={shot.description} onChange={(e) => updateShotField(shot.id, 'description', e.target.value)} />
            </label>
            <label>
              镜头类型
              <input value={shot.shotType} onChange={(e) => updateShotField(shot.id, 'shotType', e.target.value)} />
            </label>
            <label>
              机位角度
              <input value={shot.cameraAngle} onChange={(e) => updateShotField(shot.id, 'cameraAngle', e.target.value)} />
            </label>
            <label>
              机位运动
              <input
                value={shot.cameraMovement}
                onChange={(e) => updateShotField(shot.id, 'cameraMovement', e.target.value)}
              />
            </label>
            <label>
              场景
              <input value={shot.scene} onChange={(e) => updateShotField(shot.id, 'scene', e.target.value)} />
            </label>
            <label>
              角色（逗号分隔）
              <input
                value={(shot.characters || []).join(', ')}
                onChange={(e) => updateArrayField(shot.id, 'characters', e.target.value)}
              />
            </label>
            <label>
              表情（逗号分隔）
              <input
                value={(shot.expressions || []).join(', ')}
                onChange={(e) => updateArrayField(shot.id, 'expressions', e.target.value)}
              />
            </label>
            <label>
              道具（逗号分隔）
              <input
                value={(shot.props || []).join(', ')}
                onChange={(e) => updateArrayField(shot.id, 'props', e.target.value)}
              />
            </label>
            <label>
              预览图 URL（可选）
              <input
                value={shot.previewImage}
                onChange={(e) => updateShotField(shot.id, 'previewImage', e.target.value)}
              />
            </label>
            {shot.previewImage && <img src={shot.previewImage} alt="预览" className="preview" />}
          </div>
        ))}
      </div>
      {missingResources.length > 0 && (
        <div className="modal">
          <div className="modal-content">
            <h4>检测到缺失资源</h4>
            <ul>
              {missingResources.map((item) => (
                <li key={`${item.type}-${item.name}`}>
                  [{item.type}] {item.name}
                </li>
              ))}
            </ul>
            <p>已自动创建占位资源，点击下方按钮前往资源库补齐。</p>
            <a className="primary-link" href="/resources">
              一键跳转资源库
            </a>
            <button onClick={() => setMissingResources([])}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardEditor;
