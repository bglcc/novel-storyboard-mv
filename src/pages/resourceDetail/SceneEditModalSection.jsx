import React from 'react';

const SceneEditModalSection = ({
  sceneEditingSection,
  sceneDraft,
  setSceneDraft,
  handleSceneEditClose,
  handleSceneEditSave
}) => (
  <div className="modal">
    <div className="modal-content">
      <div className="modal-header">
        <h3>
          编辑
          {sceneEditingSection === 'structure' ? '场景结构图' : sceneEditingSection === 'description' ? '画面描述' : '场景版本'}
        </h3>
      </div>
      {sceneEditingSection === 'structure' && (
        <label>
          场景结构 JSON
          <textarea
            className="large-input"
            value={JSON.stringify(sceneDraft.sceneLayout || { elements: [] }, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value || '{}');
                setSceneDraft((prev) => ({ ...prev, sceneLayout: parsed }));
              } catch (err) {
                setSceneDraft((prev) => ({ ...prev, sceneLayout: prev.sceneLayout }));
              }
            }}
          />
        </label>
      )}
      {sceneEditingSection === 'description' && (
        <div className="form-grid cols-1">
          <label>
            场景整体描述
            <textarea
              className="large-input"
              value={sceneDraft.sceneDescription || ''}
              onChange={(e) => setSceneDraft((prev) => ({ ...prev, sceneDescription: e.target.value }))}
            />
          </label>
          <label>
            元素详述 JSON（数组）
            <textarea
              className="large-input"
              value={JSON.stringify(sceneDraft.sceneElementDetails || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || '[]');
                  setSceneDraft((prev) => ({ ...prev, sceneElementDetails: parsed }));
                } catch (err) {
                  setSceneDraft((prev) => ({ ...prev }));
                }
              }}
            />
          </label>
        </div>
      )}
      {sceneEditingSection === 'variants' && (
        <label>
          场景版本 JSON（数组）
          <textarea
            className="large-input"
            value={JSON.stringify(sceneDraft.sceneVariants || [], null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value || '[]');
                setSceneDraft((prev) => ({ ...prev, sceneVariants: parsed }));
              } catch (err) {
                setSceneDraft((prev) => ({ ...prev }));
              }
            }}
          />
        </label>
      )}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={handleSceneEditClose}>
          取消
        </button>
        <button type="button" onClick={handleSceneEditSave}>
          确认
        </button>
      </div>
    </div>
  </div>
);

export default SceneEditModalSection;