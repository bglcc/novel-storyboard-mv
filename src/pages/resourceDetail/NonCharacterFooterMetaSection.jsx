import React from 'react';
import ExpressionHistorySection from './ExpressionHistorySection';

const NonCharacterFooterMetaSection = ({
  loading,
  type,
  historyQuery,
  setHistoryQuery,
  expressionHistory,
  handleDownload,
  handleSaveMeta
}) => (
  <>
    {loading && <div className="muted">正在处理...</div>}
    {type === 'expressions' && (
      <ExpressionHistorySection
        historyQuery={historyQuery}
        setHistoryQuery={setHistoryQuery}
        expressionHistory={expressionHistory}
        handleDownload={handleDownload}
      />
    )}

    <div className="row align-right">
      <button onClick={handleSaveMeta}>保存信息并返回资源库</button>
    </div>
  </>
);

export default NonCharacterFooterMetaSection;