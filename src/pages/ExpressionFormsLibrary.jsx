import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import JSZip from 'jszip';
import {
  createExpressionFormId,
  deleteExpressionForm,
  getExpressionAssets,
  getExpressionForms,
  getExpressionRules,
  upsertExpressionForm
} from '../utils/expressionFormsDb';
import '../styles/resource.css';

const defaultCategories = [
  '情绪爆发类',
  '崩坏/扭曲类',
  '搞笑/抽象类',
  'Q版专用',
  '自定义'
];

const scopeLabels = {
  chibi: 'Q版',
  normal: '普通比例',
  universal: '通用'
};

const riskLabels = {
  low: '低',
  mid: '中',
  high: '高'
};

const strategyLabels = {
  direct_generate: '直接生图',
  img2img_character: '图生图',
  hybrid: '混合'
};

const ExpressionFormsLibrary = () => {
  const [forms, setForms] = useState([]);
  const [assetsMap, setAssetsMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [categories, setCategories] = useState(defaultCategories);
  const [searchText, setSearchText] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);

  const loadForms = async () => {
    const data = await getExpressionForms();
    setForms(data);
  };

  useEffect(() => {
    loadForms();
  }, []);

  useEffect(() => {
    let alive = true;
    const previousUrls = Object.values(assetsMap).map((item) => item.mainUrl).filter(Boolean);
    const loadAssets = async () => {
      const entries = await Promise.all(
        forms.map(async (form) => {
          const assets = await getExpressionAssets(form.id);
          const mainAsset = assets
            .filter((asset) => asset.type === 'main')
            .sort((a, b) => (a.order || 0) - (b.order || 0))[0];
          const mainUrl = mainAsset?.blob ? URL.createObjectURL(mainAsset.blob) : '';
          return [form.id, { assets, mainAsset, mainUrl }];
        })
      );
      if (!alive) return;
      const nextMap = {};
      entries.forEach(([id, payload]) => {
        nextMap[id] = payload;
      });
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
      setAssetsMap(nextMap);
    };
    if (forms.length) {
      loadAssets();
    } else {
      previousUrls.forEach((url) => URL.revokeObjectURL(url));
      setAssetsMap({});
    }
    return () => {
      alive = false;
    };
  }, [forms]);

  const filteredForms = useMemo(() => {
    return forms
      .filter((form) => {
        if (selectedCategory !== '全部' && form.category !== selectedCategory) return false;
        if (filterRisk && form.riskLevel !== filterRisk) return false;
        if (filterScope && form.scope !== filterScope) return false;
        if (filterStatus && form.status !== filterStatus) return false;
        if (!searchText.trim()) return true;
        const keywords = `${form.name || ''} ${form.id || ''} ${(form.tags || []).join(',')} ${form.scope || ''}`;
        return keywords.toLowerCase().includes(searchText.toLowerCase());
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [forms, selectedCategory, filterRisk, filterScope, filterStatus, searchText]);

  const selectedForm = forms.find((form) => form.id === selectedId) || filteredForms[0];

  useEffect(() => {
    if (!selectedId && filteredForms.length) {
      setSelectedId(filteredForms[0].id);
    }
  }, [filteredForms, selectedId]);

  const handleCreate = async () => {
    const now = Date.now();
    const id = createExpressionFormId();
    const newForm = {
      id,
      name: '新建颜艺形态',
      category: categories[0] || '自定义',
      tags: [],
      scope: 'universal',
      riskLevel: 'mid',
      status: 'todo',
      templateAnime: '',
      templateCharacter: '',
      templateExpression: '',
      description: '',
      shotRecommendation: ['closeup', 'medium'],
      prohibitions: '',
      createdAt: now,
      updatedAt: now
    };
    await upsertExpressionForm(newForm);
    await loadForms();
    setSelectedId(id);
  };

  const handleDelete = async (formId) => {
    if (!window.confirm('确认删除该颜艺形态？')) return;
    await deleteExpressionForm(formId);
    await loadForms();
  };

  const handleQuickCopy = async (formId) => {
    try {
      await navigator.clipboard.writeText(formId);
      alert('已复制 ID');
    } catch (e) {
      alert('复制失败，请手动复制');
    }
  };

  const handleExportAll = async () => {
    const zip = new JSZip();
    const index = [];
    for (const form of forms) {
      const assets = await getExpressionAssets(form.id);
      const rules = await getExpressionRules(form.id);
      index.push({ id: form.id, name: form.name });
      const formFolder = zip.folder(`ExpressionForms/${form.id}`);
      const refsFolder = formFolder.folder('refs');
      const rulesFolder = formFolder.folder('rules');
      const metaAssets = [];
      for (const asset of assets) {
        const fileName = asset.type === 'main' ? 'main' : `aux_${asset.order || 1}`;
        const extension = asset.blob?.type?.split('/')[1] || 'png';
        const fullName = `${fileName}.${extension}`;
        if (asset.blob) {
          const buffer = await asset.blob.arrayBuffer();
          refsFolder.file(fullName, buffer);
        }
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
        status: form.status,
        description: form.description,
        assets: metaAssets,
        rules: rules.map((rule) => ({
          version: rule.version,
          strategy: rule.strategy,
          files: [`rule_v${rule.version}.json`, `rule_v${rule.version}.txt`]
        }))
      };
      formFolder.file('meta.json', JSON.stringify(meta, null, 2));
      rules.forEach((rule) => {
        rulesFolder.file(`rule_v${rule.version}.json`, JSON.stringify(rule.ruleJson || {}, null, 2));
        rulesFolder.file(
          `rule_v${rule.version}.txt`,
          [rule.promptTemplate || '', '\n\n', rule.negativePrompt || '', '\n\n', rule.constraints || ''].join('')
        );
      });
    }
    zip.file('ExpressionForms/index.json', JSON.stringify(index, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'expression-forms.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAll = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const zip = await JSZip.loadAsync(file);
    const indexEntry = zip.file('ExpressionForms/index.json');
    const folders = indexEntry ? JSON.parse(await indexEntry.async('string')) : [];
    const importIds = folders.length
      ? folders.map((item) => item.id)
      : Object.keys(zip.files)
          .filter((path) => path.startsWith('ExpressionForms/') && path.endsWith('meta.json'))
          .map((path) => path.split('/')[1]);
    for (const id of importIds) {
      const metaFile = zip.file(`ExpressionForms/${id}/meta.json`);
      if (!metaFile) continue;
      const meta = JSON.parse(await metaFile.async('string'));
      const exists = forms.find((form) => form.id === meta.id);
      let finalId = meta.id;
      if (exists) {
        const choice = window.prompt('ID 冲突：输入 suffix/overwrite/skip', 'suffix');
        if (choice === 'skip') continue;
        if (choice === 'suffix') {
          finalId = `${meta.id}-${Date.now()}`;
        }
      }
      const now = Date.now();
      await upsertExpressionForm({
        ...meta,
        id: finalId,
        createdAt: meta.createdAt || now,
        updatedAt: now,
        status: meta.status || 'todo'
      });
    }
    await loadForms();
  };

  return (
    <div className="expression-layout">
      <aside className="expression-sidebar">
        <div className="space-between">
          <h3>分类</h3>
          <button type="button" onClick={() => setPanelOpen((prev) => !prev)}>
            {panelOpen ? '折叠' : '展开'}
          </button>
        </div>
        <div className="category-list">
          <button
            type="button"
            className={selectedCategory === '全部' ? 'category active' : 'category'}
            onClick={() => setSelectedCategory('全部')}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={selectedCategory === cat ? 'category active' : 'category'}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="category-editor">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="新增分类"
          />
          <button
            type="button"
            onClick={() => {
              if (!newCategory.trim()) return;
              setCategories((prev) => [...prev, newCategory.trim()]);
              setNewCategory('');
            }}
          >
            添加
          </button>
        </div>
        <div className="category-actions">
          <button type="button" onClick={handleCreate}>新增颜艺</button>
          <label className="file-button">
            导入 ZIP
            <input type="file" accept="application/zip" onChange={handleImportAll} />
          </label>
          <button type="button" onClick={handleExportAll}>导出全库</button>
        </div>
      </aside>
      <section className="expression-main">
        <div className="expression-toolbar">
          <input
            placeholder="搜索名称、标签、ID、适用范围"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
            <option value="">风险等级</option>
            <option value="low">低</option>
            <option value="mid">中</option>
            <option value="high">高</option>
          </select>
          <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)}>
            <option value="">适用范围</option>
            <option value="chibi">Q版</option>
            <option value="normal">普通比例</option>
            <option value="universal">通用</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">状态</option>
            <option value="ready">可用</option>
            <option value="todo">待完善</option>
          </select>
        </div>
        <div className="expression-grid">
          {filteredForms.map((form) => {
            const assets = assetsMap[form.id]?.assets || [];
            const mainAsset = assetsMap[form.id]?.mainAsset;
            const statusLabel = form.status === 'todo' ? '待完善' : '可用';
            return (
              <div key={form.id} className="expression-card" onClick={() => setSelectedId(form.id)}>
                <div className="expression-cover">
                  {assetsMap[form.id]?.mainUrl ? (
                    <img src={assetsMap[form.id].mainUrl} alt={form.name} />
                  ) : (
                    <div className="placeholder">缺主图</div>
                  )}
                  {form.riskLevel === 'high' && <span className="risk-badge">⚠ 高风险</span>}
                  {form.status === 'todo' && <span className="todo-badge">待完善</span>}
                </div>
                <div className="expression-body">
                  <h4>{form.name || '未命名'}</h4>
                  <div className="expression-meta">适用范围：{scopeLabels[form.scope] || '-'}</div>
                  <div className="expression-meta">风险等级：{riskLabels[form.riskLevel] || '-'}</div>
                  <div className="expression-meta">策略：{strategyLabels[form.strategy] || '未设置'}</div>
                  <div className="expression-meta">状态：{statusLabel}</div>
                  <div className="expression-tags">{(form.tags || []).join(' / ') || '未设置标签'}</div>
                </div>
                <div className="expression-actions">
                  <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleQuickCopy(form.id);
                  }}>
                    复制ID
                  </button>
                  <Link to={`/expression-forms/${form.id}`} className="primary-link" onClick={(e) => e.stopPropagation()}>
                    详情
                  </Link>
                  <button type="button" className="danger" onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(form.id);
                  }}>
                    删除
                  </button>
                </div>
              </div>
            );
          })}
          {filteredForms.length === 0 && <div className="empty">暂无颜艺表情形态。</div>}
        </div>
      </section>
      {panelOpen && (
        <aside className="expression-detail">
          <div className="space-between">
            <h3>详情概览</h3>
            <button type="button" onClick={() => setPanelOpen(false)}>收起</button>
          </div>
          {selectedForm ? (
            <div className="detail-card">
              <h4>{selectedForm.name}</h4>
              <p className="muted">ID: {selectedForm.id}</p>
              <p>{selectedForm.description || '暂无说明'}</p>
              <div className="detail-meta">分类：{selectedForm.category || '-'}</div>
              <div className="detail-meta">适用范围：{scopeLabels[selectedForm.scope] || '-'}</div>
              <div className="detail-meta">风险等级：{riskLabels[selectedForm.riskLevel] || '-'}</div>
              <div className="detail-meta">状态：{selectedForm.status === 'todo' ? '待完善' : '可用'}</div>
              <Link to={`/expression-forms/${selectedForm.id}`} className="primary-link">
                前往详情页
              </Link>
            </div>
          ) : (
            <div className="empty">请选择一条颜艺形态。</div>
          )}
        </aside>
      )}
    </div>
  );
};

export default ExpressionFormsLibrary;
