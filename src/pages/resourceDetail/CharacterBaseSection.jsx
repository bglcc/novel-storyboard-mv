import React from 'react';

const CharacterBaseSection = ({
  name,
  normalizeTags,
  resolveFormValue,
  meta,
  priorityPin,
  getCharacterStatus,
  handleOpenEdit
}) => (
  <div className="card-grid">
    <div className="card section-card">
      <div className="section-header">
        <h3>基础信息</h3>
        <button type="button" className="ghost-button" onClick={() => handleOpenEdit('base')}>
          修改
        </button>
      </div>
      <div className="info-grid">
        <div>
          <div className="label">角色名称</div>
          <div className="readonly-field">{name || '未填写'}</div>
        </div>
        <div>
          <div className="label">角色标签</div>
          <div className="readonly-field">{normalizeTags().join('、') || '未填写'}</div>
        </div>
        <div className="span-2">
          <div className="label">角色背景描述</div>
          <div className="readonly-field">{resolveFormValue('persona') || '未填写'}</div>
        </div>
        <div className="span-2">
          <div className="label">性格设定</div>
          <div className="readonly-field multi-line">{meta.personalitySetting || '未填写'}</div>
        </div>
        <div className="span-2">
          <div className="label">成长轨迹</div>
          <div className="readonly-field multi-line">{meta.growthTrajectory || '未填写'}</div>
        </div>
        <div>
          <div className="label">置顶角色</div>
          <div className="readonly-field">{priorityPin ? '是' : '否'}</div>
        </div>
        <div>
          <div className="label">当前状态</div>
          <div className="readonly-field">{getCharacterStatus()}</div>
        </div>
      </div>
    </div>
    <div className="card section-card">
      <h3>角色操作</h3>
      <div className="muted">后续角色整体的操作按钮将集中在此处。</div>
      <div className="action-hint">当前暂无更多可用操作。</div>
    </div>
  </div>
);

export default CharacterBaseSection;