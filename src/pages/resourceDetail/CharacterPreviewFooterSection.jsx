import React from 'react';

const CharacterPreviewFooterSection = ({
  previewImage,
  previewLabel,
  closePreview,
  handleBack,
  handleSaveMeta
}) => (
  <>
    {previewImage && (
      <div className="modal" onClick={closePreview}>
        <div className="modal-content image-preview" onClick={(e) => e.stopPropagation()}>
          <div className="section-header">
            <h3>{previewLabel || '图片预览'}</h3>
            <button type="button" className="tab" onClick={closePreview}>
              关闭
            </button>
          </div>
          <div className="image-preview-body">
            <img src={previewImage} alt={previewLabel || '预览图'} />
          </div>
        </div>
      </div>
    )}

    <div className="resource-footer">
      <div className="resource-footer-actions">
        <button type="button" className="ghost-button" onClick={handleBack}>
          返回列表
        </button>
        <button type="button" onClick={handleSaveMeta}>
          保存并返回
        </button>
      </div>
    </div>
  </>
);

export default CharacterPreviewFooterSection;