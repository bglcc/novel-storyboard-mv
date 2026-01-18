import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const tabs = [
  { key: 'characters', label: '角色' },
  { key: 'expressions', label: '表情' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' },
  { key: 'animations', label: '动画' },
  { key: 'music', label: '背景音乐' },
  { key: 'voiceovers', label: '角色配音' }
];

const ResourceLibrary = () => {
  const { data, deleteResource } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const queryTab = new URLSearchParams(location.search).get('tab');
  const showMissing = new URLSearchParams(location.search).get('show') === 'missing';
  const validTabs = useMemo(() => tabs.map((t) => t.key), []);
  const initialTab = validTabs.includes(queryTab) ? queryTab : 'characters';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    const nextTab = validTabs.includes(queryTab) ? queryTab : 'characters';
    setActiveTab(nextTab);
  }, [queryTab, validTabs]);

  const resources = (data.resources?.[activeTab] || []).filter((res) => {
    const missingOk = showMissing ? res.status === '待补齐' || res.isAvailable === false : true;
    const tags = (res.tags || []).join(',').toLowerCase();
    const byTag = tagFilter ? tags.includes(tagFilter.toLowerCase()) : true;
    return missingOk && byTag;
  });

  const getLatestAsset = (res) => {
    const assets = res.assets || [];
    if (!assets.length) return null;
    return assets
      .slice()
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
  };

  const resolveCoverImage = (res) => {
    if (activeTab === 'characters') {
      return getLatestAsset(res)?.src || res.meta?.viewImages?.front || res.images?.[0];
    }
    return res.images?.[0];
  };

  const getCharacterStatus = (res) => {
    const assets = res.assets || [];
    if (!assets.length) return '待完成';
    const hasForms = Array.isArray(res.form) && res.form.length > 0;
    const hasActions = Array.isArray(res.action) && res.action.length > 0;
    if (!hasForms || !hasActions) return '部分完成';
    return '已完成';
  };

  const handleDelete = (resourceId) => {
    if (!window.confirm('确认删除该资源？')) return;
    deleteResource(activeTab, resourceId);
  };

  const hasMissingByTab = useMemo(() => {
    const entries = Object.entries(data.resources || {});
    return entries.reduce((acc, [key, list]) => {
      acc[key] = (list || []).some((res) => res.status === '待补齐' || res.isAvailable === false);
      return acc;
    }, {});
  }, [data.resources]);

  return (
    <div className="card">
      <h2>资源库</h2>
      <p className="muted">支持上传透明 PNG、JPG、WebP，并可用于分镜图缺失资源补齐。</p>
      <div className="resource-entry">
        <span className="muted">颜艺形态已并入表情资源库，请在“表情”标签页管理。</span>
      </div>
      <div className="row">
        <input
          placeholder="按标签筛选，逗号分隔"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        />
        <span className="muted">自动提取首张图片为封面，缺少则显示占位图。</span>
      </div>
      {activeTab === 'expressions' && (
        <div className="row">
          {showMissing && (
            <button type="button" className="ghost-button" onClick={() => navigate('/resources?tab=expressions')}>
              查看全部表情
            </button>
          )}
          <span className="muted">表情资源用于统一管理颜艺形态与生成规则。</span>
        </div>
      )}
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={tab.key === activeTab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {hasMissingByTab[tab.key] && <span className="tab-dot" />}
          </button>
        ))}
      </div>
      <div className="grid fixed-four">
        {resources.map((res) => {
          const coverImage = resolveCoverImage(res);
          const hasCover = Boolean(coverImage);
          const statusText =
            activeTab === 'characters'
              ? getCharacterStatus(res)
              : res.status || (res.isAvailable ? '已完成' : '待补齐');
          return (
            <div key={res.id} className="item-card">
              <div className="cover-wrap">
                {hasCover ? (
                  <img src={coverImage} alt="封面" className="cover" />
                ) : (
                  <div className="placeholder">待完成</div>
                )}
                {!hasCover && <span className="badge warning">待完成</span>}
                <span
                  className={`badge status ${statusText === '已完成' ? 'success' : 'warning'}`}
                >
                  {statusText}
                </span>
              </div>
              <h4>{res.name}</h4>
              <p className="muted">{res.description || '暂无描述'}</p>
              {(res.tags || []).length > 0 && (
                <p className="muted">标签：{(res.tags || []).join('，')}</p>
              )}
              <div className="row card-actions">
                <button type="button" onClick={() => navigate(`/resources/${activeTab}/${res.id}`)}>
                  编辑
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(res.id)}>
                  删除
                </button>
              </div>
            </div>
          );
        })}
        {resources.length === 0 && <div className="empty">暂无资源，导入分镜后自动创建。</div>}
      </div>
    </div>
  );
};

export default ResourceLibrary;
