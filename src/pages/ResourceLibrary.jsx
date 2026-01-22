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
  const queryNovelId = new URLSearchParams(location.search).get('novelId') || '';
  const validTabs = useMemo(() => tabs.map((t) => t.key), []);
  const initialTab = validTabs.includes(queryTab) ? queryTab : 'characters';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tagFilter, setTagFilter] = useState('');
  const storedNovelId = localStorage.getItem('resource-library-selected-novel') || '';
  const [selectedNovelId, setSelectedNovelId] = useState(queryNovelId || storedNovelId);

  const novels = data.novels || [];

  useEffect(() => {
    const nextTab = validTabs.includes(queryTab) ? queryTab : 'characters';
    setActiveTab(nextTab);
  }, [queryTab, validTabs]);

  useEffect(() => {
    if (!novels.length) {
      setSelectedNovelId('');
      return;
    }
    if (queryNovelId) {
      setSelectedNovelId(queryNovelId);
      localStorage.setItem('resource-library-selected-novel', queryNovelId);
      return;
    }
    if (!selectedNovelId) {
      const fallback = novels[0]?.id || '';
      setSelectedNovelId(fallback);
      if (fallback) {
        localStorage.setItem('resource-library-selected-novel', fallback);
      }
    }
  }, [novels, queryNovelId, selectedNovelId]);

  const resources = (data.resources?.[activeTab] || []).filter((res) => {
    const missingOk = showMissing ? res.status === '待补齐' || res.isAvailable === false : true;
    const tags = (res.tags || []).join(',').toLowerCase();
    const byTag = tagFilter ? tags.includes(tagFilter.toLowerCase()) : true;
    if (activeTab === 'characters' && selectedNovelId) {
      return missingOk && byTag && (!res.novelId || res.novelId === selectedNovelId);
    }
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
      const formViews = res.form?.[0]?.viewAssets || [];
      const front = formViews.find((asset) => asset.viewAngle === '正面');
      return (
        getLatestAsset(res)?.src ||
        front?.src ||
        formViews?.[0]?.src ||
        res.meta?.viewAssets?.[0]?.src ||
        firstImage?.src ||
        firstImage
      );
    }
    if (activeTab === 'expressions') {
      const requestImage =
        res.meta?.expressionTransferRequests?.find((item) => item.image || item.cover)?.image ||
        res.meta?.expressionTransferRequests?.find((item) => item.image || item.cover)?.cover ||
        '';
      if (requestImage) return requestImage;
      const previewCharacter = data.resources.characters?.[0];
      const previewImage =
        previewCharacter?.form?.[0]?.viewAssets?.find((asset) => asset.viewAngle === '正面')?.src ||
        previewCharacter?.form?.[0]?.viewAssets?.[0]?.src ||
        previewCharacter?.meta?.viewAssets?.[0]?.src ||
        previewCharacter?.images?.[0];
      return previewImage || '';
    }
    if (activeTab === 'scenes') {
      const firstImage = res.images?.[0];
      const variantImage =
        res.meta?.sceneVariants?.[0]?.images?.[0]?.src ||
        res.meta?.sceneVariants?.[0]?.images?.[0];
      return variantImage || firstImage?.src || firstImage;
    }
    if (activeTab === 'props') {
      const firstImage = res.images?.[0];
      const variantImage =
        res.meta?.propVariants?.[0]?.images?.[0]?.src ||
        res.meta?.propVariants?.[0]?.images?.[0];
      return variantImage || firstImage?.src || firstImage;
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
      {activeTab === 'characters' && (
        <div className="row" style={{ marginBottom: '16px' }}>
          <label>
            选择小说
            <select
              value={selectedNovelId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedNovelId(next);
                localStorage.setItem('resource-library-selected-novel', next);
                navigate(`/resources?tab=characters&novelId=${next}`);
              }}
              disabled={novels.length === 0}
            >
              {novels.length === 0 && <option value="">暂无小说</option>}
              {novels.map((novel) => (
                <option key={novel.id} value={novel.id}>
                  {novel.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="grid fixed-four">
        {resources.map((res) => {
          const coverImage = resolveCoverImage(res);
          const hasCover = Boolean(coverImage);
          const statusText =
            activeTab === 'characters'
              ? getCharacterStatus(res)
              : res.status || (res.isAvailable ? '已完成' : '待补齐');
          const novelParam =
            activeTab === 'characters' && selectedNovelId ? `?novelId=${selectedNovelId}` : '';
          return (
            <ResourceCard
              key={res.id}
              resource={res}
              coverImage={coverImage}
              hasCover={hasCover}
              statusText={statusText}
              onEdit={() => navigate(`/resources/${activeTab}/${res.id}${novelParam}`)}
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
