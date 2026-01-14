import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import {
  addExpressionAsset,
  createExpressionAssetId,
  createExpressionRuleId,
  deleteExpressionAsset,
  deleteExpressionForm,
  deleteExpressionRule,
  getExpressionAssets,
  getExpressionForm,
  getExpressionRules,
  upsertExpressionForm,
  upsertExpressionRule
} from '../utils/expressionFormsDb';

const tabs = [
  { key: 'base', label: '基础信息' },
  { key: 'assets', label: '参考图 & 素材管理' },
  { key: 'rules', label: '生图规则' },
  { key: 'storyboard', label: '分镜头推荐用法' },
  { key: 'transfer', label: '导出/导入' }
];

const scopeOptions = [
  { value: 'chibi', label: 'Q版' },
  { value: 'normal', label: '普通比例' },
  { value: 'universal', label: '通用' }
];

const riskOptions = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' }
];

const strategyOptions = [
  { value: 'direct_generate', label: '直接生图' },
  { value: 'img2img_character', label: '图生图' },
  { value: 'hybrid', label: '混合' }
];

const usageOptions = [
  { value: 'source_frame', label: 'source_frame' },
  { value: 'style_ref', label: 'style_ref' },
  { value: 'facial_ref', label: 'facial_ref' },
  { value: 'eye_ref', label: 'eye_ref' },
  { value: 'mouth_ref', label: 'mouth_ref' }
];

const ExpressionFormDetail = () => {
  const { expressionId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('base');
  const [form, setForm] = useState(null);
  const [assets, setAssets] = useState([]);
  const [rules, setRules] = useState([]);
  const [ruleJsonText, setRuleJsonText] = useState('{}');
  const [ruleText, setRuleText] = useState({ prompt: '', negative: '', constraints: '', params: '' });
  const [loading, setLoading] = useState(false);
  const missingRef = useRef(null);

  const loadData = async () => {
    const base = await getExpressionForm(expressionId);
    if (!base) return;
    setForm(base);
    const assetList = await getExpressionAssets(expressionId);
    const ruleList = await getExpressionRules(expressionId);
    setAssets(assetList.sort((a, b) => (a.order || 0) - (b.order || 0)));
    setRules(ruleList.sort((a, b) => (b.version || 0) - (a.version || 0)));
    if (ruleList[0]) {
      setRuleJsonText(JSON.stringify(ruleList[0].ruleJson || {}, null, 2));
      setRuleText({
        prompt: ruleList[0].promptTemplate || '',
        negative: ruleList[0].negativePrompt || '',
        constraints: ruleList[0].constraints || '',
        params: ruleList[0].recommendedParamsText || ''
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [expressionId]);

  const mainAsset = useMemo(
    () => assets.find((asset) => asset.type === 'main'),
    [assets]
  );

  const status = useMemo(() => {
    if (!mainAsset) return 'todo';
    if (!form?.strategy) return 'todo';
    if (!ruleText.prompt.trim()) return 'todo';
    try {
      const parsed = JSON.parse(ruleJsonText || '{}');
      if (!parsed || Object.keys(parsed).length === 0) return 'todo';
    } catch (e) {
      return 'todo';
    }
    return 'ready';
  }, [mainAsset, form, ruleJsonText, ruleText.prompt]);

  useEffect(() => {
    if (status === 'todo' && missingRef.current) {
      missingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status]);

  if (!form) return <div className="card">未找到颜艺形态。</div>;

  const handleSave = async () => {
    const updated = {
      ...form,
      status,
      updatedAt: Date.now()
    };
    await upsertExpressionForm(updated);
    setForm(updated);
  };

  const handleRuleSave = async () => {
    let parsedRule = {};
    try {
      parsedRule = JSON.parse(ruleJsonText || '{}');
    } catch (e) {
      alert('规则 JSON 格式不正确');
      return;
    }
    const nextVersion = (rules[0]?.version || 0) + 1;
    const rule = {
      ruleId: createExpressionRuleId(),
      expressionId,
      strategy: form.strategy,
      promptTemplate: ruleText.prompt,
      negativePrompt: ruleText.negative,
      constraints: ruleText.constraints,
      recommendedParamsText: ruleText.params,
      ruleJson: parsedRule,
      version: nextVersion,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await upsertExpressionRule(rule);
    await loadData();
  };

  const handleDeleteRule = async (ruleId) => {
    await deleteExpressionRule(ruleId);
    await loadData();
  };

  const handleAssetUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const asset = {
      assetId: createExpressionAssetId(),
      expressionId,
      type,
      usage: 'source_frame',
      note: '',
      blob: file,
      order: type === 'main' ? 0 : assets.filter((a) => a.type === 'aux').length + 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await addExpressionAsset(asset);
    await loadData();
  };

  const handleAssetUpdate = async (assetId, updates) => {
    const target = assets.find((asset) => asset.assetId === assetId);
    if (!target) return;
    await addExpressionAsset({ ...target, ...updates, updatedAt: Date.now() });
    await loadData();
  };

  const handleAssetDelete = async (assetId) => {
    await deleteExpressionAsset(assetId);
    await loadData();
  };

  const handleAssetMove = async (assetId, direction) => {
    const auxAssets = assets.filter((asset) => asset.type === 'aux');
    const index = auxAssets.findIndex((asset) => asset.assetId === assetId);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= auxAssets.length) return;
    const current = auxAssets[index];
    const target = auxAssets[swapIndex];
    await addExpressionAsset({ ...current, order: target.order, updatedAt: Date.now() });
    await addExpressionAsset({ ...target, order: current.order, updatedAt: Date.now() });
    await loadData();
  };

  const handleExportZip = async () => {
    setLoading(true);
    const zip = new JSZip();
    const folder = zip.folder(`ExpressionForms/${form.id}`);
    const refsFolder = folder.folder('refs');
    const rulesFolder = folder.folder('rules');
    const metaAssets = [];
    for (const asset of assets) {
      if (!asset.blob) continue;
      const extension = asset.blob.type.split('/')[1] || 'png';
      const fileName = asset.type === 'main' ? 'main' : `aux_${asset.order || 1}`;
      const fullName = `${fileName}.${extension}`;
      const buffer = await asset.blob.arrayBuffer();
      refsFolder.file(fullName, buffer);
      metaAssets.push({
        file: fullName,
        type: asset.type,
        usage: asset.usage,
        note: asset.note,
        order: asset.order
      });
    }
    const meta = {
      id: form.id,
      name: form.name,
      category: form.category,
      tags: form.tags,
      scope: form.scope,
      riskLevel: form.riskLevel,
      templateAnime: form.templateAnime,
      templateCharacter: form.templateCharacter,
      templateExpression: form.templateExpression,
      status: status,
      description: form.description,
      assets: metaAssets,
      rules: rules.map((rule) => ({
        version: rule.version,
        strategy: rule.strategy,
        files: [`rule_v${rule.version}.json`, `rule_v${rule.version}.txt`]
      }))
    };
    folder.file('meta.json', JSON.stringify(meta, null, 2));
    rules.forEach((rule) => {
      rulesFolder.file(`rule_v${rule.version}.json`, JSON.stringify(rule.ruleJson || {}, null, 2));
      rulesFolder.file(
        `rule_v${rule.version}.txt`,
        [rule.promptTemplate || '', '\n\n', rule.negativePrompt || '', '\n\n', rule.constraints || ''].join('')
      );
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.name || form.id}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  const handleImportZip = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const zip = await JSZip.loadAsync(file);
    const metaFile = zip.file(`ExpressionForms/${expressionId}/meta.json`);
    if (!metaFile) {
      alert('未找到 meta.json');
      setLoading(false);
      return;
    }
    const meta = JSON.parse(await metaFile.async('string'));
    const now = Date.now();
    const updated = {
      ...form,
      ...meta,
      id: form.id,
      updatedAt: now,
      createdAt: form.createdAt || now
    };
    await upsertExpressionForm(updated);
    for (const asset of meta.assets || []) {
      const refFile = zip.file(`ExpressionForms/${expressionId}/refs/${asset.file}`);
      if (!refFile) continue;
      const blob = await refFile.async('blob');
      await addExpressionAsset({
        assetId: createExpressionAssetId(),
        expressionId,
        type: asset.type,
        usage: asset.usage,
        note: asset.note,
        blob,
        order: asset.order,
        createdAt: now,
        updatedAt: now
      });
    }
    for (const ruleMeta of meta.rules || []) {
      const jsonFile = zip.file(`ExpressionForms/${expressionId}/rules/${ruleMeta.files[0]}`);
      const txtFile = zip.file(`ExpressionForms/${expressionId}/rules/${ruleMeta.files[1]}`);
      const ruleJson = jsonFile ? JSON.parse(await jsonFile.async('string')) : {};
      const text = txtFile ? await txtFile.async('string') : '';
      await upsertExpressionRule({
        ruleId: createExpressionRuleId(),
        expressionId,
        strategy: ruleMeta.strategy,
        promptTemplate: text.split('\n\n')[0] || '',
        negativePrompt: text.split('\n\n')[1] || '',
        constraints: text.split('\n\n')[2] || '',
        recommendedParamsText: '',
        ruleJson,
        version: ruleMeta.version,
        createdAt: now,
        updatedAt: now
      });
    }
    await loadData();
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('确认删除该颜艺形态？')) return;
    await deleteExpressionForm(expressionId);
    navigate('/expression-forms');
  };

  return (
    <div className="card">
      <div className="space-between">
        <div>
          <h2>颜艺形态详情</h2>
          <div className="muted">ID: {form.id}</div>
        </div>
        <div className="row">
          <button type="button" onClick={handleSave}>保存</button>
          <button type="button" className="danger" onClick={handleDelete}>删除</button>
          <button type="button" onClick={() => navigate('/expression-forms')}>返回列表</button>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'base' && (
        <div className="stack" ref={missingRef}>
          <div className="row">
            <label>
              表情名称
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              表情 ID
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
            </label>
            <label>
              分类
              <input
                value={form.category || ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
          </div>
          <div className="row">
            <label>
              模板动漫来源
              <input
                value={form.templateAnime || ''}
                onChange={(e) => setForm({ ...form, templateAnime: e.target.value })}
              />
            </label>
            <label>
              模板角色
              <input
                value={form.templateCharacter || ''}
                onChange={(e) => setForm({ ...form, templateCharacter: e.target.value })}
              />
            </label>
            <label>
              模板表情描述
              <input
                value={form.templateExpression || ''}
                onChange={(e) => setForm({ ...form, templateExpression: e.target.value })}
              />
            </label>
          </div>
          <div className="row">
            <label>
              标签
              <input
                value={(form.tags || []).join(', ')}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              />
            </label>
            <label>
              适用范围
              <select value={form.scope || ''} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {scopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              风险等级
              <select value={form.riskLevel || ''} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
                {riskOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              生图策略
              <select value={form.strategy || ''} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
                <option value="">选择策略</option>
                {strategyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            说明
            <input
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="row">
            <label>
              适用镜头
              <input
                value={(form.shotRecommendation || []).join(', ')}
                onChange={(e) => setForm({ ...form, shotRecommendation: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              />
            </label>
            <label>
              禁止事项
              <input
                value={form.prohibitions || ''}
                onChange={(e) => setForm({ ...form, prohibitions: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}
      {activeTab === 'assets' && (
        <div className="stack">
          <div className="card subtle">
            <h3>主参考图</h3>
            {mainAsset?.blob ? (
              <img src={URL.createObjectURL(mainAsset.blob)} alt="主参考" className="preview" />
            ) : (
              <div className="placeholder">请上传主参考图</div>
            )}
            <label className="file-button">
              上传主图
              <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'main')} />
            </label>
          </div>
          <div className="card subtle">
            <h3>辅助参考图</h3>
            <div className="asset-grid">
              {assets.filter((asset) => asset.type === 'aux').map((asset) => (
                <div key={asset.assetId} className="asset-card">
                  <img src={URL.createObjectURL(asset.blob)} alt={asset.assetId} />
                  <label>
                    用途
                    <select
                      value={asset.usage}
                      onChange={(e) => handleAssetUpdate(asset.assetId, { usage: e.target.value })}
                    >
                      {usageOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    备注
                    <input
                      value={asset.note || ''}
                      onChange={(e) => handleAssetUpdate(asset.assetId, { note: e.target.value })}
                    />
                  </label>
                  <div className="row">
                    <button type="button" onClick={() => handleAssetMove(asset.assetId, 'up')}>上移</button>
                    <button type="button" onClick={() => handleAssetMove(asset.assetId, 'down')}>下移</button>
                    <button type="button" className="danger" onClick={() => handleAssetDelete(asset.assetId)}>删除</button>
                  </div>
                </div>
              ))}
              {assets.filter((asset) => asset.type === 'aux').length === 0 && (
                <div className="empty">暂无辅助参考图。</div>
              )}
            </div>
            <label className="file-button">
              添加辅助图
              <input type="file" accept="image/*" onChange={(e) => handleAssetUpload(e, 'aux')} />
            </label>
          </div>
        </div>
      )}
      {activeTab === 'rules' && (
        <div className="stack" ref={missingRef}>
          <label>
            正向提示词模板
            <textarea
              value={ruleText.prompt}
              onChange={(e) => setRuleText({ ...ruleText, prompt: e.target.value })}
              className="large-input"
            />
          </label>
          <label>
            负向提示词
            <textarea
              value={ruleText.negative}
              onChange={(e) => setRuleText({ ...ruleText, negative: e.target.value })}
              className="large-input"
            />
          </label>
          <label>
            关键约束
            <textarea
              value={ruleText.constraints}
              onChange={(e) => setRuleText({ ...ruleText, constraints: e.target.value })}
              className="large-input"
            />
          </label>
          <label>
            建议参数
            <textarea
              value={ruleText.params}
              onChange={(e) => setRuleText({ ...ruleText, params: e.target.value })}
              className="large-input"
            />
          </label>
          <label>
            结构化规则 JSON
            <textarea
              value={ruleJsonText}
              onChange={(e) => setRuleJsonText(e.target.value)}
              className="large-input"
            />
          </label>
          <button type="button" onClick={handleRuleSave}>保存规则版本</button>
          <div className="list">
            {rules.map((rule) => (
              <div key={rule.ruleId} className="list-item">
                <div>
                  <div className="list-title">版本 v{rule.version}</div>
                  <div className="muted">策略：{rule.strategy}</div>
                </div>
                <button type="button" className="danger" onClick={() => handleDeleteRule(rule.ruleId)}>
                  删除
                </button>
              </div>
            ))}
            {rules.length === 0 && <div className="empty">暂无规则记录。</div>}
          </div>
        </div>
      )}
      {activeTab === 'storyboard' && (
        <div className="card subtle">
          <h3>分镜头引用模板</h3>
          <textarea
            className="large-input"
            readOnly
            value={`使用场景：${form.description || ''}\n镜头建议：${(form.shotRecommendation || []).join(' / ') || '特写'}\n用词建议：眼睛爆裂、牙关紧咬、额头青筋\n组合建议：可搭配汗滴/阴影遮眼特效，但不要叠加另一种颜艺`}
          />
          <button type="button" onClick={() => navigator.clipboard.writeText(form.id)}>复制模板</button>
        </div>
      )}
      {activeTab === 'transfer' && (
        <div className="stack">
          <button type="button" onClick={handleExportZip} disabled={loading}>
            导出单个颜艺 ZIP
          </button>
          <label className="file-button">
            导入颜艺 ZIP
            <input type="file" accept="application/zip" onChange={handleImportZip} />
          </label>
        </div>
      )}
      <div className="muted">当前状态：{status === 'todo' ? '待完善' : '可用'}</div>
    </div>
  );
};

export default ExpressionFormDetail;
