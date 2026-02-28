import React from 'react';

const SceneSection = ({
  sceneTab,
  setSceneTab,
  handleSceneRuleExport,
  handleSceneRuleImport,
  handleSceneEditOpen,
  sceneLayout,
  sceneDescription,
  sceneElementDetails,
  sceneVariants,
  sortedSceneVariants,
  resource,
  getSceneVariantRequirements,
  hasSceneVariantMissing,
  openPreview,
  sceneInputRefs,
  handleSceneVariantImageUpload,
  handleSceneVariantExport,
  handleSceneVariantBatchUpload
}) => (
  <div className="stack">
    <div className="resource-tabs">
      {[
        { key: 'structure', label: '场景结构图展示' },
        { key: 'images', label: '图片管理' }
      ].map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={sceneTab === tab.key ? 'tab active' : 'tab'}
          onClick={() => setSceneTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
    <div className="card section-card">
      <div className="section-header">
        <h3>场景规则库</h3>
        <div className="resource-header-actions">
          <button type="button" className="ghost-button" onClick={handleSceneRuleExport}>
            下载场景规则包
          </button>
          <label className="file-button">
            上传场景资源包
            <input type="file" accept="application/json" onChange={handleSceneRuleImport} />
          </label>
        </div>
      </div>
      <div className="muted">导入/导出场景结构、画面描述与规则信息。</div>
    </div>
    {sceneTab === 'structure' && (
      <div className="card section-card">
        <div className="section-header">
          <h3>场景结构图展示</h3>
          <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('structure')}>
            修改
          </button>
        </div>
        <div className="scene-preview scene-readonly">
          <div className="scene-preview-header">结构图展示</div>
          <div className="scene-canvas scene-canvas-grid">
            {sceneLayout.elements.length === 0 && <div className="empty">暂无结构图元素，等待分镜AI回传。</div>}
            {sceneLayout.elements.map((element, index) => {
              const left = `${(element.x || 0) * 100}%`;
              const top = `${(element.y || 0) * 100}%`;
              if (element.type === 'character') {
                return (
                  <div
                    key={element.id || `${element.name}-${left}-${index}`}
                    className="scene-node character-node"
                    style={{ left, top, transform: `translate(-50%, -50%) rotate(${element.direction || 0}deg)` }}
                  >
                    <span>{element.name}</span>
                  </div>
                );
              }
              return (
                <div key={element.id || `${element.name}-${left}-${index}`} className="scene-node" style={{ left, top }}>
                  {element.name}
                </div>
              );
            })}
          </div>
        </div>
        <div className="scene-description">
          <div className="section-header">
            <h3>画面描述</h3>
            <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('description')}>
              修改
            </button>
          </div>
          <div className="info-stack">
            <div>
              <div className="label">场景整体描述</div>
              <div className="readonly-field multi-line">{sceneDescription || '未填写'}</div>
            </div>
            <div>
              <div className="label">元素详述</div>
              {sceneElementDetails.length === 0 && <div className="empty">暂无元素详述。</div>}
              {sceneElementDetails.map((detail, idx) => (
                <div key={idx} className="readonly-field multi-line scene-detail-card">
                  <strong>{detail.element}</strong>
                  <div>{detail.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    {sceneTab === 'images' && (
      <div className="stack">
        {sceneVariants.length === 0 && (
          <div className="card section-card">
            <div className="empty">暂无场景版本，请等待分镜头AI回传需求。</div>
          </div>
        )}
        {sortedSceneVariants.map((variant, variantIndex) => {
          const titleParts = [variant.name || resource.name || '场景', variant.season, variant.weather, variant.time].filter(Boolean);
          const images = variant.images || [];
          const displayCards = getSceneVariantRequirements(variant);
          const variantMissing = hasSceneVariantMissing(variant);
          const variantKey = variant.id || `${variant.name || 'variant'}-${variantIndex}`;
          return (
            <div key={variantKey} className={`card section-card ${variantMissing ? 'variant-missing' : ''}`}>
              <div className="section-header">
                <h3>
                  {titleParts.join('-')}
                  {variantMissing && <span className="status-dot" />}
                </h3>
                <button type="button" className="ghost-button" onClick={() => handleSceneEditOpen('variants')}>
                  修改
                </button>
              </div>
              <div className="scene-variant-grid">
                {displayCards.length === 0 && <div className="empty">暂无图片需求。</div>}
                {displayCards.map((label) => {
                  const image = images.find((img) => img.label === label);
                  const refKey = `${variant.id}-${label}`;
                  return (
                    <div key={`${variant.id}-${label}`} className="scene-variant-card">
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
                            onChange={handleSceneVariantImageUpload(variant.id, label)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="row align-right">
                <button type="button" onClick={() => handleSceneVariantExport(variant)}>
                  下载
                </button>
                <label className="file-button">
                  上传
                  <input
                    type="file"
                    accept="image/*,.zip,application/zip,application/x-zip-compressed"
                    multiple
                    onChange={handleSceneVariantBatchUpload(variant.id, displayCards)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default SceneSection;