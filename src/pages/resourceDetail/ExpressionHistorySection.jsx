import React from 'react';

const ExpressionHistorySection = ({ historyQuery, setHistoryQuery, expressionHistory, handleDownload }) => (
  <div className="card subtle">
    <h3>表情历史记录</h3>
    <div className="row">
      <input
        placeholder="搜索角色或表情"
        value={historyQuery}
        onChange={(e) => setHistoryQuery(e.target.value)}
      />
      <span className="muted">同表情在不同角色间的复用记录</span>
    </div>
    <div className="list">
      {expressionHistory.map((item, idx) => (
        <div key={idx} className="list-item">
          <div>
            <div className="list-title">{item.name || '表情'}</div>
            <div className="muted">角色：{item.character || '未知'}</div>
            <div className="muted">情绪值：{item.value || '-'}</div>
          </div>
          <button type="button" onClick={handleDownload}>
            下载更新规则
          </button>
        </div>
      ))}
      {expressionHistory.length === 0 && <div className="empty">暂无历史记录。</div>}
    </div>
  </div>
);

export default ExpressionHistorySection;