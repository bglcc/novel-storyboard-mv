import React from 'react';

const CharacterAppearanceSection = ({
  forms,
  activeFormName,
  setActiveFormName,
  handleOpenEdit,
  resolveFormValue,
  characterReferences,
  data,
  resolveReferenceImage,
  handleCharacterImport,
  handleCharacterExport,
  viewList,
  viewAssets,
  openPreview,
  viewInputRefs,
  handleViewUpload
}) => (
  <div className="card-grid">
    {forms.length > 1 && (
      <div className="sub-tabs">
        {forms.map((form) => (
          <button
            key={form.name}
            type="button"
            className={activeFormName === form.name ? 'tab active' : 'tab'}
            onClick={() => setActiveFormName(form.name)}
          >
            {form.name}
          </button>
        ))}
      </div>
    )}
    <div className="card section-card">
      <div className="section-header">
        <h3>形态信息</h3>
        <button type="button" className="ghost-button" onClick={() => handleOpenEdit('formInfo')}>
          修改
        </button>
      </div>
      <div className="info-stack">
        <div>
          <div className="label">人设</div>
          <div className="readonly-field multi-line">{resolveFormValue('persona') || '未填写'}</div>
        </div>
        <div>
          <div className="label">外貌描写（导出提示词）</div>
          <div className="readonly-field multi-line">{resolveFormValue('appearance') || '未填写'}</div>
        </div>
      </div>
    </div>
    <div className="card section-card">
      <div className="section-header">
        <h3>参考人物</h3>
        <button type="button" className="ghost-button" onClick={() => handleOpenEdit('references')}>
          修改
        </button>
      </div>
      <div className="reference-table">
        <div className="reference-header">
          <div>参考角色</div>
          <div>参考目标</div>
          <div>权重</div>
        </div>
        {characterReferences.length === 0 && <div className="empty">暂无参考人物记录。</div>}
        {characterReferences.map((ref) => {
          const character = data.resources.characters.find((item) => item.id === ref.characterId);
          const formLabel = ref.formName || '默认形态';
          const preview = resolveReferenceImage(character, formLabel);
          return (
            <div key={ref.id} className="reference-row">
              <div className="reference-cell">
                <div className="reference-avatar">
                  {preview ? <img src={preview} alt={character?.name || '参考角色'} /> : <div className="placeholder" />}
                </div>
                <div>
                  <div className="reference-name">{character?.name || '未知角色'}</div>
                  <div className="muted">{formLabel}</div>
                </div>
              </div>
              <div className="reference-cell">{ref.target || '未填写'}</div>
              <div className="reference-cell">{ref.weight ?? 0}%</div>
            </div>
          );
        })}
      </div>
    </div>
    <div className="card section-card">
      <div className="section-header">
        <h3>上传下载</h3>
        <div className="resource-header-actions">
          <label className="file-button">
            导入角色资源包
            <input type="file" accept="application/zip" onChange={handleCharacterImport} />
          </label>
          <button type="button" onClick={handleCharacterExport}>
            导出角色资源包
          </button>
        </div>
      </div>
      {viewList.length === 0 ? (
        <div className="empty">暂无视需求，请等待分镜头AI回传。</div>
      ) : (
        <div className="portrait-grid">
          {viewList.map((viewAngle) => {
            const asset = viewAssets.find((item) => item.viewAngle === viewAngle);
            return (
              <div key={viewAngle} className="portrait-card">
                <button
                  type="button"
                  className="portrait-preview"
                  onClick={() => {
                    if (asset?.src) {
                      openPreview(asset.src, viewAngle);
                    } else {
                      viewInputRefs.current[viewAngle]?.click();
                    }
                  }}
                >
                  {asset?.src ? <img src={asset.src} alt={viewAngle} /> : <div className="portrait-placeholder">暂无图片</div>}
                </button>
                <div className="portrait-meta">
                  <span>{viewAngle}</span>
                  <label className="file-button">
                    上传
                    <input
                      type="file"
                      accept="image/*"
                      ref={(el) => {
                        viewInputRefs.current[viewAngle] = el;
                      }}
                      onChange={handleViewUpload(viewAngle)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

export default CharacterAppearanceSection;