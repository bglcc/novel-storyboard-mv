import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import '../styles/rule-library.css';

const ruleGroups = [
  {
    id: 'storyboard',
    label: '分镜头主流程',
    children: [
      { id: 'storyboard-outline', label: '分镜头大纲规则库', tool: '分镜头大纲规则库' },
      { id: 'storyboard-detail', label: '分镜头细纲规则库', tool: '分镜头细纲规则库' },
      { id: 'keyframe', label: '关键帧使用规范', tool: '关键帧使用规范' },
      { id: 'clip-delivery', label: '下载至剪映规范', tool: '下载至剪映规范' }
    ]
  },
  {
    id: 'storage',
    label: '存储与交付',
    children: [
      { id: 'local-service', label: '本地小服务存储规范', tool: '本地小服务存储规范' },
      { id: 'path-stack', label: '路径双栈策略', tool: '路径双栈策略' }
    ]
  },
  {
    id: 'resources',
    label: '资源管理',
    children: [
      { id: 'character', label: '角色资源规范', tool: '角色资源规范' },
      { id: 'scene', label: '场景资源规范', tool: '场景资源规范' },
      { id: 'prop', label: '道具资源规范', tool: '道具资源规范' }
    ]
  }
];

const defaultRuleMap = {
  分镜头大纲规则库: {
    description: '生成分镜头大纲并执行串行细纲生产的规则。',
    overview: '输入章节细纲、资源名称索引，输出可执行的分镜头大纲。',
    tasks: ['输出分镜头大纲序号与内容', '标记上一条细纲未上传时的锁定规则', '支持大纲悬浮下载/上传细纲'],
    exportSpec: {
      outlineItems: '分镜头大纲列表（序号/文本）',
      lockRule: '串行细纲锁定规则'
    },
    importSpec: {
      chapterDetailOutline: '章节细纲文本',
      resourceNameIndex: '角色/场景/道具资源名称列表'
    }
  },
  分镜头细纲规则库: {
    description: 'L1-L4 分级细纲生产与衔接规则。',
    overview: '每个镜头必须包含六项常规资源字段并可选关键帧。',
    tasks: ['按 L1-L4 输出流程字段', '提供上一镜头衔接信息', '输出镜头完成条件'],
    exportSpec: {
      storyboardShot: '镜头细纲结构（分级/资源/提示词/上传要求）'
    },
    importSpec: {
      outlineItem: '分镜头大纲条目',
      previousShot: '上一镜头细纲（用于衔接）'
    }
  },
  关键帧使用规范: {
    description: '关键帧按需启用，L1 以外镜头可使用。',
    overview: '关键帧不是常驻栏目，仅在镜头需要时开启。',
    tasks: ['启用关键帧开关', '按行维护关键帧文本', '导出到章节交付包'],
    exportSpec: {
      keyframes: '关键帧文本数组'
    },
    importSpec: {
      shotContext: '镜头内容上下文'
    }
  },
  下载至剪映规范: {
    description: '章节全部镜头完成后导出剪映包并回传纯文本代码。',
    overview: '剪映小助手为章节级进度节点，不属于 L1-L4 层级。',
    tasks: ['校验章节镜头完成状态', '导出章节资源包', '回传剪映代码纯文本'],
    exportSpec: {
      jianyingPackage: '章节 JSON 资源包',
      clipScriptText: '剪映代码（纯文本）'
    },
    importSpec: {
      shots: '章节全部镜头',
      resources: '镜头关联资源索引'
    }
  },
  本地小服务存储规范: {
    description: '采用本地服务进行大文件与路径写入。',
    overview: '存储路径结构：小说/章节（序号+标题）/资源类型/二级资源类型/文件。',
    tasks: ['保存图片与 MP4', '自动命名与防重名', '去重与文件校验'],
    exportSpec: {
      localPath: '本地路径',
      saveMeta: '写入时间与文件信息'
    },
    importSpec: {
      targetRoot: '目标盘路径',
      fileStream: '文件流'
    }
  },
  路径双栈策略: {
    description: '保留 localPath + remoteUrl 双栈字段。',
    overview: '初期默认优先 localPath，可按规则切换 URL。',
    tasks: ['维护双栈字段', '导出时保留 sourceType'],
    exportSpec: {
      localPath: '本地路径',
      remoteUrl: '远程 URL'
    },
    importSpec: {
      sourceType: 'local/url'
    }
  },
  角色资源规范: {
    description: '角色必须有正面绿幕图，侧面/背面可选。',
    overview: '角色资源在分镜右侧补齐，资源库用于管理。',
    tasks: ['建立角色基础档案', '上传初始图', '维护形态与Q版分类'],
    exportSpec: {
      character: '角色基础档案 + 图像索引'
    },
    importSpec: {
      roleJson: '角色 JSON 档案'
    }
  },
  场景资源规范: {
    description: '场景必须具备全景图。',
    overview: '场景以章节和镜头复用为目标。',
    tasks: ['上传全景图', '记录场景布局说明'],
    exportSpec: {
      scene: '场景信息 + 全景图索引'
    },
    importSpec: {
      sceneJson: '场景 JSON 档案'
    }
  },
  道具资源规范: {
    description: '道具必须具备正面图并支持变体。',
    overview: '同一主道具下可管理颜色/材质/刻字等变体并可标记持有人。',
    tasks: ['创建主道具', '维护变体与持有人', '镜头绑定具体变体'],
    exportSpec: {
      prop: '主道具与变体列表'
    },
    importSpec: {
      propJson: '道具 JSON 档案'
    }
  }
};

const changelogDefaults = [
  { id: 'log-1', date: '2026-02-19', note: '流程重构：分镜头改为 L1-L4，剪映小助手改为章节级交付节点。' },
  { id: 'log-2', date: '2026-02-19', note: '规则库新增：分镜头大纲/细纲、关键帧规范、本地小服务存储规范。' }
];

const RuleLibrary = () => {
  const { data, upsertRule } = useData();
  const [selectedTool, setSelectedTool] = useState('分镜头大纲规则库');

  const activeRule = useMemo(() => {
    return (data.rules || []).find((rule) => rule.tool === selectedTool);
  }, [data.rules, selectedTool]);

  const mergedRule = activeRule || {
    tool: selectedTool,
    ...(defaultRuleMap[selectedTool] || {
      description: '未配置规则',
      overview: '',
      tasks: [],
      exportSpec: {},
      importSpec: {}
    })
  };

  const handleInitDefaults = () => {
    Object.entries(defaultRuleMap).forEach(([tool, payload]) => {
      const exists = (data.rules || []).some((rule) => rule.tool === tool);
      if (!exists) {
        upsertRule({ tool, ...payload });
      }
    });
    alert('已补齐本次改造所需规则。');
  };

  const groups = ruleGroups;

  return (
    <div className="rule-layout">
      <aside className="rule-sidebar">
        <div className="rule-sidebar-header">
          <h3>规则目录</h3>
          <button type="button" className="tab" onClick={handleInitDefaults}>初始化本次规则</button>
        </div>
        {groups.map((group) => (
          <div key={group.id} className="rule-group">
            <h4>{group.label}</h4>
            {group.children.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rule-item ${selectedTool === item.tool ? 'active' : ''}`}
                onClick={() => setSelectedTool(item.tool)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="rule-content card">
        <h2>{mergedRule.tool}</h2>
        <p>{mergedRule.description}</p>
        <div className="stack">
          <div>
            <h4>概述</h4>
            <pre>{mergedRule.overview || '暂无'}</pre>
          </div>
          <div>
            <h4>任务</h4>
            <ul>
              {(mergedRule.tasks || []).map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>导出规范</h4>
            <pre>{JSON.stringify(mergedRule.exportSpec || {}, null, 2)}</pre>
          </div>
          <div>
            <h4>导入规范</h4>
            <pre>{JSON.stringify(mergedRule.importSpec || {}, null, 2)}</pre>
          </div>
          <div>
            <h4>更新日志</h4>
            <ul>
              {changelogDefaults.map((log) => (
                <li key={log.id}>{log.date} - {log.note}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RuleLibrary;
