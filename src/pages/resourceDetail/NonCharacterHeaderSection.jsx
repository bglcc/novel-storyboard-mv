import React from 'react';

const NonCharacterHeaderSection = ({
  isEditingTitle,
  draftTitle,
  setDraftTitle,
  setName,
  setIsEditingTitle,
  name,
  typeLabels,
  type,
  resource,
  handleBack
}) => (
  <div className="resource-header">
    <div className="resource-title">
      {isEditingTitle ? (
        <div className="title-edit">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="资源名称"
          />
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setName(draftTitle.trim());
              setIsEditingTitle(false);
            }}
          >
            保存
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setDraftTitle(name);
              setIsEditingTitle(false);
            }}
          >
            取消
          </button>
        </div>
      ) : (
        <div className="title-row">
          <h2>{typeLabels[type]} - {resource.name}</h2>
          <button type="button" className="text-link" onClick={() => setIsEditingTitle(true)}>
            修改
          </button>
        </div>
      )}
    </div>
    <div className="resource-header-actions">
      <button type="button" className="ghost-button" onClick={handleBack}>
        返回列表
      </button>
    </div>
  </div>
);

export default NonCharacterHeaderSection;