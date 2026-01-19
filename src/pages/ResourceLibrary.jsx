import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import ResourceCard from '../components/resources/ResourceCard';
import ResourceHeader from '../components/resources/ResourceHeader';
import ResourceTabs from '../components/resources/ResourceTabs';

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
      const firstImage = res.images?.[0];
      return getLatestAsset(res)?.src || res.meta?.viewImages?.front || firstImage?.src || firstImage;
    }
    const firstImage = res.images?.[0];
    return firstImage?.src || firstImage;
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
      <ResourceHeader
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        activeTab={activeTab}
        showMissing={showMissing}
        onShowAllExpressions={() => navigate('/resources?tab=expressions')}
      />
      <ResourceTabs
        tabs={tabs}
        activeTab={activeTab}
        hasMissingByTab={hasMissingByTab}
        onTabChange={setActiveTab}
      />
      <div className="grid fixed-four">
        {resources.map((res) => {
          const coverImage = resolveCoverImage(res);
          const hasCover = Boolean(coverImage);
          const statusText =
            activeTab === 'characters'
              ? getCharacterStatus(res)
              : res.status || (res.isAvailable ? '已完成' : '待补齐');
          return (
            <ResourceCard
              key={res.id}
              resource={res}
              coverImage={coverImage}
              hasCover={hasCover}
              statusText={statusText}
              onEdit={() => navigate(`/resources/${activeTab}/${res.id}`)}
              onDelete={() => handleDelete(res.id)}
            />
          );
        })}
        {resources.length === 0 && <div className="empty">暂无资源，导入分镜后自动创建。</div>}
      </div>
    </div>
  );
};

export default ResourceLibrary;
