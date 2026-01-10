import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';

const emptyRule = () => ({
  id: '',
  tool: '',
  description: '',
  promptTemplate: '',
  parameters: ''
});

const RuleLibrary = () => {
  const { data, upsertRule, deleteRule, importRules } = useData();
  const [draft, setDraft] = useState(emptyRule());
  const [editingId, setEditingId] = useState('');

  const sortedRules = useMemo(
    () => [...(data.rules || [])].sort((a, b) => a.tool.localeCompare(b.tool)),
    [data.rules]
  );

  const handleSave = () => {
    if (!draft.tool.trim()) return;
    const payload = { ...normalizedDraft, id: editingId || draft.id };
    upsertRule(payload);
    setDraft(emptyRule());
    setEditingId('');
  };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setDraft({ ...rule, parameters: JSON.stringify(rule.parameters || {}, null, 2) });
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        importRules(parsed);
      } catch (err) {
        alert('规则文件解析失败，请确认 JSON 格式');
      }
    };
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data.rules || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rules.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleParamChange = (value) => {
    setDraft((prev) => ({ ...prev, parameters: value }));
  };

  const normalizedDraft = {
    ...draft,
    parameters: (() => {
      try {
        return draft.parameters ? JSON.parse(draft.parameters) : {};
      } catch (err) {
        return draft.parameters;
      }
    })()
  };

  return (
    <div className="card">
      <h2>规则库管理</h2>
      <p className="muted">为不同 AI 工具（豆包、Sora2 等）维护提示词与参数，支持导入/导出 JSON。</p>
      <div className="row">
        <label>
          工具名称
          <input
            value={draft.tool}
            onChange={(e) => setDraft((prev) => ({ ...prev, tool: e.target.value }))}
            placeholder="如：豆包、Sora2"
          />
        </label>
        <label>
          规则描述
          <input
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="用途、场景等"
          />
        </label>
      </div>
      <div className="row">
        <label>
          Prompt 模板
          <textarea
            className="large-input"
            value={draft.promptTemplate}
            onChange={(e) => setDraft((prev) => ({ ...prev, promptTemplate: e.target.value }))}
            placeholder="支持占位符的提示词模板"
          />
        </label>
        <label>
          默认参数（JSON）
          <textarea
            className="large-input"
            value={draft.parameters}
            onChange={(e) => handleParamChange(e.target.value)}
            placeholder='例如 {"resolution":"1080p"}'
          />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={handleSave}>
          {editingId ? '更新规则' : '新增规则'}
        </button>
        <button type="button" onClick={handleExport}>导出规则 JSON</button>
        <label className="primary-link" style={{ cursor: 'pointer' }}>
          导入规则 JSON
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        {editingId && (
          <button className="danger" onClick={() => { setDraft(emptyRule()); setEditingId(''); }}>
            取消编辑
          </button>
        )}
      </div>

      <div className="list">
        {sortedRules.map((rule) => (
          <div key={rule.id} className="list-item">
            <div>
              <div className="list-title">{rule.tool}</div>
              <div className="muted">{rule.description || '暂无描述'}</div>
              <div className="muted">参数：{JSON.stringify(rule.parameters || {})}</div>
            </div>
            <div className="row">
              <button onClick={() => handleEdit(rule)}>编辑</button>
              <button className="danger" onClick={() => deleteRule(rule.id)}>删除</button>
            </div>
          </div>
        ))}
        {sortedRules.length === 0 && <div className="empty">尚未配置规则，添加一条吧。</div>}
      </div>
    </div>
  );
};

export default RuleLibrary;
