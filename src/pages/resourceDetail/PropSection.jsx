import React from 'react';

const PropSection = ({
  description,
  setDescription,
  propVariants,
  getPropVariantRequirements,
  resource,
  openPreview,
  sceneInputRefs,
  handlePropVariantImageUpload,
  handlePropVariantExport,
  handlePropVariantBatchUpload
}) => (
  <div className="stack">
    <div className="card section-card">
      <div className="section-header">
        <h3>道具描述</h3>
      </div>
      <textarea
        className="large-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="补充道具外观、材质、用途等"
      />
    </div>
    <div className="card section-card">
      <div className="section-header">
        <h3>图片管理</h3>
      </div>
      {propVariants.length === 0 && <div className="empty">暂无需求，请等待分镜头AI回传。</div>}
      {propVariants.map((variant) => {
        const displayCards = getPropVariantRequirements(variant);
        const images = variant.images || [];
        return (
          <div key={variant.id} className="stack">
            <div className="section-header">
              <h4>{variant.name || resource.name || '道具'}</h4>
            </div>
            <div className="scene-variant-grid compact-grid">
              {displayCards.length === 0 && <div className="empty">暂无图片需求。</div>}
              {displayCards.map((label) => {
                const image = images.find((img) => img.label === label);
                const refKey = `${variant.id}-${label}-prop`;
                return (
                  <div key={refKey} className="scene-variant-card compact-card">
                    <button
                      type="button"
                      className="scene-variant-preview"
                      onClick={() => {
                        if (image?.src) {
                          openPreview(image.src, label);
                        } else {
                          sceneInputRefs.current[refKey]?.click();
                        }
                      }}
                    >
                      {image?.src ? <img src={image.src} alt={label} /> : <div className="placeholder">暂无图片</div>}
                    </button>
                    <div className="scene-variant-meta">
                      <span>{label}</span>
                      <label className="file-button">
                        上传
                        <input
                          type="file"
                          accept="image/*"
                          ref={(el) => {
                            sceneInputRefs.current[refKey] = el;
                          }}
                          onChange={handlePropVariantImageUpload(variant.id, label)}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row align-right">
              <button type="button" onClick={() => handlePropVariantExport(variant)}>
                下载
              </button>
              <label className="file-button">
                上传
                <input
                  type="file"
                  accept="image/*,.zip,application/zip,application/x-zip-compressed"
                  multiple
                  onChange={handlePropVariantBatchUpload(variant.id, displayCards)}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default PropSection;