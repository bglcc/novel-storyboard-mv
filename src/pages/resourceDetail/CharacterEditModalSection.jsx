import React from 'react';

const CharacterEditModalSection = ({
  editingSection,
  name,
  setName,
  tags,
  setTags,
  resolveFormValue,
  updateFormValue,
  meta,
  setMeta,
  priorityPin,
  setPriorityPin,
  draftReferences,
  data,
  getCharacterFormOptions,
  setDraftReferences,
  createAssetId,
  handleCloseEdit,
  handleSaveEdit
}) => (
  <div className="modal">
    <div className="modal-content">
      <div className="modal-header">
        <h3>编辑{editingSection === 'base' ? '基础信息' : editingSection === 'formInfo' ? '形态信息' : '参考人物'}</h3>
      </div>
      {editingSection === 'base' && (
        <div className="form-grid cols-2">
          <label>
            角色名称
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            角色标签（逗号分隔）
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          <label className="span-2">
            角色背景描述
            <textarea
              value={resolveFormValue('persona')}
              onChange={(e) => updateFormValue('persona', e.target.value)}
              className="large-input"
            />
          </label>
          <label className="span-2">
            性格设定
            <textarea
              value={meta.personalitySetting || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, personalitySetting: e.target.value }))}
              className="large-input"
            />
          </label>
          <label className="span-2">
            成长轨迹
            <textarea
              value={meta.growthTrajectory || ''}
              onChange={(e) => setMeta((prev) => ({ ...prev, growthTrajectory: e.target.value }))}
              className="large-input"
            />
          </label>
          <label>
            置顶角色
            <select value={priorityPin ? 'yes' : 'no'} onChange={(e) => setPriorityPin(e.target.value === 'yes')}>
              <option value="no">否</option>
              <option value="yes">是</option>
            </select>
          </label>
        </div>
      )}
      {editingSection === 'formInfo' && (
        <div className="form-grid cols-1">
          <label>
            人设
            <textarea
              value={resolveFormValue('persona')}
              onChange={(e) => updateFormValue('persona', e.target.value)}
              className="large-input"
            />
          </label>
          <label>
            外貌描写（导出提示词）
            <textarea
              value={resolveFormValue('appearance')}
              onChange={(e) => updateFormValue('appearance', e.target.value)}
              className="large-input"
            />
          </label>
        </div>
      )}
      {editingSection === 'references' && (
        <div className="reference-editor">
          {draftReferences.length === 0 && <div className="empty">暂无参考人物，请添加。</div>}
          {draftReferences.map((item, idx) => {
            const character = data.resources.characters.find((entry) => entry.id === item.characterId);
            const formOptions = getCharacterFormOptions(character);
            return (
              <div key={item.id || idx} className="reference-editor-row">
                <label>
                  参考角色
                  <select
                    value={item.characterId || ''}
                    onChange={(e) => {
                      const next = [...draftReferences];
                      next[idx].characterId = e.target.value;
                      const targetCharacter = data.resources.characters.find((entry) => entry.id === e.target.value);
                      next[idx].formName = getCharacterFormOptions(targetCharacter)[0];
                      setDraftReferences(next);
                    }}
                  >
                    <option value="">请选择角色</option>
                    {data.resources.characters.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  参考形态
                  <select
                    value={item.formName || formOptions[0]}
                    onChange={(e) => {
                      const next = [...draftReferences];
                      next[idx].formName = e.target.value;
                      setDraftReferences(next);
                    }}
                  >
                    {formOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  参考目标
                  <input
                    value={item.target || ''}
                    onChange={(e) => {
                      const next = [...draftReferences];
                      next[idx].target = e.target.value;
                      setDraftReferences(next);
                    }}
                  />
                </label>
                <label>
                  权重值
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={item.weight ?? 50}
                    onChange={(e) => {
                      const next = [...draftReferences];
                      next[idx].weight = Number(e.target.value);
                      setDraftReferences(next);
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.weight ?? 50}
                    onChange={(e) => {
                      const next = [...draftReferences];
                      next[idx].weight = Number(e.target.value);
                      setDraftReferences(next);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setDraftReferences((prev) => prev.filter((_, refIdx) => refIdx !== idx))}
                >
                  删除
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setDraftReferences((prev) => [
                ...prev,
                { id: createAssetId(), characterId: '', formName: '', target: '', weight: 50 }
              ])
            }
          >
            添加参考人物
          </button>
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={handleCloseEdit}>
          取消
        </button>
        <button type="button" onClick={handleSaveEdit}>
          确认
        </button>
      </div>
    </div>
  </div>
);

export default CharacterEditModalSection;