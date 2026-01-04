import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';

const tabs = [
  { key: 'characters', label: '角色' },
  { key: 'expressions', label: '表情' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' }
];

const ResourceLibrary = () => {
  const { data } = useData();
  const location = useLocation();
  const queryTab = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'characters');

  const resources = data.resources[activeTab] || [];

  return (
    <div className="card">
      <h2>资源库</h2>
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
        {resources.map((res) => (
          <div key={res.id} className="item-card">
            {res.images && res.images[0] ? (
              <img src={res.images[0]} alt="封面" className="cover" />
            ) : (
              <div className="placeholder">无封面</div>
            )}
            <h4>{res.name}</h4>
            <p>状态：{res.status || (res.isAvailable ? '已完成' : '待补齐')}</p>
            <p className="muted">{res.description || '暂无描述'}</p>
            <Link to={`/resources/${activeTab}/${res.id}`} className="primary-link">
              查看详情
            </Link>
          </div>
        ))}
        {resources.length === 0 && <div className="empty">暂无资源，导入分镜后自动创建。</div>}
      </div>
    </div>
  );
};

export default ResourceLibrary;
