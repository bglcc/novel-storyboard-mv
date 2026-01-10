import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const { data } = useData();
  const location = useLocation();
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

  return (
    <div className="card">
      <h2>资源库</h2>
      <p className="muted">支持上传透明 PNG、JPG、WebP，并可用于分镜图缺失资源补齐。</p>
      <div className="row">
        <input
          placeholder="按标签筛选，逗号分隔"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        />
        <span className="muted">自动提取首张图片为封面，缺少则显示占位图。</span>
      </div>
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={tab.key === activeTab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid">
        {resources.map((res) => {
          const hasCover = Boolean(res.images && res.images[0]);
          const statusText = res.status || (res.isAvailable ? '已完成' : '待补齐');
          return (
            <div key={res.id} className="item-card">
              <div className="cover-wrap">
                {hasCover ? (
                  <img src={res.images[0]} alt="封面" className="cover" />
                ) : (
                  <div className="placeholder">无封面</div>
                )}
                {!hasCover && <span className="badge warning">待完成</span>}
              </div>
              <h4>{res.name}</h4>
              <p>状态：{statusText}</p>
              <p className="muted">{res.description || '暂无描述'}</p>
              {(res.tags || []).length > 0 && (
                <p className="muted">标签：{(res.tags || []).join('，')}</p>
              )}
              <Link to={`/resources/${activeTab}/${res.id}`} className="primary-link">
                查看详情
              </Link>
            </div>
          );
        })}
        {resources.length === 0 && <div className="empty">暂无资源，导入分镜后自动创建。</div>}
      </div>
    </div>
  );
};

export default ResourceLibrary;
