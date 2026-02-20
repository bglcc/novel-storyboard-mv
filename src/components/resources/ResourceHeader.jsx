import React from 'react';

const ResourceHeader = ({
  tagFilter,
  onTagFilterChange,
  activeTab,
  showMissing,
  onShowAllExpressions,
  onToggleMissing,
  onClearTagFilter
}) => {
  return (
    <>
      <h2>资源库</h2>
      <p className="muted">支持上传透明 PNG、JPG、WebP，并可用于分镜图缺失资源补齐。</p>
      <div className="resource-entry">
        <span className="muted">颜艺形态已并入表情资源库，请在“表情”标签页管理。</span>
      </div>
      <div className="resource-filter-bar">
        <button type="button" className={showMissing ? 'tab active' : 'tab'} onClick={() => onToggleMissing(true)}>
          仅看待补齐
        </button>
        <button type="button" className={showMissing ? 'tab' : 'tab active'} onClick={() => onToggleMissing(false)}>
          查看全部
        </button>
        <span className={showMissing ? 'resource-filter-status warning' : 'resource-filter-status'}>
          {showMissing ? '当前仅显示待补齐资源' : '当前显示全部资源'}
        </span>
      </div>
      <div className="row">
        <input
          placeholder="按标签筛选，逗号分隔"
          value={tagFilter}
          onChange={(e) => onTagFilterChange(e.target.value)}
        />
        {tagFilter && (
          <button type="button" className="ghost-button" onClick={onClearTagFilter}>
            清空标签筛选
          </button>
        )}
      </div>
      <div className="row">
        <span className="muted">自动提取首张图片为封面，缺少则显示占位图。</span>
      </div>
      {activeTab === 'expressions' && (
        <div className="row">
          {showMissing && (
            <button type="button" className="ghost-button" onClick={onShowAllExpressions}>
              查看全部表情
            </button>
          )}
          <span className="muted">表情资源用于统一管理颜艺形态与生成规则。</span>
        </div>
      )}
    </>
  );
};

export default ResourceHeader;
