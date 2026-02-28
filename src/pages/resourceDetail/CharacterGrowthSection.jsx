import React from 'react';

const CharacterGrowthSection = ({ growthHistory, handleGrowthHistoryExport, handleGrowthHistoryImport }) => (
  <div className="card section-card">
    <div className="section-header">
      <h3>角色成长史</h3>
      <div className="resource-header-actions">
        <button type="button" className="ghost-button" onClick={handleGrowthHistoryExport}>
          导出成长史
        </button>
        <label className="file-button">
          导入成长史
          <input type="file" accept="application/json" onChange={handleGrowthHistoryImport} />
        </label>
      </div>
    </div>
    {growthHistory.length ? (
      <div className="growth-history-timeline">
        {growthHistory.map((entry, index) => (
          <div
            key={`${entry.chapter || 'chapter'}-${index}`}
            className={`growth-history-item ${index % 2 === 0 ? 'left' : 'right'}`}
          >
            <div className="growth-history-node" />
            <div className="growth-history-timeline-card">
              <div className="label">{entry.chapter || '未标注章节'}</div>
              <div className="growth-history-change">{entry.change || '变化待补充'}</div>
              <div className="muted">{entry.description || '暂无描述'}</div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty">暂无成长史数据，可导入 JSON 进行展示。</div>
    )}
  </div>
);

export default CharacterGrowthSection;