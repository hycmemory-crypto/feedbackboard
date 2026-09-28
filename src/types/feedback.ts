export type ModuleType = '车控' | '导航' | '充电' | '社区' | '商城' | '账号';

export type IssueType = '紧急待修复' | 'Bug' | '体验摩擦' | '功能请求' | '咨询' | '表扬';

export type SeverityLevel = '阻断' | '高' | '中' | '低';

export type SentimentLevel = '强烈负面' | '负面' | '中性' | '正面';

export type FeedbackSource = 'App Store' | '客服工单' | '应用内反馈' | '社群';

export type DeviceModel =
  | 'iPhone 16 Pro Max'
  | 'iPhone 15 Pro'
  | 'iPhone 14'
  | '华为 Mate 60 Pro'
  | '华为 Pura 70'
  | '小米 14 Ultra'
  | '小米 13'
  | 'OPPO Find X7'
  | 'vivo X100 Pro'
  | '通用机型/未知';

export type ReviewRoutingReason =
  | 'emergency_spike'      // 突发紧急缺陷: 突发严重故障/核心崩溃，需紧急热更
  | 'blocker_safety'       // 严重程度为「阻断」: 涉及资金、安全、核心功能不可用，必须人工确认
  | 'low_confidence'        // Agent 分类置信度低: 多模块沾边或不确定
  | 'cross_category'       // 跨类问题: 包含两个独立问题
  | 'cluster_anomaly'      // 聚类中的异常项: 措辞或性质不同，可能误归
  | 'none';

export interface TagRecord {
  module: ModuleType;
  issueType: IssueType;
  severity: SeverityLevel;
  sentiment: SentimentLevel;
  deviceModel?: DeviceModel;
  symptomSummary?: string;
}

export interface FeedbackItem {
  id: string;
  originalText: string;
  cleanedText: string;
  source: FeedbackSource;
  deviceModel: DeviceModel; // 模块一：手机/客户端机型
  isEmergency?: boolean;    // 是否为突发性/紧急待修复需求
  createdAt: string;
  timestampMs: number;
  
  // Tagging
  module: ModuleType;
  issueType: IssueType;
  severity: SeverityLevel;
  sentiment: SentimentLevel;
  
  // Agent reasoning & analysis
  symptomSummary: string; // 用户处境与症状，而非单纯的提议
  agentReasoning: string;  // 自然语言分类理由（让 PM 一眼确认）
  confidence: number;      // 0 - 100
  
  // Review routing
  needsReview: boolean;
  reviewReason: ReviewRoutingReason;
  reviewStatus: 'pending' | 'confirmed' | 'modified';
  
  // Human corrections tracking
  originalTags?: TagRecord;
  correctedAt?: number;
  
  // Priority decision
  inPriorityList: boolean;
  priorityScore: number;
  priorityRank?: number;
  manualRankAdjusted?: boolean;
  
  // Cluster info
  clusterKey: string;      // e.g. "充电-Bug"
}

export interface ClusterSummary {
  key: string;             // e.g. "充电-Bug"
  module: ModuleType;
  issueType: IssueType;
  title: string;
  count: number;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgScore: number;
  maxScore: number;
  symptoms: string[];
  items: FeedbackItem[];
}

export interface CorrectionRecord {
  id: string;
  feedbackId: string;
  originalText: string;
  originalTags: TagRecord;
  correctedTags: TagRecord;
  correctedAt: number;
  notes?: string;
  injectedToFewShot: boolean;
}

export interface FilterState {
  module: ModuleType | '全部';
  issueType: IssueType | '全部';
  severity: SeverityLevel | '全部';
  sentiment: SentimentLevel | '全部';
  source: FeedbackSource | '全部';
  deviceModel: DeviceModel | '全部';
  reviewStatus: '全部' | '待复核' | '已确认' | '已修正';
  search: string;
  onlyPriority: boolean;
  onlyEmergency: boolean; // 快速筛选突发紧急需求
}

export interface PipelineFilterStat {
  rawCount: number;
  cleanedCount: number;
  dedupedCount: number;
  spamFilteredCount: number;
  tokensSaved: number;
  readyForAgentCount: number;
}
