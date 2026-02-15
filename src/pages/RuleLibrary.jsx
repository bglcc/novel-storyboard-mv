import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import '../styles/rule-library.css';

const ruleGroups = [
  {
    id: 'novel',
    label: '生成小说',
    children: [
      { id: 'outline', label: '生成大纲', tool: '生成小说-大纲提示词' },
      { id: 'novel', label: '生成小说', tool: '生成小说-正文规则' },
      { id: 'detail-outline', label: '细纲规则库', tool: '细纲规则库' },
      { id: 'foreshadow', label: '伏笔规则库', tool: '伏笔规则库' },
      { id: 'summary', label: '摘要规则库', tool: '摘要规则库' }
    ]
  },
  {
    id: 'storyboard',
    label: '分镜头',
    children: [
      { id: 'storyboard', label: '分镜头', tool: '分镜头-规则库' },
      { id: 'preview', label: '预览图合成', tool: '预览图合成' },
      { id: 'animation', label: '动画', tool: '动画-规则库' }
    ]
  },
  {
    id: 'render',
    label: '生图',
    children: [{ id: 'image', label: '下载分镜数据', tool: '生图-规则库' }]
  },
  {
    id: 'video',
    label: '图生视频',
    children: [{ id: 'video', label: '生成视频', tool: '视频-规则库' }]
  },
  {
    id: 'resources',
    label: '资源库',
    children: [
      { id: 'characters', label: '角色', tool: '角色资源' },
      { id: 'scenes', label: '场景', tool: '场景资源' },
      { id: 'expressions', label: '表情', tool: '表情资源' },
      { id: 'props', label: '道具', tool: '道具资源' },
      { id: 'audio', label: '音频', tool: '音频资源' }
    ]
  }
];

const tabOptions = [
  { id: 'command', label: '口令' },
  { id: 'import', label: '导入规范' }
];

const defaultRuleMap = {
  '生成小说-大纲提示词': {
    description: '生成小说大纲提示词模板与选项规范。',
    overview:
      '用于生成小说大纲的提示词模板与选择题规范，输出为可直接复制的提示词文本。',
    tasks: ['根据选项生成提示词', '输出专业化故事大纲提示词'],
    exportSpec: {
      output: '大纲提示词文本',
      selections: '选项答案汇总（可选）'
    },
    importSpec: {
      selections: '选择题结构（主题/背景/冲突/主角性格/反派/基调/视角/时间线/目标/结局）',
      template: '提示词模板字符串'
    }
  },
  '生成小说-正文规则': {
    description: '生成小说阶段的规则包说明与导入规范。',
    overview: '用于生成小说正文并补齐基础资源库信息。',
    tasks: ['生成小说正文', '补充必要的资源库基础信息', '维护总角色关系网（如有变更）'],
    exportSpec: {
      newText: '新增小说原文',
      outline: '小说大纲（如有修改）',
      relationshipGraph: '总关系网（如有修改）',
      resources: '新增资源库信息（基础档案，允许不完整）'
    },
    importSpec: {
      outline: '小说大纲（文本）',
      existingText: '已有小说原文（章节列表）',
      resources: {
        characters: '角色资源描述与成长史（无图）',
        scenes: '场景资源文字与参考图（如有）'
      },
      relationshipGraph: '总角色关系网',
      rules: '生成小说对应规则库内容'
    }
  },
  细纲规则库: {
    description: '细纲生成与任务清单的规则说明。',
    overview: '用于生成章节细纲与伏笔/资源运用任务清单的规范说明。',
    tasks: ['生成章节细纲', '输出伏笔埋设/回收任务清单', '输出资源运用清单', '维护章节任务进度'],
    exportSpec: {
      chapters: '章节细纲（含任务清单与资源运用）',
      foreshadows: '伏笔条目（编号/类型/状态/规则）',
      resourceIndex: '简易资源名称清单（仅名称）'
    },
    importSpec: {
      outline: '小说大纲（文本）',
      foreshadows: '伏笔资源库',
      chapters: '细纲章节列表',
      resourceIndex: '资源名称清单（角色/场景/道具/表情）'
    }
  },
  预览图合成: {
    description: '分镜头预览图合成规范与提示词。',
    overview: '用于根据分镜头剧本与资源库合并生成预览图，并输出构图参数。',
    tasks: ['导入资源库信息', '合成分镜头预览图', '输出构图参数与预览图'],
    promptTemplate: `你是一个经验丰富的分镜头图像处理助手，我们将一起合作生成高质量的分镜头草图。根据已提供的分镜头剧本、资源库中的角色、表情、场景等信息，合并并生成每个分镜头的预览图。请确保生成内容符合以下要求：

### **1. 导入资源**：
- **角色资源**：根据已生成的角色图像（正面图、三视图、Q版形象等）和表情资源进行调用，确保角色的形象和表情符合情节需求。
- **场景资源**：从已生成的场景资源中调用所需的全景图、内景图等，确保场景的表现力和情感波动。
- **道具资源**：根据情节需求调用已生成的道具资源，确保道具与场景和角色一致。

### **2. 预览图合并要求**：
- 每个分镜头的**资源调用**：
  - 确保为每个镜头选择合适的**角色、表情、道具、场景**等资源。文档为： 节点F：预览图合成（Preview）

#### ✅ 导入说明
- \`previewParams\`: 镜头预览参数
- \`resources\`: 资源库

#### ✅ 导入格式
\`\`\`json
{
  "storyboards": [],
  "previewParams": [],
  "resources": {
    "characters": [],
    "scenes": [],
    "props": [],
    "expressions": []
  }
}
\`\`\`
✅ 导出说明
previewImages: 预览图 + 坐标参数

✅ 导出格式
{
  "previewImages": [
    {
      "shotNumber": "1",
      "image": "base64/图片URL",
      "composition": [
        {
          "id": "elem-001",
          "type": "character",
          "name": "角色A",
          "x": 50,
          "y": 50,
          "scale": 1,
          "rotate": 0
        }
      ]
    }
  ]
}
每个资源的参数设置：

资源类型（角色、场景、道具等）。

位置参数：设置资源在镜头中的位置（XY轴）。

缩放：设置资源的大小（例如，角色的占比为画面的30%）。

旋转与翻转：设置资源的角度和翻转（例如，角色旋转45度，或翻转镜像）。

3. 资源合并与调整：
将多个资源（角色、场景、道具等）通过基础操作（移动、缩放、旋转、翻转等）合并成分镜头草图，确保每个资源在画面中的布局合理、视觉效果突出。

对于表情资源，根据情节需求调整角色的表情，例如角色的愤怒表情、微笑表情等，以适配分镜头的情感表达。

4. 分镜头镜头描述与参数说明：
每个分镜头需要详细描述：

镜头类型（如特写镜头、低角度镜头等）。

角色、背景、道具的具体参数（位置、角度、缩放等）。

例如：“角色A在画面中心，表情愤怒，右手举着道具X，背景虚化，色调渐变为红色，角色A旋转45度，站立姿势”。

5. 提交给网站进行处理：
将生成的资源信息（包括位置、缩放、旋转、翻转等参数）提交给网站，进行实际的图像合并和处理。

确保资源和参数在图像处理后能准确呈现出分镜头的情感和画面效果。

6. 反馈与调整：
在预览图合成后，检查图像的视觉效果，确保镜头、角色、表情和背景的组合合理，且情感表达清晰。

如有需要调整的地方（如资源位置、表情调整等），进行微调，直到满意为止。

注意：

确保每个分镜头的资源调用与参数设置准确，尤其是在角色、表情和背景资源的使用上，避免不必要的重复或错误资源调用。

在提交给网站进行图像处理时，确保所有资源和参数信息准确无误，以便获得最终的高质量图像效果。
`,
    exportSpec: {
      previewImages: '预览图 + 坐标参数'
    },
    importSpec: {
      storyboards: '分镜头脚本',
      previewParams: '镜头预览参数',
      resources: '资源库（角色/场景/道具/表情）'
    }
  },
  伏笔规则库: {
    description: '伏笔管理与回收规则的规范说明。',
    overview: '用于维护伏笔类型、状态、埋设与回收规则。',
    tasks: ['新增伏笔条目', '维护伏笔埋设与回收规则', '追踪伏笔状态'],
    exportSpec: {
      foreshadows: '伏笔列表（编号/描述/类型/状态/规则）'
    },
    importSpec: {
      foreshadows: '伏笔列表（编号/描述/类型/状态/规则）'
    }
  },
  摘要规则库: {
    description: '结果摘要的输出与校验规范。',
    overview: '用于生成章节结果摘要并校验细纲任务完成情况。',
    tasks: ['输出章节结果摘要', '回传任务完成状态', '校验伏笔埋设/回收进度'],
    exportSpec: {
      summaryText: '章节结果摘要文本',
      tasks: '任务完成状态（与细纲任务对应）'
    },
    importSpec: {
      detailOutline: '细纲任务清单',
      summary: '章节结果摘要内容'
    }
  },
  '分镜头-规则库': {
    description: '分镜头阶段的规则包明与导入规范。',
    overview: '用于生成分镜头脚本并补齐资源库需求。',
    tasks: ['生成分镜头脚本', '回传镜头构图数据', '补齐资源库需求与缺失信息'],
    exportSpec: {
      storyboards: '完整分镜头信息（首帧、关键帧、动画、音频）',
      composition: '分镜头构图（角色/场景坐标、缩放、旋转）',
      resources: '补齐资源库新需求（角度/视角/素材请求）'
    },
    importSpec: {
      rules: '完整规则库（文+图）',
      chapter: '需要创建分镜头的章节',
      novel: '小说全文与大纲',
      relationshipGraph: '总角色关系网'
    }
  },
  '动画-规则库': {
    description: '图生视频阶段规则说明。',
    overview: '用于动画生成与镜头运动规范。',
    tasks: ['生成符合要求的动画片段', '按序号命名输出'],
    exportSpec: {
      video: '动画成片（按镜头序号命名）'
    },
    importSpec: {
      frames: '首帧图关键帧图',
      animation: '镜头与动画栏详细信息'
    }
  },
  '生图-规则库': {
    description: '生图阶段规则说明。',
    overview: '用于分镜生图与素材生产规范。',
    tasks: ['生成首帧图与关键帧成品图', '确保匹配镜头序号与需求'],
    exportSpec: {
      frames: '首帧图与关键帧成品图（符合上传标准）'
    },
    importSpec: {
      preview: '预览图',
      frames: '首帧图与关键帧信息',
      characterImages: '所需角色图片（形态/角度去重导出）',
      rules: '生图对应规则库内容'
    }
  },
  '视频-规则库': {
    description: '图生视频阶段规则说明。',
    overview: '用于将镜头图片生成连续动画。',
    tasks: ['生成连续动画片段', '按镜头序号输出文件'],
    exportSpec: {
      video: '动画片段文件（序号命名）'
    },
    importSpec: {
      frames: '首帧图与关键帧图',
      animation: '动画栏字段（镜头类型、机位、时长等）'
    }
  },
  角色资源: {
    description: '角色资源库与分镜头 AI / 图片回传交互规则说明。',
    overview: '用于角色基础信息、形态信息、关系网与成长史维护。',
    tasks: ['补充角色基信息', '回传角色形态与视角需求', '维护关系网与成长史'],
    exportSpec: {
      characterPackage: '角色资源包（图片压缩包）'
    },
    importSpec: {
      baseInfo: '角色名称/标签/背景/性格设定/成长轨迹',
      formInfo: '形态人设与外貌描写',
      relationshipGraph: '总关系网',
      characterGrowthHistory: '角色成长史节点列表'
    }
  },
  场景资源: {
    description: '场景资源库与分镜头 AI 的交互规则说明。',
    overview: '用于场景结构、描述与图像需求维护。',
    tasks: ['补充场景结构与描述', '生成场景图片需求'],
    exportSpec: {
      scenePackage: '场景图片压缩包'
    },
    importSpec: {
      sceneLayout: '场景结构图',
      sceneDescription: '画面描述',
      rules: '生成场景图片对应规则库内容'
    }
  },
  表情资源: {
    description: '表情资源库（颜艺）与分镜头 AI 的交互规则说明。',
    overview: '用于表情基础信息、规则说明与生图包需求。',
    tasks: ['补充表情基础信息', '生成表情资源包需求'],
    exportSpec: {
      expressionPackage: '表情图片压缩包'
    },
    importSpec: {
      baseInfo: '表情基础信息与适用范围',
      references: '参考图与规则说明',
      rules: '表情生成规则库内容'
    }
  },
  道具资源: {
    description: '道具资源库上传规范。',
    overview: '用于道具图片与描述信息维护。',
    tasks: ['上传道具图片', '补充道具描述与标签'],
    exportSpec: {
      propAssets: '道具图片文件'
    },
    importSpec: {
      images: '道具图片压缩包或单图',
      description: '道具文字描述'
    }
  },
  音频资源: {
    description: '音频资源库上传规范。',
    overview: '用于音频素材管理与描述。',
    tasks: ['上传音频素材', '补充音频说明'],
    exportSpec: {
      audioAssets: '音频文件'
    },
    importSpec: {
      audio: '音频文件',
      description: '音频说明与使用场景'
    }
  }
};

const getRuleDefaults = (tool) => defaultRuleMap[tool] || buildDefaultDraft();

const safeParseJson = (value, fallback = {}) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
};

const prettyJson = (value) => {
  if (!value) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '';
  }
};

const buildDefaultDraft = () => ({
  description: '',
  promptTemplate: '',
  overview: '',
  tasks: '',
  exportSpec: '',
  importSpec: ''
});

const RuleLibrary = () => {
  const { data, upsertRule, deleteRule, importRules } = useData();
  const allItems = useMemo(() => ruleGroups.flatMap((group) => group.children), []);
  const [expandedGroups, setExpandedGroups] = useState(() =>
    ruleGroups.reduce((acc, group) => ({ ...acc, [group.id]: true }), {})
  );
  const [selectedItemId, setSelectedItemId] = useState(allItems[0]?.id || '');
  const [activeTab, setActiveTab] = useState('command');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(buildDefaultDraft());

  const selectedItem = allItems.find((item) => item.id === selectedItemId) || allItems[0];
  const activeRule = useMemo(
    () => (data.rules || []).find((rule) => rule.tool === selectedItem?.tool),
    [data.rules, selectedItem]
  );

  const handleImportRules = (event) => {
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
    reader.readAsText(file);
  };

  const handleExportRules = () => {
    const blob = new Blob([JSON.stringify(data.rules || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rules.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hydrateDraft = (rule, tool) => {
    const defaults = getRuleDefaults(tool || rule?.tool);
    if (!rule) {
      setDraft({
        description: defaults.description || '',
        promptTemplate: defaults.promptTemplate || '',
        overview: defaults.overview || '',
        tasks: defaults.tasks ? defaults.tasks.join('\n') : '',
        exportSpec: prettyJson(defaults.exportSpec || {}),
        importSpec: prettyJson(defaults.importSpec || {})
      });
      return;
    }
    setDraft({
      description: rule.description || defaults.description || '',
      promptTemplate: rule.promptTemplate || defaults.promptTemplate || '',
      overview: rule.parameters?.overview || defaults.overview || '',
      tasks: Array.isArray(rule.parameters?.tasks)
        ? rule.parameters.tasks.join('\n')
        : defaults.tasks
          ? defaults.tasks.join('\n')
          : '',
      exportSpec: prettyJson(rule.parameters?.exportSpec || defaults.exportSpec || {}),
      importSpec: prettyJson(rule.parameters?.importSpec || defaults.importSpec || {})
    });
  };

  const handleSelectItem = (itemId) => {
    setSelectedItemId(itemId);
    setActiveTab('command');
    setIsEditing(false);
    const item = allItems.find((entry) => entry.id === itemId);
    const rule = (data.rules || []).find((entry) => entry.tool === item?.tool);
    hydrateDraft(rule, item?.tool);
  };

  const handleToggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleEdit = () => {
    hydrateDraft(activeRule, selectedItem?.tool);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    hydrateDraft(activeRule, selectedItem?.tool);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!selectedItem?.tool) return;
    const payload = {
      id: activeRule?.id || '',
      tool: selectedItem.tool,
      description: draft.description || '',
      promptTemplate: draft.promptTemplate || '',
      parameters: {
        overview: draft.overview || '',
        tasks: draft.tasks
          ? draft.tasks
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        exportSpec: safeParseJson(draft.exportSpec, {}),
        importSpec: safeParseJson(draft.importSpec, {})
      }
    };
    upsertRule(payload);
    setIsEditing(false);
  };

  const handleDeleteRule = () => {
    if (!activeRule?.id) return;
    if (!window.confirm('确认删除该规则？')) return;
    deleteRule(activeRule.id);
    hydrateDraft(null, selectedItem?.tool);
    setIsEditing(false);
  };

  useEffect(() => {
    hydrateDraft(activeRule, selectedItem?.tool);
  }, [activeRule, selectedItem?.tool]);

  return (
    <div className="card rule-library">
      <div className="rule-library-header">
        <div>
          <h2>规则库管理</h2>
          <p className="muted">集中维护生成小说、分镜头、资源库等流程的提示词与导入规范。</p>
        </div>
        <div className="row">
          <button type="button" onClick={handleExportRules}>
            导出规则 JSON
          </button>
          <label className="primary-link file-label">
            导入规则 JSON
            <input type="file" accept="application/json" onChange={handleImportRules} />
          </label>
        </div>
      </div>

      <div className="rule-layout">
        <aside className="rule-sidebar">
          {ruleGroups.map((group) => (
            <div key={group.id} className="rule-group">
              <button
                type="button"
                className="rule-group-title"
                onClick={() => handleToggleGroup(group.id)}
              >
                <span>{group.label}</span>
                <span className="rule-group-toggle">{expandedGroups[group.id] ? '−' : '+'}</span>
              </button>
              {expandedGroups[group.id] && (
                <div className="rule-group-items">
                  {group.children.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={selectedItem?.id === item.id ? 'rule-item active' : 'rule-item'}
                      onClick={() => handleSelectItem(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        <div className="rule-content">
          <div className="rule-content-header">
            <div>
              <div className="muted">当前规则</div>
              <h3>{selectedItem?.label || '未选择规则'}</h3>
              <div className="muted">{selectedItem?.tool || '未绑定工具'}</div>
            </div>
            <div className="row">
              {isEditing ? (
                <>
                  <button type="button" className="ghost-button" onClick={handleCancelEdit}>
                    取消
                  </button>
                  <button type="button" className="primary" onClick={handleSave}>
                    存
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ghost-button" onClick={handleEdit}>
                    修改
                  </button>
                  {activeRule?.id && (
                    <button type="button" className="danger" onClick={handleDeleteRule}>
                      删除
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="rule-content-body">
            <div className="rule-main">
              {activeTab === 'command' && (
                <div className="rule-panel">
                  <div className="rule-panel-header">
                    <h4>口令（Prompt + 说明）</h4>
                  </div>
                  <div className="rule-panel-body">
                    <label>
                      规则描述
                      <input
                        value={draft.description}
                        onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="用途、场景等"
                      />
                    </label>
                    <label>
                      提示词模板
                      <textarea
                        className="large-input"
                        value={draft.promptTemplate}
                        onChange={(e) => setDraft((prev) => ({ ...prev, promptTemplate: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="例如：你是一个专业的分镜头规划师……"
                      />
                    </label>
                    <label>
                      任务说明
                      <textarea
                        className="large-input"
                        value={draft.overview}
                        onChange={(e) => setDraft((prev) => ({ ...prev, overview: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="这一步 AI 需要完成什么？"
                      />
                    </label>
                    <label>
                      任务清单（每行一条）
                      <textarea
                        className="large-input"
                        value={draft.tasks}
                        onChange={(e) => setDraft((prev) => ({ ...prev, tasks: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="生成小说正文\n补充资源库基础信息"
                      />
                    </label>
                    <label>
                      出内容说明（JSON）
                      <textarea
                        className="large-input"
                        value={draft.exportSpec}
                        onChange={(e) => setDraft((prev) => ({ ...prev, exportSpec: e.target.value }))}
                        disabled={!isEditing}
                        placeholder='{"chapters":"章节正文","relationshipGraph":"总关系网"}'
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'import' && (
                <div className="rule-panel">
                  <div className="rule-panel-header">
                    <h4>导入规范</h4>
                    {!isEditing && (
                      <div className="row">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!draft.importSpec.trim()) return;
                            try {
                              await navigator.clipboard.writeText(draft.importSpec);
                              alert('导入规范已复制');
                            } catch (error) {
                              alert('复制失败，请手动复制');
                            }
                          }}
                        >
                          复制 JSON
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="rule-panel-body">
                    <label>
                      JSON 结构规范
                      <textarea
                        className="large-input"
                        value={draft.importSpec}
                        onChange={(e) => setDraft((prev) => ({ ...prev, importSpec: e.target.value }))}
                        disabled={!isEditing}
                        placeholder="填写导入 JSON 的字段说明"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <aside className="rule-subnav">
              <div className="rule-subnav-title">板块</div>
              {tabOptions.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? 'rule-subnav-item active' : 'rule-subnav-item'}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
              {!activeRule && (
                <div className="rule-subnav-empty">
                  尚未配置该规则，可点击“修改”填写。
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleLibrary;
