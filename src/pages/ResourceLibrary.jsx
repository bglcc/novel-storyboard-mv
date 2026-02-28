import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourceCard from '../components/resources/ResourceCard';
import ResourceHeader from '../components/resources/ResourceHeader';
import ResourceTabs from '../components/resources/ResourceTabs';
import { RESOURCE_CATEGORY_TABS } from '../config/resourceCategories';
import { useData } from '../context/DataContext';
import '../styles/resource.css';

const parseLenientJson = (text) => {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return null;
  return JSON.parse(cleaned);
};

const pickCoverImage = (resource) => {
  if (resource?.cover) return resource.cover;
  if (Array.isArray(resource?.images) && resource.images.length > 0) {
    return resource.images[0]?.src || resource.images[0];
  }
  return '';
};

const normalizeSearchToken = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

const ResourceLibrary = () => {
  const navigate = useNavigate();
  const { data, upsertResource, deleteResource } = useData();
  const characterImportRef = useRef(null);

  const tabs = RESOURCE_CATEGORY_TABS;
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'characters');
  const [showMissing, setShowMissing] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || '资源';

  const hasMissingByTab = useMemo(() => {
    return tabs.reduce((acc, tab) => {
      acc[tab.key] = (data.resources?.[tab.key] || []).some((item) => (item.status || '待补齐') !== '已完成');
      return acc;
    }, {});
  }, [data.resources, tabs]);

  const filteredResources = useMemo(() => {
    const keywordList = tagFilter
      .split(',')
      .map((part) => normalizeSearchToken(part))
      .filter(Boolean);

    return (data.resources?.[activeTab] || []).filter((item) => {
      const status = item.status || '待补齐';
      if (showMissing && status === '已完成') return false;
      if (keywordList.length === 0) return true;

      const textBucket = [item.name || '', ...(item.tags || []), item.description || '']
        .map((entry) => normalizeSearchToken(entry))
        .join(' ');

      return keywordList.every((keyword) => textBucket.includes(keyword));
    });
  }, [activeTab, data.resources, showMissing, tagFilter]);

  const handleImportCharactersJson = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseLenientJson(text);
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed?.characters || parsed?.resources?.characters || [];

      if (!Array.isArray(candidates) || candidates.length === 0) {
        alert('未识别到角色数组，请检查 JSON 结构。');
        return;
      }

      candidates.forEach((item) => {
        const name = item.name || item.characterName || item.title;
        if (!name) return;

        upsertResource('characters', {
          ...item,
          id: item.id || crypto.randomUUID(),
          name,
          description: item.description || item.desc || '',
          images: Array.isArray(item.images) ? item.images : [],
          meta: item.meta || {},
          status: item.status || (item.images?.length ? '已完成' : '待补齐')
        });
      });

      alert(`角色 JSON 导入完成，共处理 ${candidates.length} 条。`);
    } catch (error) {
      alert('角色 JSON 解析失败，请确认格式正确。');
    }
  };

  const createResource = () => {
    const name = window.prompt(`请输入${activeTabLabel}名称`);
    if (!name) return;

    const id = crypto.randomUUID();
    upsertResource(activeTab, {
      id,
      name,
      description: '',
      status: '待补齐',
      images: []
    });

    navigate(`/resources/${activeTab}/${id}`);
  };

  return (
    <div className="stack">
      <div className="card">
        <ResourceHeader
          tagFilter={tagFilter}
          showMissing={showMissing}
          onTagFilterChange={setTagFilter}
          onToggleMissing={setShowMissing}
          onClearTagFilter={() => setTagFilter('')}
        />

        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" onClick={createResource}>
            新增{activeTabLabel}
          </button>
          {activeTab === 'characters' && (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() => characterImportRef.current?.click()}
              >
                上传角色 JSON
              </button>
              <input
                ref={characterImportRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(event) => handleImportCharactersJson(event.target.files?.[0])}
              />
            </>
          )}
        </div>
      </div>

      <div className="card">
        <ResourceTabs
          tabs={tabs}
          activeTab={activeTab}
          hasMissingByTab={hasMissingByTab}
          onTabChange={setActiveTab}
        />

        <div className="grid fixed-four">
          {filteredResources.map((resource) => {
            const coverImage = pickCoverImage(resource);
            const statusText = resource.status || (coverImage ? '已完成' : '待补齐');

            return (
              <ResourceCard
                key={resource.id}
                resource={resource}
                coverImage={coverImage}
                hasCover={Boolean(coverImage)}
                statusText={statusText}
                onEdit={() => navigate(`/resources/${activeTab}/${resource.id}`)}
                onDelete={() => deleteResource(activeTab, resource.id)}
              />
            );
          })}

          <div
            className="item-card add-card"
            role="button"
            tabIndex={0}
            onClick={createResource}
            onKeyDown={(event) => event.key === 'Enter' && createResource()}
          >
            <div className="add-card-inner">
              <span className="add-icon">+</span>
              <span>新增资源</span>
            </div>
          </div>
        </div>

        {filteredResources.length === 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            当前分类「{activeTabLabel}」暂无匹配资源，请尝试清空筛选或新增资源。
          </p>
        )}
      </div>
    </div>
  );
};

export default ResourceLibrary;