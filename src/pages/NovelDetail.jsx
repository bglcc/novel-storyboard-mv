import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import '../styles/novel-outline.css';

const statusColors = {
  仅录入: 'gray',
  待审核: 'orange',
  已完成: 'green'
};

const outlineQuestions = [
  {
    id: 'theme',
    title: '故事的核心主题是什么？',
    options: ['成长', '复仇', '爱情', '战争', '冒险', '发现自我'],
    otherLabel: '其他（请简述）',
    pending: '待议：如果有特殊的主题要求，AI 可以提供建议，是否需要更深层的主题或多重主题的结合？'
  },
  {
    id: 'setting',
    title: '故事的背景设定属于哪种类型？',
    options: ['现代', '架空历史', '科幻', '玄幻', '奇幻', '现实主义'],
    otherLabel: '其他（请简述）',
    pending: '待议：AI 可以提供背景设定的创意建议，是否需要融合多个元素？'
  },
  {
    id: 'conflict',
    title: '故事的主要冲突类型是什么？',
    options: ['人与人之间的冲突', '人与社会的冲突', '人与自然的冲突', '人与内心的冲突', '人与技术的冲突'],
    otherLabel: '其他（请简述）',
    pending: '待议：是否考虑内心的深层冲突和外部冲突的双重拉扯？'
  },
  {
    id: 'protagonist',
    title: '主角的性格特征是什么？',
    options: ['英勇 / 勇敢', '智慧 / 理性', '忍耐 / 坚韧', '幽默 / 机智', '叛逆 / 由', '矛盾 / 内心冲突'],
    otherLabel: '其他（请简述）',
    pending: '待议：是否考虑加入角色的缺点或者成长曲线？'
  },
  {
    id: 'antagonist',
    title: '主要反派或对立力量是什么？',
    options: ['个人反派（如邪恶领主）', '社会结构（如不公正的制度）', '自然灾害或外星生物', '内心的恐惧或缺陷'],
    otherLabel: '其他（请简述）',
    pending: '待议：反派是否仅限于一个角色，还是由多重力量组成？'
  },
  {
    id: 'tone',
    title: '故事的情感基调是什么？',
    options: ['喜剧', '悲剧', '悬疑 / 惊悚', '戏剧性 / 转折', '温情 / 治愈', '紧张 / 压迫感'],
    otherLabel: '其他（请简述）',
    pending: '待议：是否考虑情感基调的转换？比如故事从紧张转为温情等？'
  },
  {
    id: 'pov',
    title: '故事的叙述视角是什么？',
    options: ['第一人称', '第三人称', '全知视角', '非线性叙事'],
    otherLabel: '其他（请简述）',
    pending: '待议：是否需要多重视角叙事来增强故事层次感？'
  },
  {
    id: 'timeline',
    title: '故事的时间线如何设置？',
    options: ['线性时间，按事件发生顺序推进', '倒叙或回忆', '时间碎片化（跳跃式展开）'],
    otherLabel: '其他（请简述）',
    pending: '待议：时间线的跳跃是否影响故事的连贯性？是否需要 AI 提供多种时间线排列的建议？'
  },
  {
    id: 'goal',
    title: '主角的目标是什么？',
    options: ['追求爱情', '实现个人复仇', '战胜恶势力', '保护家园', '寻找失落的宝藏', '探索未知领域'],
    otherLabel: '其他（请简述）',
    pending: '待议：是否考虑主角目标的多重性或变动性？'
  },
  {
    id: 'ending',
    title: '故事的结局会是怎样的？',
    options: ['快乐结局（主角成功或满足）', '悲伤结局（主角牺牲或失败）', '开放结局（没有明确的答案）', '中性结局（没有明确的胜负，更多的是过程）'],
    otherLabel: '其他（请简述）',
    pending: '待议：结局是否需要对故事中的矛盾点做进一步的回应或解答？'
  }
];

const outlinePlaceholderMap = {
  theme: '选择的主题',
  setting: '选择的背景设定',
  conflict: '选择的冲突类型',
  protagonist: '选择的性格特征',
  antagonist: '选择的反派或对立力量',
  tone: '选择的情感基调',
  pov: '选择的叙述视角',
  timeline: '选择的时间线设置',
  goal: '选择的目标',
  ending: '选择的结局'
};

const buildInitialSelections = () =>
  outlineQuestions.reduce(
    (acc, question) => ({
      ...acc,
      [question.id]: {
        selected: [],
        other: '',
        pending: false
      }
    }),
    {}
  );

const defaultOutlinePromptTemplate =
  '你是一个专业的故事创作者，本故事的核心主题是：[选择的主题]，故事发生在：[选择的背景设定]。故事的主要冲突是：[选择的冲突类型]，而主角性格为：[选择的性格特征]。故事中的主要反派是：[选择的反派或对立力量]，故事情感基调为：[选择的情感基调]。本故事使用[选择的叙述视角]视角进行叙述，时间线采用[选择的时间线设置]。主角的目标是：[选择的目标]，故事将以[选择的结局]结尾。';

const NovelDetail = () => {
  const { novelId } = useParams();
  const navigate = useNavigate();
  const { data, addChapter, updateChapter, updateNovel, upsertResource, upsertRule } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [outlineModalOpen, setOutlineModalOpen] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [outlineViewOpen, setOutlineViewOpen] = useState(false);
  const [outlineEditMode, setOutlineEditMode] = useState(false);
  const [outlineViewTab, setOutlineViewTab] = useState('outline');
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const [uploadingNovel, setUploadingNovel] = useState(false);
  const [outlineSelections, setOutlineSelections] = useState(buildInitialSelections);
  const [outlineSummary, setOutlineSummary] = useState([]);
  const [outlinePromptDraft, setOutlinePromptDraft] = useState(novel?.outlinePrompt || '');
  const [outlineDraft, setOutlineDraft] = useState(novel?.outlineText || '');
  const outlineRule = useMemo(
    () => (data.rules || []).find((rule) => rule.tool === '生成小说-大纲提示词'),
    [data.rules]
  );
  const promptTemplate = outlineRule?.promptTemplate || defaultOutlinePromptTemplate;

  useEffect(() => {
    if (!novel) return;
    setOutlinePromptDraft(novel.outlinePrompt || '');
    setOutlineDraft(novel.outlineText || '');
  }, [novel]);

  useEffect(() => {
    const existing = (data.rules || []).some((rule) => rule.tool === '生成小说-大纲提示词');
    if (existing) return;
    upsertRule({
      tool: '生成小说-大纲提示词',
      description: '生成小说大纲提示词模板与选项规范。',
      promptTemplate: defaultOutlinePromptTemplate,
      parameters: {
        overview: '用于生成小说大纲提示词的模板与选项集。',
        questions: outlineQuestions.map((question) => ({
          id: question.id,
          title: question.title,
          options: question.options,
          otherLabel: question.otherLabel,
          pending: question.pending
        }))
      }
    });
  }, [data.rules, upsertRule]);

  useEffect(() => {
    const existing = (data.rules || []).some((rule) => rule.tool === '生成小说-正文规则');
    if (existing) return;
    upsertRule({
      tool: '生成小说-正文规则',
      description: '生成小说阶段的规则包说明与导入规范。',
      parameters: {
        overview: '用于生成小说正文的规则说明与输入规范。',
        tasks: ['生成小说正文', '补充必要的资源库基础信息', '维护总角色关系网（如有变更）'],
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
      }
    });
  }, [data.rules, upsertRule]);

  if (!novel) return <div className="card">未找到小说。</div>;

  const handleAddChapter = (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const newId = addChapter(novelId, title.trim(), content.trim());
    setTitle('');
    setContent('');
    setModalOpen(false);
    if (newId) navigate(`/novel/${novelId}/chapter/${newId}`);
  };

  const outlineStatus = novel.outlineText
    ? '已上传'
    : novel.outlinePrompt
      ? '已生成'
      : '未生成';

  const handleToggleOption = (questionId, option) => {
    setOutlineSelections((prev) => {
      const current = prev[questionId];
      const selected = current.selected.includes(option)
        ? current.selected.filter((item) => item !== option)
        : [...current.selected, option];
      return { ...prev, [questionId]: { ...current, selected } };
    });
  };

  const handleOtherChange = (questionId, value) => {
    setOutlineSelections((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], other: value }
    }));
  };

  const handlePendingToggle = (questionId) => {
    setOutlineSelections((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], pending: !prev[questionId].pending }
    }));
  };

  const buildAnswerText = (question) => {
    const selection = outlineSelections[question.id];
    const values = [...selection.selected];
    if (selection.other.trim()) values.push(selection.other.trim());
    if (selection.pending) values.push(question.pending);
    return values.length ? values.join('、') : '未指定';
  };

  const handleGeneratePrompt = () => {
    const summary = outlineQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      answer: buildAnswerText(question)
    }));
    setOutlineSummary(summary);
    const replacements = summary.reduce((acc, item) => {
      const placeholderKey = outlinePlaceholderMap[item.id];
      if (!placeholderKey) return acc;
      return { ...acc, [placeholderKey]: item.answer };
    }, {});
    let nextPrompt = promptTemplate;
    Object.entries(replacements).forEach(([key, value]) => {
      nextPrompt = nextPrompt.replaceAll(`[${key}]`, value);
    });
    setOutlinePromptDraft(nextPrompt);
    setOutlineModalOpen(false);
    setPromptModalOpen(true);
  };

  const handleSavePrompt = () => {
    const now = new Date().toISOString();
    const historyEntry = {
      id: crypto.randomUUID(),
      createdAt: now,
      selections: outlineSelections,
      summary: outlineSummary,
      prompt: outlinePromptDraft.trim()
    };
    const nextHistory = [...(novel.outlineSelectionHistory || []), historyEntry];
    updateNovel(novelId, {
      outlinePrompt: outlinePromptDraft.trim(),
      outlineGeneratedAt: now,
      outlineStatus: outlinePromptDraft.trim() ? '已生成' : '未生成',
      outlineSelectionHistory: nextHistory
    });
    setPromptModalOpen(false);
  };

  const handleSaveOutline = () => {
    const now = new Date().toISOString();
    const nextVersions = [
      ...(novel.outlineVersions || []),
      {
        version: (novel.outlineVersions || []).length + 1,
        outlineText: outlineDraft.trim(),
        updatedAt: now
      }
    ];
    updateNovel(novelId, {
      outlineText: outlineDraft.trim(),
      outlineUpdatedAt: now,
      outlineStatus: outlineDraft.trim() ? '已上传' : outlineStatus,
      outlineVersions: nextVersions
    });
    setOutlineEditMode(false);
    setOutlineViewOpen(false);
  };

  const handleCopyPrompt = async () => {
    if (!outlinePromptDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(outlinePromptDraft.trim());
      alert('提示词已复制');
    } catch (e) {
      alert('复制失败，请手动复制');
    }
  };

  const handleRelationshipImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('关系网 JSON 为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      updateNovel(novelId, { relationshipGraph: parsed });
    } catch (e) {
      alert('关系网 JSON 解析失败');
    }
  };

  const handleRelationshipExport = () => {
    const blob = new Blob([JSON.stringify(novel.relationshipGraph || { nodes: [], relations: [] }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.title || 'novel'}-relationship.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadNovelPackage = () => {
    const characters = (data.resources.characters || []).filter(
      (character) => !character.novelId || character.novelId === novelId
    );
    const characterPayload = characters.map((character) => ({
      id: character.id,
      name: character.name,
      description: character.description,
      tags: character.tags || [],
      aliases: character.aliases || [],
      priorityPin: character.priorityPin || false,
      meta: {
        personalitySetting: character.meta?.personalitySetting || '',
        growthTrajectory: character.meta?.growthTrajectory || '',
        characterGrowthHistory: character.meta?.characterGrowthHistory || [],
        persona: character.meta?.persona || ''
      },
      form: character.form || [],
      action: character.action || []
    }));
    const scenePayload = (data.resources.scenes || []).map((scene) => ({
      id: scene.id,
      name: scene.name,
      description: scene.description,
      tags: scene.tags || [],
      meta: scene.meta || {},
      images: scene.images || []
    }));
    const payload = {
      novel: {
        id: novel.id,
        title: novel.title,
        outlinePrompt: novel.outlinePrompt || '',
        outlineText: novel.outlineText || '',
        outlineVersions: novel.outlineVersions || [],
        outlineSelectionHistory: novel.outlineSelectionHistory || []
      },
      chapters: (novel.chapters || []).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content || '',
        status: chapter.status || ''
      })),
      resources: {
        characters: characterPayload,
        scenes: scenePayload
      },
      relationshipGraph: novel.relationshipGraph || { nodes: [], relations: [] },
      rules: (data.rules || []).filter((rule) => (rule.tool || '').includes('生成小说'))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.title || 'novel'}-generation.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadNovelPackage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingNovel(true);
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('小说包为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      const payloadNovel = parsed.novel || parsed;
      if (payloadNovel.outlineText || payloadNovel.outlinePrompt || payloadNovel.outlineSelectionHistory) {
        updateNovel(novelId, {
          outlineText: payloadNovel.outlineText || novel.outlineText || '',
          outlinePrompt: payloadNovel.outlinePrompt || novel.outlinePrompt || '',
          outlineSelectionHistory: payloadNovel.outlineSelectionHistory || novel.outlineSelectionHistory || []
        });
      }
      if (parsed.relationshipGraph) {
        updateNovel(novelId, { relationshipGraph: parsed.relationshipGraph });
      }
      if (Array.isArray(parsed.chapters)) {
        const existing = novel.chapters || [];
        const incoming = parsed.chapters.map((chapter) => ({
          id: crypto.randomUUID(),
          title: chapter.title || '新章节',
          status: chapter.status || '仅录入',
          content: chapter.content || '',
          storyboards: chapter.storyboards || [],
          storyboardUpdatedAt: chapter.storyboardUpdatedAt || null
        }));
        updateNovel(novelId, { chapters: [...existing, ...incoming] });
      }
      const resources = parsed.resources || {};
      (resources.characters || []).forEach((character) => {
        upsertResource('characters', {
          ...character,
          id: character.id || crypto.randomUUID(),
          novelId
        });
      });
      (resources.scenes || []).forEach((scene) => {
        upsertResource('scenes', {
          ...scene,
          id: scene.id || crypto.randomUUID()
        });
      });
      alert('小说包导入完成');
    } catch (error) {
      alert('小说包解析失败');
    } finally {
      setUploadingNovel(false);
      event.target.value = '';
    }
  };

  return (
    <div className="card">
      <div className="space-between">
        <div>
          <h2>{novel.title} - 章节列表</h2>
          <p className="muted">管理章节并进入分镜编辑</p>
        </div>
        <div className="row">
          <Link to="/" className="tab">返回书架</Link>
          {!novel.outlineText && (
            <button
              type="button"
              onClick={() => {
                setOutlineSelections(buildInitialSelections());
                setOutlineSummary([]);
                setOutlineModalOpen(true);
              }}
            >
              生成大纲
            </button>
          )}
          {outlineStatus === '已生成' && !novel.outlineText && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setOutlinePromptDraft(novel.outlinePrompt || '');
                setPromptModalOpen(true);
              }}
            >
              复制关键词
            </button>
          )}
          {!novel.outlineText && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setOutlineDraft(novel.outlineText || '');
                setOutlineViewOpen(true);
                setOutlineEditMode(true);
                setOutlineViewTab('outline');
              }}
            >
              上传大纲
            </button>
          )}
          {novel.outlineText && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setOutlineDraft(novel.outlineText || '');
                setOutlineViewOpen(true);
                setOutlineEditMode(false);
                setOutlineViewTab('outline');
              }}
            >
              查看大纲
            </button>
          )}
          <button type="button" className="ghost-button" onClick={() => setRelationshipModalOpen(true)}>
            总关系网
          </button>
          <button type="button" className="ghost-button" onClick={handleDownloadNovelPackage}>
            生成小说
          </button>
          <label className="file-button">
            上传小说
            <input type="file" accept="application/json" onChange={handleUploadNovelPackage} />
          </label>
          <button type="button" onClick={() => setModalOpen(true)}>+ 新建章节</button>
        </div>
      </div>

      <div className="list">
        {novel.chapters.map((chapter) => (
          <div key={chapter.id} className="list-item chapter-item">
            <div className="chapter-main">
              <button className="ghost" onClick={() => setEditModal(chapter)}>
                <div className="list-title chapter-title underline">{chapter.title}</div>
              </button>
            </div>
            <div className="chapter-meta">
              <div className={`status-pill ${statusColors[chapter.status] || 'gray'}`}>{chapter.status}</div>
              <Link to={`/novel/${novelId}/chapter/${chapter.id}`} className="primary-button">
                进入章节
              </Link>
            </div>
          </div>
        ))}
        {novel.chapters.length === 0 && <div className="empty">暂无章节，创建一个吧。</div>}
      </div>

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>新建章节</h3>
            <form className="stack" onSubmit={handleAddChapter}>
              <label>
                章节标题（必填）
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="请输入章节标题"
                  required
                />
              </label>
              <label>
                章节内容（必填）
                <textarea
                  className="large-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入章节正文"
                  required
                />
              </label>
              <div className="row">
                <button type="submit" className="primary">创建并进入章节</button>
                <button type="button" className="tab" onClick={() => setModalOpen(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>编辑章节</h3>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editModal.title.trim() || !editModal.content.trim()) return;
                updateChapter(novelId, editModal.id, {
                  title: editModal.title.trim(),
                  content: editModal.content.trim()
                });
                setEditModal(null);
              }}
            >
              <label>
                章节标题
                <input
                  value={editModal.title}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>
              <label>
                章节正文
                <textarea
                  className="large-input"
                  value={editModal.content}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, content: e.target.value }))}
                  required
                />
              </label>
              <div className="row">
                <button type="submit" className="primary">保存修改</button>
                <button type="button" className="tab" onClick={() => setEditModal(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {outlineModalOpen && (
        <div className="modal">
          <div className="modal-content large">
            <h3>生成大纲 - 选择题</h3>
            <div className="outline-question-list">
              {outlineQuestions.map((question) => {
                const selection = outlineSelections[question.id];
                return (
                  <div key={question.id} className="outline-question-card">
                    <div className="label">{question.title}</div>
                    <div className="outline-options">
                      {question.options.map((option) => (
                        <label key={option} className="outline-option">
                          <input
                            type="checkbox"
                            checked={selection.selected.includes(option)}
                            onChange={() => handleToggleOption(question.id, option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                    <label className="outline-other">
                      {question.otherLabel}
                      <input
                        value={selection.other}
                        onChange={(e) => handleOtherChange(question.id, e.target.value)}
                        placeholder="请输入"
                      />
                    </label>
                    <label className="outline-pending">
                      <input
                        type="checkbox"
                        checked={selection.pending}
                        onChange={() => handlePendingToggle(question.id)}
                      />
                      {question.pending}
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button type="button" className="primary" onClick={handleGeneratePrompt}>
                确认并生成提示词
              </button>
              <button type="button" className="tab" onClick={() => setOutlineModalOpen(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {promptModalOpen && (
        <div className="modal">
          <div className="modal-content large">
            <h3>大纲提示词</h3>
            <div className="prompt-layout">
              <div className="prompt-actions">
                <button type="button" onClick={handleCopyPrompt}>
                  一键复制
                </button>
                <button type="button" className="primary" onClick={handleSavePrompt}>
                  保存
                </button>
                <button type="button" className="tab" onClick={() => setPromptModalOpen(false)}>
                  关闭
                </button>
              </div>
              <div className="prompt-content">
                <textarea
                  className="large-input"
                  value={outlinePromptDraft}
                  onChange={(e) => setOutlinePromptDraft(e.target.value)}
                />
                {outlineSummary.length > 0 && (
                  <div className="prompt-summary">
                    {outlineSummary.map((item) => (
                      <div key={item.id} className="prompt-summary-item">
                        <div className="label">{item.title}</div>
                        <div className="muted">{item.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {outlineViewOpen && (
        <div className="modal">
          <div className="modal-content large">
            <div className="section-header">
              <h3>小说大纲</h3>
              <div className="resource-header-actions">
                {!outlineEditMode && (
                  <button type="button" className="ghost-button" onClick={() => setOutlineEditMode(true)}>
                    修改
                  </button>
                )}
                <button type="button" className="tab" onClick={() => setOutlineViewOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="tabs">
              {[
                { key: 'outline', label: '小说大纲' },
                { key: 'history', label: '大纲选择历史' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={outlineViewTab === tab.key ? 'tab active' : 'tab'}
                  onClick={() => setOutlineViewTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {outlineViewTab === 'outline' && (
              <>
                {outlineEditMode ? (
                  <div className="stack">
                    <textarea
                      className="large-input"
                      value={outlineDraft}
                      onChange={(e) => setOutlineDraft(e.target.value)}
                      placeholder="请输入小说大纲"
                    />
                    <div className="row">
                      <button type="button" className="primary" onClick={handleSaveOutline}>
                        保存
                      </button>
                      <button
                        type="button"
                        className="tab"
                        onClick={() => {
                          setOutlineDraft(novel.outlineText || '');
                          setOutlineEditMode(false);
                        }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="readonly-field multi-line">{outlineDraft || '暂无大纲'}</div>
                )}
              </>
            )}
            {outlineViewTab === 'history' && (
              <div className="stack">
                <div className="card subtle">
                  <div className="section-header">
                    <h4>提示词选择历史</h4>
                  </div>
                  {(novel.outlineSelectionHistory || []).length === 0 && (
                    <div className="empty">暂无提示词选择记录。</div>
                  )}
                  {(novel.outlineSelectionHistory || []).map((entry) => (
                    <div key={entry.id} className="card subtle">
                      <div className="section-header">
                        <div>
                          <div className="label">记录时间</div>
                          <div className="muted">{entry.createdAt}</div>
                        </div>
                        <div className="row">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!entry.prompt) return;
                              try {
                                await navigator.clipboard.writeText(entry.prompt);
                                alert('提示词已复制');
                              } catch (e) {
                                alert('复制失败，请手动复制');
                              }
                            }}
                          >
                            复制提示词
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(entry, null, 2)], {
                                type: 'application/json'
                              });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `outline-selection-${entry.id}.json`;
                              link.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            导出 JSON
                          </button>
                        </div>
                      </div>
                      <div className="prompt-summary">
                        {(entry.summary || []).map((item) => (
                          <div key={item.id} className="prompt-summary-item">
                            <div className="label">{item.title}</div>
                            <div className="muted">{item.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card subtle">
                  <div className="section-header">
                    <h4>大纲文本历史</h4>
                  </div>
                  {(novel.outlineVersions || []).length === 0 && (
                    <div className="empty">暂无大纲版本记录。</div>
                  )}
                  {(novel.outlineVersions || []).map((entry) => (
                    <div key={`outline-${entry.version}`} className="card subtle">
                      <div className="section-header">
                        <div>
                          <div className="label">版本 {entry.version}</div>
                          <div className="muted">{entry.updatedAt}</div>
                        </div>
                        <div className="row">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!entry.outlineText) return;
                              try {
                                await navigator.clipboard.writeText(entry.outlineText);
                                alert('大纲已复制');
                              } catch (e) {
                                alert('复制失败，请手动复制');
                              }
                            }}
                          >
                            复制大纲
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(entry, null, 2)], {
                                type: 'application/json'
                              });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `outline-version-${entry.version}.json`;
                              link.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            导出 JSON
                          </button>
                        </div>
                      </div>
                      <div className="readonly-field multi-line">
                        {entry.outlineText || '暂无内容'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {relationshipModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <div className="section-header">
              <h3>总关系网</h3>
              <div className="resource-header-actions">
                <button type="button" className="ghost-button" onClick={handleRelationshipExport}>
                  导出关系网
                </button>
                <label className="file-button">
                  导入关系网
                  <input type="file" accept="application/json" onChange={handleRelationshipImport} />
                </label>
                <button type="button" className="tab" onClick={() => setRelationshipModalOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="stack">
              {(() => {
                const graph = novel.relationshipGraph || { nodes: [], relations: [] };
                const relations = graph.relations || [];
                const rawNodes = graph.nodes || [];
                const relationNodes =
                  rawNodes.length > 0
                    ? rawNodes
                    : Array.from(
                        new Set(
                          relations.flatMap((rel) => [
                            rel.source,
                            rel.sourceId,
                            rel.from,
                            rel.fromId,
                            rel.sourceName,
                            rel.target,
                            rel.targetId,
                            rel.to,
                            rel.toId,
                            rel.targetName
                          ])
                        )
                      )
                        .filter(Boolean)
                        .map((name) => ({ id: name, name }));
                if (relations.length === 0) {
                  return <div className="empty">暂无关系网数据，可导 JSON 进行展示。</div>;
                }
                const characters = data.resources.characters || [];
                const findImage = (node) => {
                  const match = characters.find(
                    (character) => character.id === node.id || character.name === node.name
                  );
                  if (!match) return '';
                  const formViews = match.form?.[0]?.viewAssets || [];
                  const metaViews = match.meta?.viewAssets || [];
                  const front = formViews.find((asset) => asset.viewAngle === '正面');
                  return front?.src || formViews?.[0]?.src || metaViews?.[0]?.src || match.images?.[0] || '';
                };
                const positions = relationNodes.map((node, index) => {
                  const angle = (index / relationNodes.length) * Math.PI * 2;
                  return {
                    ...node,
                    key: node.id || node.name || `node-${index}`,
                    image: findImage(node),
                    position: {
                      x: 50 + 38 * Math.cos(angle),
                      y: 50 + 38 * Math.sin(angle)
                    }
                  };
                });
                const nodeMap = new Map(
                  positions.map((node) => [
                    String(node.id || node.name),
                    { x: node.position.x, y: node.position.y }
                  ])
                );
                return (
                  <div className="relation-board">
                    <div className="relation-network">
                      <svg className="relation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {relations.map((rel, index) => {
                          const source =
                            rel.source || rel.sourceId || rel.from || rel.fromId || rel.sourceName || '';
                          const target =
                            rel.target || rel.targetId || rel.to || rel.toId || rel.targetName || '';
                          const sourcePos = nodeMap.get(String(source));
                          const targetPos = nodeMap.get(String(target));
                          if (!sourcePos || !targetPos) return null;
                          return (
                            <line
                              key={`${source}-${target}-${index}`}
                              x1={sourcePos.x}
                              y1={sourcePos.y}
                              x2={targetPos.x}
                              y2={targetPos.y}
                            />
                          );
                        })}
                      </svg>
                      {positions.map((node) => (
                        <div
                          key={node.key}
                          className="relation-node rich"
                          style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
                        >
                          <div className="relation-node-avatar">
                            {node.image ? <img src={node.image} alt={node.name} /> : <div className="placeholder" />}
                          </div>
                          <div className="relation-node-name">{node.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovelDetail;
