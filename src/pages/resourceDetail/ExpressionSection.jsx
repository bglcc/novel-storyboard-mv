import React from 'react';

const ExpressionSection = ({
  expressionTabs,
  expressionTab,
  setExpressionTab,
  expressionStatus,
  meta,
  setMeta,
  scopeOptions,
  riskOptions,
  strategyOptions,
  description,
  setDescription,
  expressionPreviewImage,
  resource,
  handleUpdateMeta,
  handleExpressionRuleUpload,
  expressionRuleText,
  setExpressionRuleText,
  handleExpressionRuleSave,
  mainExpressionAsset,
  handleExpressionAssetUpload,
  transferQuery,
  setTransferQuery,
  expressionTransferRequests,
  openPreview,
  expressionTransferRefs,
  handleExpressionTransferUpload,
  handleExpressionTransferDownload
}) => (
<div className="stack">
  <div className="tabs">
    {expressionTabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        className={expressionTab === tab.key ? 'tab active' : 'tab'}
        onClick={() => setExpressionTab(tab.key)}
      >
        {tab.label}
        {tab.key === 'transfer' && expressionStatus !== '已完成' && <span className="tab-dot" />}
      </button>
    ))}
  </div>
  {expressionTab === 'base' && (
    <div className="stack">
      <div className="expression-base-layout">
        <div className="stack">
          <div className="row">
            <label>
              情绪类型
              <input
                value={meta.emotionType || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, emotionType: e.target.value }))}
                placeholder="如：开心、愤怒"
              />
            </label>
            <label>
              情绪值
              <input
                value={meta.emotionValue || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, emotionValue: e.target.value }))}
                placeholder="如：80%"
              />
            </label>
            <label>
              匹配背景
              <input
                value={meta.background || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, background: e.target.value }))}
                placeholder="适用场景/背景"
              />
            </label>
          </div>
          <div className="row">
            <label>
              表情分类
              <input
                value={meta.category || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="如：情绪爆发类"
              />
            </label>
            <label>
              适用范围
              <select
                value={meta.scope || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, scope: e.target.value }))}
              >
                {scopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              风险等级
              <select
                value={meta.riskLevel || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, riskLevel: e.target.value }))}
              >
                {riskOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              生图策略
              <select
                value={meta.strategy || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, strategy: e.target.value }))}
              >
                <option value="">选择策略</option>
                {strategyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            表情描述
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="large-input"
              placeholder="描述表情的适用场景与表现重点。"
            />
          </label>
          <div className="row">
            <label>
              模板动漫来源
              <input
                value={meta.templateAnime || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, templateAnime: e.target.value }))}
              />
            </label>
            <label>
              模板角色
              <input
                value={meta.templateCharacter || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, templateCharacter: e.target.value }))}
              />
            </label>
            <label>
              模板表情描述
              <input
                value={meta.templateExpression || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, templateExpression: e.target.value }))}
              />
            </label>
          </div>
          <div className="row">
            <label>
              表情卡片归纳方式
              <select
                value={expressionGrouping}
                onChange={(e) => setMeta((prev) => ({ ...prev, expressionGrouping: e.target.value }))}
              >
                <option value="group">多个情绪值合并一张卡片</option>
                <option value="split">每个情绪值独立卡片</option>
              </select>
            </label>
            <label>
              推荐镜头（逗号分隔）
              <input
                value={(meta.shotRecommendation || []).join(', ')}
                onChange={(e) =>
                  setMeta((prev) => ({
                    ...prev,
                    shotRecommendation: e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  }))
                }
                placeholder="closeup, medium"
              />
            </label>
            <label>
              禁止事项
              <input
                value={meta.prohibitions || ''}
                onChange={(e) => setMeta((prev) => ({ ...prev, prohibitions: e.target.value }))}
              />
            </label>
          </div>
        </div>
        <div className="expression-preview-panel">
          {expressionPreviewImage ? (
            <img src={expressionPreviewImage} alt="颜艺示例" className="expression-preview-image" />
          ) : (
            <div className="expression-preview-placeholder">暂无示例图</div>
          )}
        </div>
      </div>
      <div className="card subtle">
        <h3>分镜推荐用法</h3>
        <textarea
          className="large-input"
          readOnly
          value={`使用场景：${description || ''}\n镜头建议：${(meta.shotRecommendation || []).join(' / ') || '特写'}\n用词建议：眼睛爆裂、牙关紧咬、额头青筋\n组合建议：可搭配汗滴/阴影遮眼特效，但不要叠加另一种颜艺`}
        />
        <button type="button" onClick={() => navigator.clipboard.writeText(resource.id)}>
          复制模板
        </button>
      </div>
      <div className="row align-right">
        <div className="status-chip">当前状态：{expressionStatus}</div>
        <button type="button" onClick={handleUpdateMeta}>
          更新表情信息
        </button>
      </div>
    </div>
  )}
  {expressionTab === 'assets' && (
    <div className="expression-asset-layout">
      <div className="card subtle expression-rule-panel">
        <div className="section-header">
          <h3>规则说明</h3>
          <label className="file-button">
            上传规则
            <input type="file" accept=".txt" onChange={handleExpressionRuleUpload} />
          </label>
        </div>
        <textarea
          value={expressionRuleText}
          onChange={(e) => setExpressionRuleText(e.target.value)}
          className="large-input"
          placeholder="请在此填写颜艺生成规则（自然语言描述即可）。"
        />
        <div className="row align-right">
          <button type="button" onClick={handleExpressionRuleSave}>
            保存规则
          </button>
        </div>
      </div>
      <div className="card subtle expression-image-panel">
        <h3>主参考图</h3>
        {mainExpressionAsset?.src ? (
          <img src={mainExpressionAsset.src} alt="主参考" className="expression-main-image" />
        ) : (
          <div className="expression-main-placeholder">请上传主参考图</div>
        )}
        <label className="file-button">
          上传主图
          <input type="file" accept="image/*" onChange={handleExpressionAssetUpload('main')} />
        </label>
      </div>
    </div>
  )}
  {expressionTab === 'transfer' && (
    <div className="stack">
      <div className="row card-actions">
        <div className="row">
          <input
            value={transferQuery}
            onChange={(e) => setTransferQuery(e.target.value)}
            placeholder="搜索角色或表情"
          />
        </div>
      </div>
      <div className="expression-transfer-grid">
        {expressionTransferRequests.length === 0 && (
          <div className="empty">暂无生图包需求卡片。</div>
        )}
        {expressionTransferRequests.map((item) => (
          <div key={item.id} className="expression-transfer-card">
            {(() => {
              const previewSrc = item.image || item.cover || '';
              return (
                <>
            <button
              type="button"
              className="expression-transfer-preview"
              onClick={() => {
                if (previewSrc) {
                  openPreview(previewSrc, item.name || '表情需求');
                } else {
                  expressionTransferRefs.current[item.id]?.click();
                }
              }}
            >
              {previewSrc ? (
                <img src={previewSrc} alt={item.name || '生图包'} />
              ) : (
                <div className="expression-transfer-placeholder">待生成</div>
              )}
              {!previewSrc && <span className="status-dot" />}
            </button>
            <div className="expression-transfer-title">{item.name || '颜艺生图包'}</div>
            <div className="expression-transfer-meta">{item.character || '未指定角色'}</div>
            <div className="row">
              <label className="file-button">
                上传
                <input
                  type="file"
                  accept="image/*"
                  ref={(el) => {
                    expressionTransferRefs.current[item.id] = el;
                  }}
                  onChange={handleExpressionTransferUpload(item.id)}
                />
              </label>
              <button type="button" onClick={() => handleExpressionTransferDownload(item)} disabled={!previewSrc}>
                下载
              </button>
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  )}
  <div className="muted">当前状态：{expressionStatus}</div>
</div>
);

export default ExpressionSection;