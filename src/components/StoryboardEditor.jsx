import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const shotTypeOptions = ['大全景', '中景', '近景', '特写', '俯视', '仰视'];
const angleOptions = ['正面', '侧面', '背面', '俯视', '仰视'];
const movementOptions = ['固定机位', '推镜', '拉镜', '摇镜', '移镜'];

const baseTabs = [
  { key: 'frame', label: '首帧图' },
  { key: 'animation', label: '动画' },
  { key: 'audio', label: '音频' }
];

const sideTabs = [
  { key: 'info', label: '文字信息' },
  { key: 'resources', label: '资源库' }
];

const resourceSections = [
  { key: 'characters', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' }
];

const emptyShot = (idx) => ({
  id: crypto.randomUUID(),
  shotNumber: `${idx + 1}`,
  description: '',
  shotType: shotTypeOptions[0] || '',
  shotTime: '',
  sceneDescription: '',
  cameraAngle: angleOptions[0] || '',
  cameraMovement: movementOptions[0] || '',
  scene: '',
  characters: [],
  props: [],
  previewImage: '',
  keyframes: [],
  audioDialogue: '',
  audioTone: '',
  audioBgm: '',
  audioSfx: ''
});

const StoryboardEditor = ({ novelId, chapter }) => {
  const { updateChapter, data, ensurePlaceholderResources } = useData();
  const [missingResources, setMissingResources] = useState([]);
  const [activeTabs, setActiveTabs] = useState({});
  const [sideTabsState, setSideTabsState] = useState({});
  const [resourceSectionState, setResourceSectionState] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingKeyframeDelete, setPendingKeyframeDelete] = useState(null);

  const scenes = data.resources.scenes || [];
  const characters = data.resources.characters || [];
  const props = data.resources.props || [];

  const getActiveTab = (shotId) => activeTabs[shotId] || 'frame';
  const getSideTab = (shotId) => sideTabsState[shotId] || 'info';
  const getResourceSection = (shotId) => resourceSectionState[shotId] || 'characters';

  const buildKeyframeTabs = (shot) =>
    (shot.keyframes || []).map((frame, index) => ({
      key: `keyframe-${frame.id}`,
      label: frame.label || `关键帧${index + 1}`,
      id: frame.id
    }));

  const isKeyframeTab = (tabKey) => tabKey.startsWith('keyframe-');

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
    });
    return missing;
  };

  const updateShots = (next) => {
    updateChapter(novelId, chapter.id, { storyboards: next, storyboardUpdatedAt: Date.now() });
    const missing = detectMissingResources(next);
    if (missing.length) {
      ensurePlaceholderResources(missing);
      setMissingResources(missing);
    } else {
      setMissingResources([]);
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const shots = Array.isArray(parsed) ? parsed : parsed.storyboard || [];
        const normalized = shots.map((shot, idx) => ({
          id: shot.id || crypto.randomUUID(),
          shotNumber: `${idx + 1}`,
          description: shot.description || '',
          shotType: shot.shotType || shotTypeOptions[0] || '',
          shotTime: shot.shotTime || '',
          sceneDescription: shot.sceneDescription || '',
          cameraAngle: shot.cameraAngle || angleOptions[0] || '',
          cameraMovement: shot.cameraMovement || movementOptions[0] || '',
          scene: shot.scene || '',
          characters: shot.characters || [],
          props: shot.props || [],
          previewImage: shot.previewImage || '',
          keyframes: Array.isArray(shot.keyframes) ? shot.keyframes : [],
          audioDialogue: shot.audioDialogue || '',
          audioTone: shot.audioTone || '',
          audioBgm: shot.audioBgm || '',
          audioSfx: shot.audioSfx || ''
        }));
        updateShots(normalized);
      } catch (err) {
        alert('JSON 解析失败');
      }
    };
    reader.readAsText(file);
  };

  const updateShotField = (shotId, field, value) => {
    const updated = (chapter.storyboards || []).map((shot, idx) =>
      shot.id === shotId ? { ...shot, [field]: value, shotNumber: `${idx + 1}` } : shot
    );
    updateShots(updated);
  };

  const handleBatchUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const existing = chapter.storyboards || [];
    const readerPromises = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, dataUrl: e.target.result });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readerPromises).then((items) => {
      const nextShots = items.map((item, idx) => ({
        ...emptyShot(existing.length + idx),
        description: item.name,
        previewImage: item.dataUrl
      }));
      updateShots([...existing, ...nextShots]);
    });
  };

  const handleAddKeyframe = (shotId) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const nextFrames = [...(shot.keyframes || [])];
      const newFrame = { id: crypto.randomUUID(), label: `关键帧${nextFrames.length + 1}` };
      nextFrames.push(newFrame);
      return { ...shot, keyframes: nextFrames };
    });
    updateShots(updated);
  };

  const handleDeleteKeyframe = (shotId, keyframeId) => {
    const updated = (chapter.storyboards || []).map((shot) => {
      if (shot.id !== shotId) return shot;
      const nextFrames = (shot.keyframes || []).filter((frame) => frame.id !== keyframeId);
      const normalized = nextFrames.map((frame, index) => ({
        ...frame,
        label: frame.label || `关键帧${index + 1}`
      }));
      return { ...shot, keyframes: normalized };
    });
    updateShots(updated);
  };

  const handleInsertShot = (index) => {
    const existing = chapter.storyboards || [];
    const next = [...existing];
    next.splice(index + 1, 0, emptyShot(index + 1));
    const normalized = next.map((shot, idx) => ({ ...shot, shotNumber: `${idx + 1}` }));
    updateShots(normalized);
  };

  const handleDeleteShot = (shotId) => {
    const filtered = (chapter.storyboards || []).filter((s) => s.id !== shotId);
    updateShots(filtered.map((shot, idx) => ({ ...shot, shotNumber: `${idx + 1}` })));
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(chapter.storyboards || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'storyboard'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleResourceSelection = (shotId, field, name) => {
    const shot = (chapter.storyboards || []).find((item) => item.id === shotId);
    if (!shot) return;
    if (field === 'scene') {
      updateShotField(shotId, field, name);
      return;
    }
    const current = shot[field] || [];
    const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
    updateShotField(shotId, field, next);
  };

  const renderResourceTiles = (shot, field, items) => (
    <div className="resource-grid">
      {items.map((item) => {
        const selected = field === 'scene' ? shot.scene === item.name : (shot[field] || []).includes(item.name);
        return (
          <button
            key={item.id || item.name}
            type="button"
            className={selected ? 'resource-card selected' : 'resource-card'}
            onClick={() => toggleResourceSelection(shot.id, field, item.name)}
          >
            <div className="resource-cover">
              {item.images?.[0] ? <img src={item.images[0]} alt={item.name} /> : <div className="cover-placeholder">无封面</div>}
            </div>
            <div className="resource-name">{item.name}</div>
          </button>
        );
      })}
      {items.length === 0 && <div className="empty">暂无资源，请先在资源库添加。</div>}
    </div>
  );

  return (
    <div className="card">
      <div className="space-between">
        <h3>分镜导入与编辑</h3>
        <div className="row">
          <input type="file" accept="application/json" onChange={handleImport} />
          <button onClick={handleDownload}>下载分镜数据</button>
          <label className="primary-link file-label">
            批量上传预览图
            <input type="file" accept="image/*" multiple onChange={handleBatchUpload} />
          </label>
        </div>
      </div>
      <div className="shot-list">
        {(chapter.storyboards || []).map((shot, index) => {
          const activeTab = getActiveTab(shot.id);
          const sideTab = getSideTab(shot.id);
          const resourceSection = getResourceSection(shot.id);
          const keyframeTabs = buildKeyframeTabs(shot);
          const isFrameTab = activeTab === 'frame' || isKeyframeTab(activeTab);
          return (
            <div key={shot.id} className="shot-card">
              <div className="shot-preview">
                {shot.previewImage ? <img src={shot.previewImage} alt="预览" /> : <div className="cover-placeholder">无预览图</div>}
              </div>
              <div className="shot-body">
                <div className="shot-header">
                  <div className="shot-number">镜头 {shot.shotNumber}</div>
                  <div className="shot-tabs">
                    {baseTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'tab active' : 'tab'}
                        onClick={() => setActiveTabs((prev) => ({ ...prev, [shot.id]: tab.key }))}
                      >
                        {tab.label}
                      </button>
                    ))}
                    {keyframeTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'tab keyframe-tab active' : 'tab keyframe-tab'}
                        onClick={() => setActiveTabs((prev) => ({ ...prev, [shot.id]: tab.key }))}
                      >
                        <span>{tab.label}</span>
                        <span
                          className="tab-delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingKeyframeDelete({ shotId: shot.id, keyframeId: tab.id, label: tab.label });
                          }}
                        >
                          ×
                        </span>
                      </button>
                    ))}
                    <button type="button" className="tab tab-add" onClick={() => handleAddKeyframe(shot.id)}>
                      + 关键帧
                    </button>
                  </div>
                  <button type="button" className="shot-remove" onClick={() => setPendingDelete(shot)} aria-label="删除镜头">
                    ×
                  </button>
                </div>

                {isFrameTab && (
                  <div className="shot-info">
                    <div className="shot-side-tabs">
                      {sideTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={sideTab === tab.key ? 'side-tab active' : 'side-tab'}
                          onClick={() => setSideTabsState((prev) => ({ ...prev, [shot.id]: tab.key }))}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="shot-panel">
                      {sideTab === 'info' ? (
                        <>
                          <div className="row compact">
                            <label>
                              镜头类型
                              <select
                                value={shot.shotType}
                                onChange={(e) => updateShotField(shot.id, 'shotType', e.target.value)}
                              >
                                {shotTypeOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              机位角度
                              <select
                                value={shot.cameraAngle}
                                onChange={(e) => updateShotField(shot.id, 'cameraAngle', e.target.value)}
                              >
                                {angleOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="row compact">
                            <label>
                              场景描述
                              <input
                                value={shot.sceneDescription}
                                onChange={(e) => updateShotField(shot.id, 'sceneDescription', e.target.value)}
                              />
                            </label>
                            <label>
                              时间/时段
                              <input
                                value={shot.shotTime}
                                onChange={(e) => updateShotField(shot.id, 'shotTime', e.target.value)}
                              />
                            </label>
                          </div>
                          <label>
                            画面描述
                            <textarea
                              className="shot-textarea"
                              value={shot.description}
                              onChange={(e) => updateShotField(shot.id, 'description', e.target.value)}
                            />
                          </label>
                        </>
                      ) : (
                        <div className="resource-folder">
                          {resourceSections.map((section) => (
                            <div key={section.key} className="resource-section">
                              <button
                                type="button"
                                className={
                                  resourceSection === section.key
                                    ? 'resource-section-header active'
                                    : 'resource-section-header'
                                }
                                onClick={() =>
                                  setResourceSectionState((prev) => ({ ...prev, [shot.id]: section.key }))
                                }
                              >
                                {section.label}
                              </button>
                              {resourceSection === section.key && (
                                <div className="resource-panel">
                                  {section.key === 'characters' && renderResourceTiles(shot, 'characters', characters)}
                                  {section.key === 'scenes' && renderResourceTiles(shot, 'scene', scenes)}
                                  {section.key === 'props' && renderResourceTiles(shot, 'props', props)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'animation' && (
                  <div className="shot-panel">
                    <div className="row compact">
                      <label>
                        镜头类型
                        <select
                          value={shot.shotType}
                          onChange={(e) => updateShotField(shot.id, 'shotType', e.target.value)}
                        >
                          {shotTypeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        机位角度
                        <select
                          value={shot.cameraAngle}
                          onChange={(e) => updateShotField(shot.id, 'cameraAngle', e.target.value)}
                        >
                          {angleOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        机位运动
                        <select
                          value={shot.cameraMovement}
                          onChange={(e) => updateShotField(shot.id, 'cameraMovement', e.target.value)}
                        >
                          {movementOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      镜头描述
                      <textarea
                        className="shot-textarea"
                        value={shot.description}
                        onChange={(e) => updateShotField(shot.id, 'description', e.target.value)}
                      />
                    </label>
                  </div>
                )}

                {activeTab === 'audio' && (
                  <div className="shot-panel">
                    <label>
                      角色对话
                      <textarea
                        className="shot-textarea"
                        value={shot.audioDialogue}
                        onChange={(e) => updateShotField(shot.id, 'audioDialogue', e.target.value)}
                        placeholder="角色对话内容"
                      />
                    </label>
                    <label>
                      语气/情绪
                      <input
                        value={shot.audioTone}
                        onChange={(e) => updateShotField(shot.id, 'audioTone', e.target.value)}
                        placeholder="如：平静、紧张"
                      />
                    </label>
                    <div className="row compact">
                      <label>
                        BGM
                        <input
                          value={shot.audioBgm}
                          onChange={(e) => updateShotField(shot.id, 'audioBgm', e.target.value)}
                          placeholder="背景音乐"
                        />
                      </label>
                      <label>
                        拟声
                        <input
                          value={shot.audioSfx}
                          onChange={(e) => updateShotField(shot.id, 'audioSfx', e.target.value)}
                          placeholder="音效"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="shot-actions">
                  <button type="button" className="shot-add" onClick={() => handleInsertShot(index)}>
                    + 新增镜头
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
            <a
              className="primary-link"
              href={`/resources?tab=${missingResources[0]?.type || 'characters'}&show=missing`}
            >
              一键跳转资源库
            </a>
            <button onClick={() => setMissingResources([])}>关闭</button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal">
          <div className="modal-content">
            <h4>确认删除镜头</h4>
            <p>确定删除镜头 {pendingDelete.shotNumber} 吗？该操作不可撤销。</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  handleDeleteShot(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                确认删除
              </button>
              <button type="button" className="tab" onClick={() => setPendingDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingKeyframeDelete && (
        <div className="modal">
          <div className="modal-content">
            <h4>确认删除关键帧</h4>
            <p>确定删除 {pendingKeyframeDelete.label} 吗？该操作不可撤销。</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  handleDeleteKeyframe(pendingKeyframeDelete.shotId, pendingKeyframeDelete.keyframeId);
                  setPendingKeyframeDelete(null);
                }}
              >
                确认删除
              </button>
              <button type="button" className="tab" onClick={() => setPendingKeyframeDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardEditor;
