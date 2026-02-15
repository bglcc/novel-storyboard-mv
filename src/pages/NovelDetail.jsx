import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import '../styles/novel-outline.css';
import '../styles/novel.css';

const statusColors = {
  未录入: 'gray',
  已录入: 'blue',
  待完成: 'orange',
  已完成: 'green'
};

const chapterStatusPriority = {
  待完成: 1,
  已录入: 2,
  未录入: 3,
  已完成: 4
};

const detailOutlineTemplate = {
  chapters: [
    {
      title: '第一章',
      detail: '章节细纲内容',
      tasks: [
        {
          id: 'task-001',
          type: '埋设',
          foreshadowNumber: 'FP-001',
          foreshadowTitle: '伏笔标题',
          status: '待完成'
        },
        {
          id: 'task-002',
          type: '资源运用',
          resourceType: '角色',
          resourceName: '角色A',
          note: '章节关键角色登场',
          status: '待完成'
        }
      ]
    }
  ],
  foreshadows: [
    {
      number: 1,
      description: '伏笔描述',
      type: '大型伏笔',
      status: '未埋设',
      buryRule: '埋设规则',
      recoverRule: '回收规则'
    }
  ]
};

const summaryTemplate = {
  summaryText: '本章结果摘要文本',
  tasks: [
    {
      id: 'task-001',
      status: '已完成'
    }
  ]
};

const foreshadowTypes = ['大型伏笔', '中型伏笔', '小型伏笔'];
const foreshadowStatuses = ['已回收', '正在推进', '已埋设', '未埋设'];
const resourceTypeOptions = ['角色', '场景', '道具', '表情'];

const parseOutlineChapters = (text) => {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const headingRegex = /^(第[一二三四五六七八九十百千0-9]+章|Chapter\s*\d+|CHAPTER\s*\d+)/;
  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  const hasHeadings = lines.some((line) => headingRegex.test(line));
  const chunks = [];
  if (hasHeadings) {
    let current = null;
    lines.forEach((line) => {
      if (headingRegex.test(line)) {
        if (current) chunks.push(current);
        current = { title: line, detail: '' };
      } else if (!current) {
        current = { title: `章节 ${chunks.length + 1}`, detail: line };
      } else {
        current.detail = current.detail ? `${current.detail}\n${line}` : line;
      }
    });
    if (current) chunks.push(current);
  } else {
    trimmed
      .split(/\n\s*\n+/)
      .map((block) => block.trim())
      .filter(Boolean)
      .forEach((block, index) => {
        const [firstLine, ...rest] = block.split('\n');
        const title = headingRegex.test(firstLine) ? firstLine : `章节 ${index + 1}`;
        const detail = headingRegex.test(firstLine) ? rest.join('\n').trim() : block;
        chunks.push({ title, detail });
      });
  }
  return chunks.map((chunk, index) => ({
    id: `outline-${index + 1}`,
    title: chunk.title || `章节 ${index + 1}`,
    detail: chunk.detail || ''
  }));
};

const normalizeResourceType = (value) => {
  if (!value) return resourceTypeOptions[0];
  if (['角色', '人物', 'character', 'characters'].includes(value)) return '角色';
  if (['场景', 'scene', 'scenes'].includes(value)) return '场景';
  if (['道具', 'prop', 'props'].includes(value)) return '道具';
  if (['表情', 'expression', 'expressions'].includes(value)) return '表情';
  return value;
};

const mapResourceTypeToKey = (value) => {
  switch (normalizeResourceType(value)) {
    case '角色':
      return 'characters';
    case '场景':
      return 'scenes';
    case '道具':
      return 'props';
    case '表情':
      return 'expressions';
    default:
      return '';
  }
};

const NovelDetail = () => {
  const { novelId } = useParams();
  const navigate = useNavigate();
  const { data, updateChapter, updateNovel, upsertRule, ensurePlaceholderResources } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const [activeTab, setActiveTab] = useState('outline');
  const [outlineEditMode, setOutlineEditMode] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState(novel?.outlineText || '');
  const [worldviewEditMode, setWorldviewEditMode] = useState(false);
  const [worldviewDraft, setWorldviewDraft] = useState(novel?.worldviewText || '');
  const [detailExpanded, setDetailExpanded] = useState({});
  const [detailEdit, setDetailEdit] = useState(null);
  const [foreshadowExpanded, setForeshadowExpanded] = useState({});
  const [uploadingChapterId, setUploadingChapterId] = useState('');
  const [summaryUploadingChapterId, setSummaryUploadingChapterId] = useState('');

  useEffect(() => {
    if (!novel) return;
    setOutlineDraft(novel.outlineText || '');
    setWorldviewDraft(novel.worldviewText || '');
  }, [novel]);

  useEffect(() => {
    if (!novel) return;
    const nextTab = (novel.detailOutlineChapters || []).length > 0 ? 'chapters' : 'outline';
    setActiveTab(nextTab);
  }, [novelId]);

  useEffect(() => {
    const defaultRules = [
      {
        tool: '细纲规则库',
        description: '细纲生成与任务清单的规则说明。',
        parameters: {
          overview: '用于生成章节细纲、伏笔埋设与资源运用任务清单的规则说明。',
          tasks: ['生成章节细纲', '输出伏笔埋设/回收任务清单', '输出资源运用清单', '维护章节任务进度'],
          exportSpec: {
            chapters: '章节细纲与任务清单（含资源运用）',
            foreshadows: '伏笔条目（编号/类型/状态/规则）',
            resourceIndex: '简易资源名称清单（仅名称）'
          },
          importSpec: {
            outline: '小说大纲（文本）',
            foreshadows: '伏笔资源库',
            chapters: '细纲章节列表',
            resourceIndex: '资源名称清单（角色/场景/道具/表情）'
          }
        }
      },
      {
        tool: '伏笔规则库',
        description: '伏笔管理与回收规则的规范说明。',
        parameters: {
          overview: '用于维护伏笔类型、状态、埋设/回收规则的规则说明。',
          tasks: ['新增伏笔条目', '维护伏笔埋设与回收规则', '追踪伏笔状态'],
          exportSpec: {
            foreshadows: '伏笔列表（编号/类型/状态/规则）'
          },
          importSpec: {
            foreshadows: '伏笔列表（编号/描述/类型/状态/规则）'
          }
        }
      },
      {
        tool: '摘要规则库',
        description: '结果摘要的输出与校验规范。',
        parameters: {
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
        }
      }
    ];
    defaultRules.forEach((rule) => {
      const exists = (data.rules || []).some((entry) => entry.tool === rule.tool);
      if (!exists) {
        upsertRule(rule);
      }
    });
  }, [data.rules, upsertRule]);

  if (!novel) return <div className="card">未找到小说。</div>;

  const computeChapterStatus = (chapter) => {
    if (!chapter) return '未录入';
    if (chapter.finalPackageDownloadedAt) return '已完成';
    if ((chapter.storyboards || []).length > 0) return '待完成';
    if ((chapter.content || '').trim()) return '已录入';
    return '未录入';
  };

  const detailOutlineChapters = novel.detailOutlineChapters || [];
  const outlineChapters = useMemo(
    () => parseOutlineChapters(novel?.outlineText || ''),
    [novel?.outlineText]
  );

  const mergedOutlineChapters = useMemo(() => {
    const detailMap = new Map(detailOutlineChapters.map((detail) => [detail.title, detail]));
    const merged = outlineChapters.map((outline) => {
      const detail = detailMap.get(outline.title);
      return {
        id: detail?.id || outline.id,
        title: outline.title,
        detail: detail?.detail || outline.detail,
        tasks: detail?.tasks || [],
        hasDetailOutline: Boolean(detail)
      };
    });
    const extraDetails = detailOutlineChapters.filter(
      (detail) => !outlineChapters.some((outline) => outline.title === detail.title)
    );
    return [...merged, ...extraDetails.map((detail) => ({ ...detail, hasDetailOutline: true }))];
  }, [detailOutlineChapters, outlineChapters]);

  const sortedChapters = useMemo(() => {
    const chapters = novel.chapters || [];
    const map = new Map();
    detailOutlineChapters.forEach((detail, index) => {
      map.set(detail.id, index);
    });
    return chapters
      .map((chapter) => ({
        ...chapter,
        computedStatus: computeChapterStatus(chapter),
        outlineIndex: map.has(chapter.detailOutlineId) ? map.get(chapter.detailOutlineId) : 9999
      }))
      .sort((a, b) => {
        const aPriority = chapterStatusPriority[a.computedStatus] || 99;
        const bPriority = chapterStatusPriority[b.computedStatus] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (aPriority === chapterStatusPriority['已完成']) {
          return (b.finalPackageDownloadedAt || 0) - (a.finalPackageDownloadedAt || 0);
        }
        if (a.outlineIndex !== b.outlineIndex) return a.outlineIndex - b.outlineIndex;
        return (b.storyboardUpdatedAt || 0) - (a.storyboardUpdatedAt || 0);
      });
  }, [detailOutlineChapters, novel.chapters]);

  const findDetailChapter = (chapter) => {
    if (!chapter) return null;
    if (chapter.detailOutlineId) {
      return detailOutlineChapters.find((entry) => entry.id === chapter.detailOutlineId) || null;
    }
    return detailOutlineChapters.find((entry) => entry.title === chapter.title) || null;
  };

  const findOutlineChapter = (chapter) => {
    if (!chapter) return null;
    return outlineChapters.find((entry) => entry.title === chapter.title) || null;
  };

  const handleOutlineUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('大纲内容为空');
        return;
      }
      let parsed = cleaned;
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        const json = JSON.parse(cleaned);
        parsed = json.outlineText || json.outline || json.text || cleaned;
      }
      updateNovel(novelId, {
        outlineText: parsed,
        outlineUpdatedAt: new Date().toISOString(),
        outlineStatus: '已上传'
      });
      setOutlineDraft(parsed);
    } catch (error) {
      alert('大纲解析失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveOutline = () => {
    const now = new Date().toISOString();
    updateNovel(novelId, {
      outlineText: outlineDraft.trim(),
      outlineUpdatedAt: now,
      outlineStatus: outlineDraft.trim() ? '已上传' : '未生成'
    });
    setOutlineEditMode(false);
  };

  const handleSaveWorldview = () => {
    updateNovel(novelId, { worldviewText: worldviewDraft.trim() });
    setWorldviewEditMode(false);
  };

  const normalizeDetailOutlineChapters = (payload) => {
    if (!Array.isArray(payload)) return [];
    return payload.map((item, index) => ({
      id: item.id || crypto.randomUUID(),
      title: item.title || `章节 ${index + 1}`,
      detail: item.detail || item.content || '',
      tasks: [
        ...(Array.isArray(item.tasks)
          ? item.tasks.map((task, taskIndex) => ({
              id: task.id || `task-${index + 1}-${taskIndex + 1}`,
              type: task.type || task.action || '埋设',
              foreshadowNumber: task.foreshadowNumber || task.foreshadowNo || '',
              foreshadowTitle: task.foreshadowTitle || task.foreshadow || '',
              resourceType: normalizeResourceType(task.resourceType || task.resourceCategory || ''),
              resourceName: task.resourceName || task.resource || '',
              note: task.note || task.description || '',
              status: task.status || (task.completed ? '已完成' : '待完成')
            }))
          : []),
        ...(Array.isArray(item.resourceUsage || item.resources)
          ? (item.resourceUsage || item.resources).map((resource, resourceIndex) => ({
              id: resource.id || `resource-${index + 1}-${resourceIndex + 1}`,
              type: '资源运用',
              resourceType: normalizeResourceType(resource.resourceType || resource.type || resource.category || ''),
              resourceName: resource.resourceName || resource.name || '',
              note: resource.note || resource.description || '',
              status: resource.status || (resource.completed ? '已完成' : '待完成')
            }))
          : [])
      ]
    }));
  };

  const handleGenerateDetailOutline = () => {
    const detailTitles = new Set(detailOutlineChapters.map((detail) => detail.title));
    const pendingOutlines = outlineChapters.filter((outline) => !detailTitles.has(outline.title));
    const nextBatch = (pendingOutlines.length ? pendingOutlines : outlineChapters).slice(0, 5);
    const fallbackChapters = Array.from({ length: 5 }).map((_, index) => ({
      title: `章节 ${detailOutlineChapters.length + index + 1}`,
      outline: ''
    }));
    const resourceIndex = {
      characters: (data.resources.characters || []).map((item) => item.name),
      scenes: (data.resources.scenes || []).map((item) => item.name),
      props: (data.resources.props || []).map((item) => item.name),
      expressions: (data.resources.expressions || []).map((item) => item.name)
    };
    const payload = {
      outlineText: novel.outlineText || '',
      chapters: nextBatch.length
        ? nextBatch.map((chapter) => ({
            title: chapter.title,
            outline: chapter.detail || ''
          }))
        : fallbackChapters,
      foreshadows: (novel.foreshadows || []).length ? novel.foreshadows : detailOutlineTemplate.foreshadows,
      resourceIndex,
      existingDetailOutline: detailOutlineChapters
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.title || 'novel'}-detail-outline.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const handleDetailOutlineUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('细纲内容为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      const detailChapters = normalizeDetailOutlineChapters(
        parsed.detailOutlineChapters || parsed.chapters || parsed.detailOutline || []
      );
      const foreshadows = Array.isArray(parsed.foreshadows) ? parsed.foreshadows : novel.foreshadows || [];
      const resourceTasks = detailChapters
        .flatMap((chapter) => chapter.tasks || [])
        .filter((task) => task.type === '资源运用' && task.resourceName);
      const missingResources = [];
      resourceTasks.forEach((task) => {
        const key = mapResourceTypeToKey(task.resourceType);
        if (!key) return;
        const exists = (data.resources[key] || []).some((item) => item.name === task.resourceName);
        if (!exists) {
          missingResources.push({
            type: key,
            name: task.resourceName
          });
        }
      });
      if (missingResources.length > 0) {
        ensurePlaceholderResources(missingResources, novelId);
      }
      const existingChapters = novel.chapters || [];
      const nextChapters = detailChapters.map((detail, index) => {
        const match = existingChapters.find((chapter) => chapter.detailOutlineId === detail.id)
          || existingChapters.find((chapter) => chapter.title === detail.title);
        if (match) {
          return { ...match, title: detail.title, detailOutlineId: detail.id };
        }
        return {
          id: crypto.randomUUID(),
          title: detail.title || `章节 ${index + 1}`,
          status: '未录入',
          content: '',
          storyboards: [],
          storyboardUpdatedAt: null,
          summaryText: '',
          summaryTasks: [],
          summaryTasksComplete: false,
          summaryUpdatedAt: null,
          finalPackageDownloadedAt: null,
          detailOutlineId: detail.id
        };
      });
      updateNovel(novelId, {
        detailOutlineChapters: detailChapters,
        detailOutlineUpdatedAt: new Date().toISOString(),
        foreshadows,
        chapters: nextChapters
      });
      alert('细纲已更新');
    } catch (error) {
      alert('细纲解析失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleDownloadDetailOutlineFix = (chapter) => {
    const detail = findDetailChapter(chapter);
    const payload = {
      chapter: detail || {
        title: chapter.title,
        detail: '',
        tasks: []
      },
      foreshadows: novel.foreshadows || [],
      note: '细纲修正资源包'
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'chapter'}-detail-outline-fix.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleChapterNovelDownload = (chapter) => {
    const detail = findDetailChapter(chapter);
    const resourceTasks = (detail?.tasks || []).filter((task) => task.type === '资源运用' && task.resourceName);
    const resourceNames = resourceTasks.reduce(
      (acc, task) => {
        const key = mapResourceTypeToKey(task.resourceType);
        if (!key) return acc;
        acc[key].add(task.resourceName);
        return acc;
      },
      {
        characters: new Set(),
        scenes: new Set(),
        props: new Set(),
        expressions: new Set()
      }
    );
    const resourceSubset = {
      characters: (data.resources.characters || []).filter((item) => resourceNames.characters.has(item.name)),
      scenes: (data.resources.scenes || []).filter((item) => resourceNames.scenes.has(item.name)),
      props: (data.resources.props || []).filter((item) => resourceNames.props.has(item.name)),
      expressions: (data.resources.expressions || []).filter((item) => resourceNames.expressions.has(item.name))
    };
    const payload = {
      novel: {
        id: novel.id,
        title: novel.title,
        outlineText: novel.outlineText || '',
        worldviewText: novel.worldviewText || ''
      },
      chapter: {
        id: chapter.id,
        title: chapter.title,
        detailOutline: detail || {},
        content: chapter.content || '',
        resourceUsage: resourceTasks
      },
      resources: resourceSubset,
      foreshadows: novel.foreshadows || [],
      relationshipGraph: novel.relationshipGraph || { nodes: [], relations: [] },
      rules: (data.rules || []).filter((rule) => (rule.tool || '').includes('生成小说'))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'chapter'}-novel.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleChapterUpload = async (chapterId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingChapterId(chapterId);
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('小说内容为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      const nextContent = parsed.content || parsed.text || parsed.chapter?.content || parsed.chapter?.text || '';
      const nextTitle = parsed.title || parsed.chapter?.title || '';
      const updates = { content: nextContent || '' };
      if (nextTitle) updates.title = nextTitle;
      updateChapter(novelId, chapterId, updates);
      alert('章节内容已更新');
    } catch (error) {
      alert('小说内容解析失败');
    } finally {
      setUploadingChapterId('');
      event.target.value = '';
    }
  };

  const handleGenerateSummary = (chapter) => {
    const detail = findDetailChapter(chapter);
    const payload = {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      summaryText: summaryTemplate.summaryText,
      tasks: (detail?.tasks || []).length ? detail.tasks : summaryTemplate.tasks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chapter.title || 'chapter'}-summary.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSummaryUpload = async (chapter, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSummaryUploadingChapterId(chapter.id);
      const text = await file.text();
      const cleaned = text.replace(/^\uFEFF/, '').trim();
      if (!cleaned) {
        alert('摘要内容为空');
        return;
      }
      let parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      const summaryText = parsed.summaryText || parsed.summary || parsed.text || '';
      const incomingTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const detail = findDetailChapter(chapter);
      const requiredTasks = detail?.tasks || [];
      const mergedTasks = requiredTasks.map((task) => {
        const match = incomingTasks.find((item) => {
          if (item.id && item.id === task.id) return true;
          if (task.type === '资源运用') {
            return (
              item.resourceName === task.resourceName &&
              normalizeResourceType(item.resourceType || item.resourceCategory) === normalizeResourceType(task.resourceType)
            );
          }
          return item.foreshadowNumber === task.foreshadowNumber;
        });
        const status = match?.status || (match?.completed ? '已完成' : task.status || '待完成');
        return { ...task, status };
      });
      const tasksComplete = mergedTasks.length
        ? mergedTasks.every((task) => task.status === '已完成')
        : Boolean(parsed.tasksComplete || parsed.completed || false);
      const resolveNextChapter = () => {
        if (!detailOutlineChapters.length) return null;
        const currentDetailIndex = detailOutlineChapters.findIndex(
          (entry) => entry.id === detail?.id || entry.title === chapter.title
        );
        if (currentDetailIndex >= 0 && currentDetailIndex < detailOutlineChapters.length - 1) {
          const nextDetail = detailOutlineChapters[currentDetailIndex + 1];
          return (novel.chapters || []).find(
            (item) => item.detailOutlineId === nextDetail.id || item.title === nextDetail.title
          );
        }
        const chapterIndex = (novel.chapters || []).findIndex((item) => item.id === chapter.id);
        if (chapterIndex >= 0 && chapterIndex < (novel.chapters || []).length - 1) {
          return (novel.chapters || [])[chapterIndex + 1];
        }
        return null;
      };
      const nextChapter = resolveNextChapter();
      updateChapter(novelId, chapter.id, {
        summaryText,
        summaryTasks: mergedTasks,
        summaryTasksComplete: tasksComplete,
        summaryUpdatedAt: new Date().toISOString()
      });
      if (nextChapter) {
        updateChapter(novelId, nextChapter.id, {
          recapText: summaryText,
          recapSourceChapterId: chapter.id
        });
      }
      if (detail) {
        const nextDetailChapters = detailOutlineChapters.map((item) =>
          item.id === detail.id ? { ...item, tasks: mergedTasks } : item
        );
        updateNovel(novelId, { detailOutlineChapters: nextDetailChapters });
      }
      if (!nextChapter) {
        alert('摘要已上传，但未找到下一章承接前情提要');
      } else {
        alert(tasksComplete ? '摘要已确认，任务完成' : '摘要已上传，仍有未完成任务');
      }
    } catch (error) {
      alert('摘要解析失败');
    } finally {
      setSummaryUploadingChapterId('');
      event.target.value = '';
    }
  };

  const handleForeshadowUpdate = (id, updates) => {
    const next = (novel.foreshadows || []).map((item) => (item.id === id ? { ...item, ...updates } : item));
    updateNovel(novelId, { foreshadows: next });
  };

  const handleForeshadowAdd = () => {
    const existing = novel.foreshadows || [];
    const maxNumber = existing.reduce((acc, item) => Math.max(acc, item.number || 0), 0);
    const next = {
      id: crypto.randomUUID(),
      number: maxNumber + 1,
      description: '新的伏笔描述',
      type: foreshadowTypes[0],
      status: '未埋设',
      buryRule: '',
      recoverRule: ''
    };
    updateNovel(novelId, { foreshadows: [...existing, next] });
  };

  const handleForeshadowDelete = (id) => {
    const next = (novel.foreshadows || []).filter((item) => item.id !== id);
    updateNovel(novelId, { foreshadows: next });
  };

  const renderRelationshipGraph = () => {
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
      return <div className="empty">暂无关系网数据，可导入 JSON 进行展示。</div>;
    }
    const characters = data.resources.characters || [];
    const findImage = (node) => {
      const match = characters.find((character) => character.id === node.id || character.name === node.name);
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
      positions.map((node) => [String(node.id || node.name), { x: node.position.x, y: node.position.y }])
    );
    return (
      <div className="relation-board">
        <div className="relation-network">
          <svg className="relation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            {relations.map((rel, index) => {
              const source = rel.source || rel.sourceId || rel.from || rel.fromId || rel.sourceName || '';
              const target = rel.target || rel.targetId || rel.to || rel.toId || rel.targetName || '';
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
  };

  return (
    <div className="card novel-detail">
      <div className="space-between">
        <div>
          <h2>{novel.title} - 章节管理</h2>
          <p className="muted">使用 TAB 切换章节、世界观、大纲与伏笔管理。</p>
        </div>
        <div className="row">
          <Link to="/" className="tab">返回书架</Link>
        </div>
      </div>

      <div className="tabs tab-bar">
        {[
          { id: 'chapters', label: '小说章节' },
          { id: 'worldview', label: '世界观' },
          { id: 'outline', label: '大纲' },
          { id: 'foreshadow', label: '伏笔管理' },
          { id: 'relationship', label: '总关系网' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'chapters' && (
        <div className="stack">
          {sortedChapters.length === 0 && <div className="empty">暂无章节，请先上传细纲。</div>}
          {sortedChapters.map((chapter) => {
            const detail = findDetailChapter(chapter);
            const outline = findOutlineChapter(chapter);
            const status = chapter.computedStatus || computeChapterStatus(chapter);
            const summaryComplete = chapter.summaryTasksComplete;
            const showSummaryActions = Boolean(chapter.content?.trim());
            return (
              <div key={chapter.id} className="list-item chapter-item">
                <div className="chapter-main">
                  <button
                    className="ghost"
                    onClick={() => navigate(`/novel/${novelId}/chapter/${chapter.id}`)}
                  >
                    <div className="list-title chapter-title underline">{chapter.title}</div>
                  </button>
                  {detail?.detail ? (
                    <div className="muted">细纲：{detail.detail}</div>
                  ) : (
                    outline?.detail && <div className="muted">大纲：{outline.detail}</div>
                  )}
                </div>
                <div className="chapter-meta">
                  <div className={`status-pill ${statusColors[status] || 'gray'}`}>{status}</div>
                  <div className="chapter-actions">
                    {!showSummaryActions && (
                      <>
                        <button type="button" onClick={() => handleChapterNovelDownload(chapter)}>
                          生成小说
                        </button>
                        <label className="file-button">
                          上传小说
                          <input
                            type="file"
                            accept="application/json"
                            disabled={uploadingChapterId === chapter.id}
                            onChange={(event) => handleChapterUpload(chapter.id, event)}
                          />
                        </label>
                      </>
                    )}
                    {showSummaryActions && !summaryComplete && (
                      <>
                        {!chapter.summaryText && (
                          <button type="button" onClick={() => handleGenerateSummary(chapter)}>
                            生成摘要
                          </button>
                        )}
                        {chapter.summaryText && (
                          <button type="button" onClick={() => handleDownloadDetailOutlineFix(chapter)}>
                            修改细纲
                          </button>
                        )}
                        <label className="file-button">
                          上传摘要
                          <input
                            type="file"
                            accept="application/json"
                            disabled={summaryUploadingChapterId === chapter.id}
                            onChange={(event) => handleSummaryUpload(chapter, event)}
                          />
                        </label>
                        {chapter.summaryText && (
                          <label className="file-button">
                            上传细纲
                            <input type="file" accept="application/json" onChange={handleDetailOutlineUpload} />
                          </label>
                        )}
                      </>
                    )}
                    {showSummaryActions && summaryComplete && (
                      <Link to={`/novel/${novelId}/chapter/${chapter.id}`} className="primary-button">
                        进入章节
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'worldview' && (
        <div className="card subtle">
          <div className="section-header">
            <h3>世界观设定</h3>
            <div className="row">
              {!worldviewEditMode && (
                <button type="button" className="ghost-button" onClick={() => setWorldviewEditMode(true)}>
                  编辑
                </button>
              )}
            </div>
          </div>
          {worldviewEditMode ? (
            <div className="stack">
              <textarea
                className="large-input"
                value={worldviewDraft}
                onChange={(event) => setWorldviewDraft(event.target.value)}
                placeholder="填写世界观设定"
              />
              <div className="row">
                <button type="button" className="primary" onClick={handleSaveWorldview}>
                  保存
                </button>
                <button
                  type="button"
                  className="tab"
                  onClick={() => {
                    setWorldviewDraft(novel.worldviewText || '');
                    setWorldviewEditMode(false);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="readonly-field multi-line">{novel.worldviewText || '暂无世界观设定。'}</div>
          )}
        </div>
      )}

      {activeTab === 'outline' && (
        <div className="stack">
          <div className="card subtle">
            <div className="section-header">
              <h3>小说大纲</h3>
              <div className="row">
                {!outlineEditMode && (
                  <button type="button" className="ghost-button" onClick={() => setOutlineEditMode(true)}>
                    修改
                  </button>
                )}
                <label className="file-button">
                  上传大纲
                  <input type="file" accept="application/json,text/plain" onChange={handleOutlineUpload} />
                </label>
              </div>
            </div>
            {outlineEditMode ? (
              <div className="stack">
                <textarea
                  className="large-input"
                  value={outlineDraft}
                  onChange={(event) => setOutlineDraft(event.target.value)}
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
              <div className="readonly-field multi-line">{novel.outlineText || '暂无大纲。'}</div>
            )}
          </div>

          <div className="card subtle">
            <div className="section-header">
              <div>
                <h3>细纲与任务清单</h3>
                <div className="muted">章节细纲以文件夹形式展示，右侧按钮可生成或上传细纲。</div>
              </div>
              <div className="row">
                <button type="button" onClick={handleGenerateDetailOutline}>
                  生成细纲
                </button>
                <label className="file-button">
                  上传细纲
                  <input type="file" accept="application/json" onChange={handleDetailOutlineUpload} />
                </label>
              </div>
            </div>
            {mergedOutlineChapters.length === 0 && <div className="empty">暂无细纲内容。</div>}
            <div className="detail-outline-list">
              {mergedOutlineChapters.map((detail) => {
                const totalTasks = detail.tasks?.length || 0;
                const completed = (detail.tasks || []).filter((task) => task.status === '已完成').length;
                const progress = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
                const expanded = detailExpanded[detail.id];
                return (
                  <div key={detail.id} className="detail-outline-card">
                    <div className="detail-outline-header">
                      <div>
                        <div className="folder-title">{detail.title}</div>
                        <div className="muted">
                          {detail.hasDetailOutline ? '细纲已生成' : '仅显示大纲'}
                          {detail.hasDetailOutline && ` · 任务完成度：${completed}/${totalTasks || 0}`}
                        </div>
                      </div>
                      <div className="row">
                        {detail.hasDetailOutline && (
                          <button type="button" onClick={() => setDetailEdit(detail)}>
                            修改
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            setDetailExpanded((prev) => ({ ...prev, [detail.id]: !prev[detail.id] }))
                          }
                        >
                          ▽
                        </button>
                      </div>
                    </div>
                    {detail.hasDetailOutline && (
                      <div className="progress-bar">
                        <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <div className="detail-outline-body">
                      <div className="readonly-field multi-line">
                        {detail.detail || (detail.hasDetailOutline ? '暂无细纲描述' : '暂无大纲内容')}
                      </div>
                      {expanded && detail.hasDetailOutline && (
                        <div className="detail-outline-tasks">
                          {(detail.tasks || []).length === 0 && <div className="empty">暂无任务。</div>}
                          {(detail.tasks || []).map((task) => (
                            <div key={task.id} className="task-row">
                              <div>
                                <div className="label">
                                  {task.type}：
                                  {task.type === '资源运用'
                                    ? `${task.resourceName || '未指定资源'}`
                                    : task.foreshadowTitle || task.foreshadowNumber || '伏笔任务'}
                                </div>
                                {task.type === '资源运用' ? (
                                  <div className="muted">
                                    类型：{task.resourceType || '未指定'} {task.note ? `· ${task.note}` : ''}
                                  </div>
                                ) : (
                                  <div className="muted">伏笔编号：{task.foreshadowNumber || '未指定'}</div>
                                )}
                              </div>
                              <div className={`status-pill ${task.status === '已完成' ? 'green' : 'orange'}`}>
                                {task.status || '待完成'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'foreshadow' && (
        <div className="stack">
          <div className="section-header">
            <div>
              <h3>伏笔管理</h3>
              <div className="muted">管理伏笔描述、类型与回收状态。</div>
            </div>
            <button type="button" className="primary" onClick={handleForeshadowAdd}>
              + 新增伏笔
            </button>
          </div>
          <div className="foreshadow-table">
            <div className="foreshadow-row foreshadow-header">
              <div>编号</div>
              <div>伏笔描述</div>
              <div>伏笔类型</div>
              <div>回收状态</div>
              <div>操作</div>
            </div>
            <>
              {(novel.foreshadows || []).map((item) => {
                const expanded = foreshadowExpanded[item.id];
                const numberLabel = `FP-${String(item.number || 0).padStart(3, '0')}`;
                return (
                  <div key={item.id} className="foreshadow-card">
                    <div className="foreshadow-row">
                      <div className="foreshadow-number">{numberLabel}</div>
                      <div>
                        <input
                          className="inline-input"
                          value={item.description}
                          onChange={(event) => handleForeshadowUpdate(item.id, { description: event.target.value })}
                        />
                      </div>
                      <div>
                        <select
                          value={item.type}
                          onChange={(event) => handleForeshadowUpdate(item.id, { type: event.target.value })}
                        >
                          {foreshadowTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={item.status}
                          onChange={(event) => handleForeshadowUpdate(item.id, { status: event.target.value })}
                        >
                          {foreshadowStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="row">
                        <button type="button" onClick={() => handleForeshadowUpdate(item.id, { status: '已回收' })}>
                          回收
                        </button>
                        <button type="button" className="ghost-button" onClick={() => handleForeshadowDelete(item.id)}>
                          删除
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() =>
                            setForeshadowExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                          }
                        >
                          ▽
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="foreshadow-detail">
                        <label className="stack">
                          伏笔描述
                          <textarea
                            value={item.description}
                            onChange={(event) => handleForeshadowUpdate(item.id, { description: event.target.value })}
                          />
                        </label>
                        <label className="stack">
                          埋设规则
                          <textarea
                            value={item.buryRule}
                            onChange={(event) => handleForeshadowUpdate(item.id, { buryRule: event.target.value })}
                          />
                        </label>
                        <label className="stack">
                          回收规则
                          <textarea
                            value={item.recoverRule}
                            onChange={(event) => handleForeshadowUpdate(item.id, { recoverRule: event.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              {(novel.foreshadows || []).length === 0 && <div className="empty">暂无伏笔条目。</div>}
            </>
          </div>
        </div>
      )}

      {activeTab === 'relationship' && (
        <div className="stack">
          <div className="section-header">
            <div>
              <h3>总关系网</h3>
              <div className="muted">根据上传小说的关系网数据生成静态关系图。</div>
            </div>
            <div className="row">
              <label className="file-button">
                导入关系网
                <input
                  type="file"
                  accept="application/json"
                  onChange={async (event) => {
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
                      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                      updateNovel(novelId, { relationshipGraph: parsed });
                    } catch (error) {
                      alert('关系网 JSON 解析失败');
                    } finally {
                      event.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
          {renderRelationshipGraph()}
        </div>
      )}

      {detailEdit && (
        <div className="modal">
          <div className="modal-content">
            <h3>修改细纲</h3>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const nextDetailChapters = detailOutlineChapters.map((item) =>
                  item.id === detailEdit.id ? { ...item, detail: detailEdit.detail } : item
                );
                updateNovel(novelId, { detailOutlineChapters: nextDetailChapters });
                setDetailEdit(null);
              }}
            >
              <label>
                章节标题
                <input value={detailEdit.title} disabled />
              </label>
              <label>
                细纲内容
                <textarea
                  className="large-input"
                  value={detailEdit.detail}
                  onChange={(event) => setDetailEdit((prev) => ({ ...prev, detail: event.target.value }))}
                />
              </label>
              <div className="row">
                <button type="submit" className="primary">保存</button>
                <button type="button" className="tab" onClick={() => setDetailEdit(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovelDetail;
