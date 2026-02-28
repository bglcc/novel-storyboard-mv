import React from 'react';

const CharacterRelationsSection = ({
  handleRelationshipExport,
  handleRelationshipImport,
  relationNodes,
  relationPositions,
  relationImageMap,
  setFocusedRelation,
  resolveReferenceImage,
  resource,
  focusedRelation,
  resolveRelationByTarget
}) => (
  <div className="card section-card">
    <div className="section-header">
      <h3>关系网</h3>
      <div className="resource-header-actions">
        <button type="button" className="ghost-button" onClick={handleRelationshipExport}>
          导出关系网
        </button>
        <label className="file-button">
          导入关系网
          <input type="file" accept="application/json" onChange={handleRelationshipImport} />
        </label>
      </div>
    </div>
    <div className="relation-board">
      {relationNodes.length ? (
        <div className="relation-network">
          <svg className="relation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            {relationPositions.map((node) => (
              <line key={`line-${node.key}`} x1="50" y1="50" x2={node.position.x} y2={node.position.y} />
            ))}
          </svg>
          {relationPositions.map((node) => {
            const avatar = relationImageMap.get(node.id || node.name) || '';
            return (
              <button
                key={node.key}
                type="button"
                className="relation-node rich"
                style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
                onClick={() => setFocusedRelation(node)}
              >
                <div className="relation-node-avatar">
                  {avatar ? <img src={avatar} alt={node.name} /> : <div className="placeholder" />}
                </div>
                <div className="relation-node-name">{node.name}</div>
              </button>
            );
          })}
          <div className="relation-center rich">
            <div className="relation-node-avatar">
              {resolveReferenceImage(resource, resource.form?.[0]?.name || '默认形态') ? (
                <img
                  src={resolveReferenceImage(resource, resource.form?.[0]?.name || '默认形态')}
                  alt={resource.name}
                />
              ) : (
                <div className="placeholder" />
              )}
            </div>
            <div className="relation-node-name">{resource.name}</div>
          </div>
        </div>
      ) : (
        <div className="empty">暂无关系网数据，可导入 JSON 进行展示。</div>
      )}
    </div>
    {focusedRelation && (
      <div className="relation-focus">
        <div className="relation-focus-node">{focusedRelation.name}</div>
        <div className="relation-focus-card">
          {(() => {
            const relationDetail = resolveRelationByTarget(focusedRelation);
            return (
              <>
                <div className="label">
                  {resource.name} ⇄ {focusedRelation.name}
                </div>
                <div className="muted">{relationDetail?.relation || '关系待补充'}</div>
                {(relationDetail?.emotions || []).map((emotion, idx) => (
                  <div key={idx} className="muted">
                    {emotion.label}：{emotion.value}
                  </div>
                ))}
                {relationDetail?.currentEmotion && (
                  <div className="muted">当下情绪：{relationDetail.currentEmotion}</div>
                )}
                {relationDetail?.cause && <div className="muted">前因：{relationDetail.cause}</div>}
                {relationDetail?.consequence && <div className="muted">后果：{relationDetail.consequence}</div>}
              </>
            );
          })()}
        </div>
        <div className="relation-focus-node">{resource.name}</div>
      </div>
    )}
  </div>
);

export default CharacterRelationsSection;