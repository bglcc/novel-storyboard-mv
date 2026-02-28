import React from 'react';

const ResourceHeader = ({ tagFilter, onTagFilterChange, showMissing, onToggleMissing, onClearTagFilter }) => {
  return (
    <>
      <h2>资源库</h2>
      <p className="muted">按固定分类管理资源，支持标签筛选与待补齐状态过滤。</p>
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
    </>
  );
};

export default ResourceHeader;