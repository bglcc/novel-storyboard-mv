const ruleTemplates = {
  characters: {
    tool: '角色资源',
    description: '角色资源库与分镜头 AI / 图片回传交互规则说明。',
    parameters: {
      storyboardRules: {
        overview: '分镜头 AI 负责回传角色基础信息、形态信息、关系网等结构化内容。',
        baseInfo: {
          name: 'string，角色名称。',
          tags: 'string[]，角色标签数组。',
          background: 'string，角色背景描述，默认映射为基础信息展示内容。',
          priorityPin: 'boolean，是否置顶角色。',
          personalitySetting: 'string，性格设定（心理特征、动机、恐惧点等）。',
          growthTrajectory: 'string，成长轨迹描述（变化与转折点）。'
        },
        formInfo: {
          formName: 'string，形态名称；当需要新增形态时需提供。',
          persona: 'string，角色人设内容。',
          appearance: 'string，外貌描写内容，用于导出提示词。'
        },
        references: {
          referenceCharacterId: 'string，参考角色 ID。',
          referenceFormName: 'string，参考角色形态名称。',
          target: 'string，参考目标特征（如发型/服饰）。',
          weight: 'number，权重 0-100。'
        },
        relationshipGraph: {
          nodes: 'array，其他角色节点（id/name）。',
          relations:
            'array，中心角色与目标角色关系。字段示例：source/target/relation/emotions/currentEmotion/cause/consequence。'
        },
        characterGrowthHistory: {
          entries: 'array，角色成长史节点（chapter/change/description）。'
        }
      },
      imageRules: {
        overview: '图片由分镜头 AI 生成后回传，需标注视角或特征名称。',
        viewRequirements: 'string[]，视角需求列表（如正面、侧面、背面、45°等）。',
        viewAsset: {
          viewAngle: 'string，视角名称，需与 viewRequirements 对应。',
          fileName: 'string，建议命名：角色名-形态名-视角名-序号.ext。',
          storage: '本地部署使用 base64/Blob 存储在浏览器数据中，不支持直接写入本地路。'
        }
      }
    }
  },
  scenes: {
    tool: '场景资源',
    description: '场景资源库与分镜头 AI 的交互规则说明。',
    parameters: {
      storyboardRules: {
        overview: '分镜头 AI 负责回传场景结构、描述与图片需求。',
        sceneLayout: {
          elements: [
            {
              type: 'character|prop|background',
              name: '元素名称',
              x: '0~1 场景坐标',
              y: '0~1 场景坐标',
              direction: '0~360，仅角色需要'
            }
          ]
        },
        sceneDescription: 'string，场景整体描述。',
        sceneElementDetails: [
          {
            element: '元素名称',
            detail: '补充描写'
          }
        ],
        sceneVariants: [
          {
            name: '可选，场景版本名称',
            season: '季节',
            weather: '天气',
            time: '时间',
            imageRequirements: ['全景图-1', '全景图-2'],
            images: [{ label: '全景图-1', src: 'base64' }]
          }
        ]
      },
      imageRules: {
        overview: '图片由分镜头 AI 回传创建需求卡片，再人工或自动上传。',
        fileName: '建议命名：场景名-季节-时间-序号.ext（可在需求内说明）'
      },
      questions: [
        '是否需要将同类型场景（例如小炒店）归为同一标签以便参考？',
        '是否需要额外提供局部图或关键元素图的需求？'
      ]
    }
  },
  expression2d: {
    tool: '2D颜艺资源',
    description: '2D 颜艺资源库与分镜头 AI 的交互规则说明。',
    parameters: {
      storyboardRules: {
        overview: '分镜头 AI 负责回传表情基础信息、规则说明与生图包需求。',
        baseInfo: {
          name: 'string，表情名称。',
          tags: 'string[]，表情标签数组。',
          emotionType: 'string，情绪类型。',
          emotionValue: 'string，情绪强度。',
          background: 'string，匹配场景背景。'
        },
        ruleText: 'string，自然语言规则说明。',
        transferRequests: [
          {
            id: 'string，需求卡片 ID。',
            name: 'string，需求名称。',
            character: 'string，角色名称。',
            cover: 'string，可选，封面图 base64。'
          }
        ]
      },
      imageRules: {
        overview: '上传主参考图作为表情视觉锚点。',
        mainReference: '上传主参考图，建议命名：表情名-主参考.ext。'
      }
    }
  }
};


ruleTemplates.expressions = ruleTemplates.expression2d;

const ensureResourceRule = ({ type, rules = [], upsertRule }) => {
  const template = ruleTemplates[type];
  if (!template) return;
  const exists = rules.some((rule) => rule.tool === template.tool);
  if (exists) return;
  upsertRule(template);
};

export { ensureResourceRule };