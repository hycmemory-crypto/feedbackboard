import { CorrectionRecord, TagRecord, FeedbackItem } from '../types/feedback';

const STORAGE_KEY = 'autofeedback_few_shot_records_v1';

export const INITIAL_CORRECTIONS: CorrectionRecord[] = [
  {
    id: 'CORR-001',
    feedbackId: 'FB-CASE-9901',
    originalText: '能不能在首页加个一键充电按钮啊？每次在公共桩充电，都要先点爱车页，再点充电管理，在大太阳底下找好半天！',
    originalTags: {
      module: '充电',
      issueType: '功能请求',
      severity: '低',
      sentiment: '中性',
      symptomSummary: '用户要求在首页加一键充电按钮',
    },
    correctedTags: {
      module: '充电',
      issueType: '功能请求',
      severity: '中',
      sentiment: '中性',
      symptomSummary: '公共充电扫码启动流程嵌套三级页面，户外高照度场景操作摩擦过大（定位于效率摩擦，而非盲目记加按钮）',
    },
    correctedAt: Date.now() - 3600000 * 48,
    notes: '核心原则应用：用户说的是症状不是解决方案，严重度由低纠偏为中（影响高频场景体验）',
    injectedToFewShot: true,
  },
  {
    id: 'CORR-002',
    feedbackId: 'FB-CASE-9902',
    originalText: '在特来电快充桩扫码付款85元，扣款成功后充电桩报错红灯未供电，App一直显示正在充电中！',
    originalTags: {
      module: '充电',
      issueType: 'Bug',
      severity: '高',
      sentiment: '负面',
      symptomSummary: '扫码充电启动失败',
    },
    correctedTags: {
      module: '充电',
      issueType: 'Bug',
      severity: '阻断',
      sentiment: '强烈负面',
      symptomSummary: '涉及即时资金损失与断电趴窝风险，符合最高阻断级判据',
    },
    correctedAt: Date.now() - 3600000 * 72,
    notes: '严重度纠偏：只要涉及实际资金扣减或用户受困，严格定级为阻断，不可仅定为高',
    injectedToFewShot: true,
  },
  {
    id: 'CORR-003',
    feedbackId: 'FB-CASE-9903',
    originalText: '车控App里的车顶行李架3D模型跟实际提车选配的不一致，能不能改过来？',
    originalTags: {
      module: '车控',
      issueType: 'Bug',
      severity: '中',
      sentiment: '中性',
      symptomSummary: '3D车模配置渲染错误',
    },
    correctedTags: {
      module: '车控',
      issueType: '体验摩擦',
      severity: '低',
      sentiment: '中性',
      symptomSummary: '3D车模选配渲染局部视觉不一致，不影响任何车控开关或任务',
    },
    correctedAt: Date.now() - 3600000 * 96,
    notes: '区分修Bug与视觉体验：非功能失效降级为体验摩擦/低',
    injectedToFewShot: true,
  }
];

export function getStoredCorrections(): CorrectionRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load few-shot corrections from localStorage', e);
  }
  return INITIAL_CORRECTIONS;
}

export function saveCorrections(records: CorrectionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save few-shot corrections to localStorage', e);
  }
}

/**
 * 组装注入到 Gemini Agent 的动态系统提示词（含 Few-Shot 样本）
 */
export function buildAgentSystemPrompt(corrections: CorrectionRecord[]): string {
  const activeFewShots = corrections.filter(c => c.injectedToFewShot);

  return `你是一名专门服务于新能源车企 App 的资深产品经理分类 Agent。
你的任务是将用户的原始抱怨、求助或建议，转化为结构化、高保真的多维标签与产品痛点定义。

【核心原则】
1. 用户说的是症状，不是解决方案：
   - 用户说"能不能加个一键充电按钮" -> 提炼为「充电模块 / 效率摩擦 / 充电扫码路径层级过深」，而非直接记成"加按钮"。
   - 标签必须基于用户处境，而非用户的提议。
2. 严重程度判定标准（严格执行）：
   - 阻断：涉及资金损失（扣款不履约、积分消失）、安全隐患、车辆控制失效（极端天冷锁车内/无法开门/蓝牙钥匙离线失效）。
   - 高：核心流程走不通，但有替代方案（如手机App路线加电规划闪退，但可用车机大屏）。
   - 中：体验明显变差但不影响任务完成（延迟大、图表刷新慢、步骤繁杂）。
   - 低：建议 / 锦上添花 / 视觉槽点。
3. 人工复核主动路由触发：
   - 严重度为阻断级时；
   - 跨模块复合诉求时；
   - 置信度低于75%时。

【人工复核沉淀的 Few-Shot 标注修正示范（PM 人工指导）】
${activeFewShots.map((item, idx) => `
### 修正样本 #${idx + 1}
- 用户原始反馈: "${item.originalText}"
- 初始 Agent 误判: 模块:${item.originalTags.module} | 类型:${item.originalTags.issueType} | 严重度:${item.originalTags.severity}
- PM 人工纠偏正确标签: 模块:${item.correctedTags.module} | 类型:${item.correctedTags.issueType} | 严重度:${item.correctedTags.severity}
- PM 纠偏关键处境: ${item.correctedTags.symptomSummary}
- PM 规则说明: ${item.notes || '规范化标准标签'}
`).join('\n')}

请始终以客观、理性的产品经理视角输出分类与简短自然的决策理由。`;
}
