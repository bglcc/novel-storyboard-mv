import React from 'react';

const ResourceCard = ({ resource, coverImage, hasCover, statusText, onEdit, onDelete }) => {
  return (
    <div className="item-card">
      <div className="cover-wrap">
        {hasCover ? (
          <img src={coverImage} alt="封面" className="cover" />
        ) : (
          <div className="placeholder" />
        )}
        {!hasCover && <span className="badge warning">待完成</span>}
        <span className={`badge status ${statusText === '已完成' ? 'success' : 'warning'}`}>
          {statusText}
        </span>
      </div>
      <h4>{resource.name}</h4>
      <p className="muted">{resource.description || '暂无描述'}</p>
      {(resource.tags || []).length > 0 && (
        <p className="muted">标签：{(resource.tags || []).join('，')}</p>
      )}
      <div className="row card-actions">
        <button type="button" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  );
};

export default ResourceCard;
