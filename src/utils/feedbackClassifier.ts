import {
  FeedbackItem,
  FeedbackSource,
  DeviceModel,
  IssueType,
  ModuleType,
  ReviewRoutingReason,
  SentimentLevel,
  SeverityLevel,
  PipelineFilterStat,
} from '../types/feedback';
import { calculatePriorityScore } from './priorityScorer';

// 常见机型识别规则
export function detectDeviceModelFromText(text: string, defaultDevice: DeviceModel = 'iPhone 15 Pro'): DeviceModel {
  const lower = text.toLowerCase();
  if (lower.includes('iphone 16') || lower.includes('16 pro') || lower.includes('16promax')) return 'iPhone 16 Pro Max';
  if (lower.includes('iphone 15') || lower.includes('15 pro')) return 'iPhone 15 Pro';
  if (lower.includes('iphone 14') || lower.includes('iphone 12') || lower.includes('iphone 13') || lower.includes('ios')) return 'iPhone 14';
  if (lower.includes('mate 60') || lower.includes('mate60') || lower.includes('鸿蒙')) return '华为 Mate 60 Pro';
  if (lower.includes('pura 70') || lower.includes('pura70')) return '华为 Pura 70';
  if (lower.includes('小米 14') || lower.includes('14 ultra') || lower.includes('澎湃os') || lower.includes('hyperos')) return '小米 14 Ultra';
  if (lower.includes('小米 13') || lower.includes('mi 13')) return '小米 13';
  if (lower.includes('oppo') || lower.includes('find x')) return 'OPPO Find X7';
  if (lower.includes('vivo') || lower.includes('x100')) return 'vivo X100 Pro';
  return defaultDevice;
}

// 常见垃圾与灌水模式
const SPAM_PATTERNS = [
  /^(好|行|对|嗯|哦|哈|收到|1|11|111|6|666|\.+|。+|\?+|！+)$/i,
  /^[\s\p{Emoji}\p{Punctuation}]+$/u, // 纯表情或纯标点
  /(签到|打卡|领积分|刷分|互赞|微信|加v|兼职|返利|贷款)/i,
  /(aaaa+|bbbb+|测试测试|随便写写)/i,
];

export interface PreprocessingResult {
  accepted: Array<{
    cleanedText: string;
    originalText: string;
    source: FeedbackSource;
    deviceModel: DeviceModel;
    hash: string;
  }>;
  duplicates: Array<{ text: string; reason: string }>;
  spamFiltered: Array<{ text: string; reason: string; tokensSaved: number }>;
  stats: PipelineFilterStat;
}

/**
 * 模块一：数据预处理与前置清洗（含手机机型识别）
 * "不是所有反馈都值得 Agent 处理。前置过滤是成本控制的第一道关。"
 */
export function preprocessRawFeedbacks(
  rawTexts: string[],
  defaultSource: FeedbackSource = '应用内反馈',
  defaultDevice: DeviceModel = 'iPhone 15 Pro',
  existingHashes: Set<string> = new Set()
): PreprocessingResult {
  const accepted: PreprocessingResult['accepted'] = [];
  const duplicates: PreprocessingResult['duplicates'] = [];
  const spamFiltered: PreprocessingResult['spamFiltered'] = [];
  const seenInBatch = new Set<string>();

  let tokensSaved = 0;

  for (const raw of rawTexts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // 1. 垃圾/无意义内容过滤
    let isSpam = false;
    let spamReason = '';

    if (trimmed.length < 3) {
      isSpam = true;
      spamReason = '字符数过短(<3)，缺乏有效业务信息';
    } else {
      for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(trimmed)) {
          isSpam = true;
          spamReason = '命中无意义灌水/刷屏/纯表情/引流特征';
          break;
        }
      }
    }

    if (isSpam) {
      const estimatedToken = Math.max(80, trimmed.length * 4);
      tokensSaved += estimatedToken;
      spamFiltered.push({
        text: trimmed,
        reason: spamReason,
        tokensSaved: estimatedToken,
      });
      continue;
    }

    // 2. 格式规范化清洗
    const cleaned = trimmed
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 3. 去重检测 (简易语义指纹)
    const normalizedKey = cleaned.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (existingHashes.has(normalizedKey) || seenInBatch.has(normalizedKey)) {
      duplicates.push({
        text: trimmed,
        reason: '与已有反馈完全相同或高度重复 (MD5/SimHash 去重)',
      });
      tokensSaved += Math.max(100, cleaned.length * 3);
      continue;
    }

    seenInBatch.add(normalizedKey);

    // 4. 来源渠道智能推断
    let detectedSource = defaultSource;
    if (trimmed.includes('App Store') || trimmed.includes('五星') || trimmed.includes('更新后')) {
      detectedSource = 'App Store';
    } else if (trimmed.includes('工单') || trimmed.includes('客服') || trimmed.includes('退款')) {
      detectedSource = '客服工单';
    } else if (trimmed.includes('车友圈') || trimmed.includes('微信群') || trimmed.includes('社群')) {
      detectedSource = '社群';
    }

    // 5. 机型智能提取
    const detectedDevice = detectDeviceModelFromText(trimmed, defaultDevice);

    accepted.push({
      cleanedText: cleaned,
      originalText: trimmed,
      source: detectedSource,
      deviceModel: detectedDevice,
      hash: normalizedKey,
    });
  }

  const stats: PipelineFilterStat = {
    rawCount: rawTexts.length,
    cleanedCount: accepted.length,
    dedupedCount: duplicates.length,
    spamFilteredCount: spamFiltered.length,
    tokensSaved,
    readyForAgentCount: accepted.length,
  };

  return { accepted, duplicates, spamFiltered, stats };
}

/**
 * 模块二：智能分类引擎（Agent 核心）
 * 增加「紧急待修复」问题类型：针对突发性高危bug、新版本发布后大面积闪退、阻断性核心故障
 */
export function classifyFeedbackDeterministic(
  text: string,
  source: FeedbackSource = '应用内反馈',
  deviceModel: DeviceModel = 'iPhone 15 Pro'
): Omit<FeedbackItem, 'id' | 'createdAt' | 'timestampMs' | 'priorityScore'> {
  const lower = text.toLowerCase();

  // 1. 功能模块识别
  let module: ModuleType = '车控';
  let moduleHits = 0;
  const moduleMatches: ModuleType[] = [];

  const checkModule = (keywords: string[], target: ModuleType) => {
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits > 0) {
      moduleMatches.push(target);
      if (hits > moduleHits) {
        moduleHits = hits;
        module = target;
      }
    }
  };

  checkModule(['充电', '充桩', '电量', '快充', '慢充', '特来电', '星星充电', '电枪', '拔枪', '补能', '续航'], '充电');
  checkModule(['车门', '车锁', '解锁', '闭锁', '车窗', '空调', '后备箱', '除霜', '座椅加热', '车模', '寻车', '鸣笛', '车控', '控车'], '车控');
  checkModule(['导航', '路线', '高德', '路况', '路段', '电子眼', '车道', '闪退', '地图', '巡航', '加电规划', '服务区'], '导航');
  checkModule(['账号', '钥匙', '蓝牙钥匙', '数字钥匙', '登录', '授权', '密码', '验证码', '绑定', '实名', '副驾钥匙'], '账号');
  checkModule(['商城', '积分', '订单', '兑换', '购买', '发货', '退款', '物流', '优惠券', '原厂', '车载'], '商城');
  checkModule(['社区', '动态', '帖子', '发帖', '车友圈', '车友', '活动', '点赞', '评论', '自驾游'], '社区');

  // 2. 突发性高危判断 (判断是否为「紧急待修复」)
  const isEmergencySpike =
    /紧急|突发|必崩|必现闪退|立即回滚|大面积|炸锅|上千车主|完全瘫痪|全量闪退|紧急热更|重大事故|高速趴窝/i.test(lower);

  // 3. 问题类型识别 (新增：紧急待修复)
  let issueType: IssueType = '体验摩擦';
  if (isEmergencySpike) {
    issueType = '紧急待修复';
  } else if (/表扬|点赞|太棒了|好评|非常流畅|惊艳|佩服|牛逼|质感很好/i.test(lower)) {
    issueType = '表扬';
  } else if (/请问|多少|怎么用|哪里查|有没有说明|规则|规格|何时/i.test(lower)) {
    issueType = '咨询';
  } else if (/希望|建议|能不能|可不可以|增加|加个|支持|要是能|设计成/i.test(lower)) {
    issueType = '功能请求';
  } else if (/报错|闪退|崩溃|失控|锁死|失败|未启动|打不开|黑屏|扣费|扣款|白屏|断连|蒸发/i.test(lower)) {
    issueType = 'Bug';
  } else {
    issueType = '体验摩擦';
  }

  // 4. 严重程度判定 (可操作判据)
  let severity: SeverityLevel = '中';
  let isMoneyLoss = /扣款|扣费|钱扣了|余额|积分蒸发|少退款|没退钱/i.test(lower);
  let isSafetyOrControlFailure = /(车门.*锁死|进不去车|冻.*半小时|无法解锁|车辆控制失效|蓝牙钥匙.*失联|暴风雪.*开不了门|安全隐患|差点出事|刹车|必崩)/i.test(lower);
  let isCoreBlocker = isMoneyLoss || isSafetyOrControlFailure || isEmergencySpike;

  if (isCoreBlocker) {
    severity = '阻断';
  } else if (/闪退|崩溃|完全无法|彻底走不通|卡死无响应|订单无法提交/i.test(lower)) {
    severity = '高';
  } else if (/延迟|刷新慢|不清晰|模糊|繁琐|麻烦|步骤多|重置|偶尔/i.test(lower)) {
    severity = '中';
  } else if (issueType === '功能请求' || issueType === '表扬' || issueType === '咨询') {
    severity = '低';
  }

  // 5. 情绪强度判定
  let sentiment: SentimentLevel = '中性';
  if (isEmergencySpike || /深夜|暴风雪|进退两难|极其愤怒|报警|大半夜|白白蒸发|气死|受够了|冻坏|差点出事|差评/i.test(lower)) {
    sentiment = '强烈负面';
  } else if (/失败|繁琐|无语|坑|恶心|差|慢|麻烦|吐槽/i.test(lower)) {
    sentiment = '负面';
  } else if (/点赞|惊艳|科技感|棒|好评|喜欢|满意/i.test(lower)) {
    sentiment = '正面';
  }

  // 6. 关键原则：提取用户处境与真实症状（而非盲从提议）
  let symptomSummary = '';
  if (isEmergencySpike) {
    symptomSummary = `突发性高危故障：${deviceModel} 机型出现高频/必现核心阻塞缺陷，需紧急调配研发资源热更止血`;
  } else if (lower.includes('一键充电') || (lower.includes('充电') && lower.includes('加个'))) {
    symptomSummary = '充电扫码启动流程嵌套层级深，强光户外场景操作摩擦大（遵循处境归纳原则，非加按钮）';
  } else if (isMoneyLoss) {
    symptomSummary = '充值/支付流程扣减资产但履约状态异常，造成用户即时资金与信任损失';
  } else if (isSafetyOrControlFailure) {
    symptomSummary = '极端环境或离线工况下车辆进出受阻，双鉴权通道协同失效，存在安全与受困风险';
  } else if (/闪退|崩溃/.test(lower)) {
    symptomSummary = '特定功能链路触发未捕获异常导致客户端闪退终止';
  } else {
    symptomSummary = text.slice(0, 48) + (text.length > 48 ? '...' : '');
  }

  // 7. 人工复核路由条件判定
  let needsReview = false;
  let reviewReason: ReviewRoutingReason = 'none';
  let confidence = 92;

  const distinctModules = Array.from(new Set(moduleMatches));
  if (isEmergencySpike) {
    needsReview = true;
    reviewReason = 'emergency_spike';
    confidence = 99;
  } else if (distinctModules.length >= 2) {
    needsReview = true;
    reviewReason = 'cross_category';
    confidence = 66;
  } else if (severity === '阻断') {
    needsReview = true;
    reviewReason = 'blocker_safety';
    confidence = 95;
  } else if (lower.includes('延保') || lower.includes('销售') || lower.includes('退订') || lower.includes('不知为何')) {
    needsReview = true;
    reviewReason = 'cluster_anomaly';
    confidence = 58;
  } else if (/模糊|不清楚|不知道是.*还是/.test(lower)) {
    needsReview = true;
    reviewReason = 'low_confidence';
    confidence = 62;
  }

  // 8. 自然语言分类理由（让 PM 一眼确认）
  let agentReasoning = '';
  if (isEmergencySpike) {
    agentReasoning = `【突发紧急缺陷】机型【${deviceModel}】在【${module}】模块出现突发大面积异常，属于核心用车阻断，判定为最高排期优先级的「紧急待修复」问题！`;
  } else if (severity === '阻断') {
    agentReasoning = `反馈涉及【${module}】核心可用性，包含${isMoneyLoss ? '资金直接扣减' : '极端工况下车辆控制失效与人身安全'}隐患，机型【${deviceModel}】，情绪为${sentiment}，依据标准判据强制判定为阻断级。`;
  } else if (reviewReason === 'cross_category') {
    agentReasoning = `该反馈同时包含【${distinctModules.join('】与【')}】跨模块诉求，单一主标签难以全面覆盖，已主动路由人工复核建议拆解工单。`;
  } else if (reviewReason === 'cluster_anomaly') {
    agentReasoning = `该反馈内容存在业务离群特征（涉及线下销售/客服），与同聚类技术缺陷存在偏差，建议人工核实归类。`;
  } else if (issueType === '功能请求') {
    agentReasoning = `基于用户处境提炼，用户诉求表面为提议，本质为【${module}】模块交互效率摩擦，标记为功能请求（严重度：${severity}）。`;
  } else {
    agentReasoning = `反馈定位为【${module}】模块，问题性质属于【${issueType}】，机型【${deviceModel}】，置信度 ${confidence}%，建议标记为【${severity}】级。`;
  }

  const clusterKey = `${module}-${issueType}`;

  return {
    cleanedText: text,
    originalText: text,
    source,
    deviceModel,
    isEmergency: isEmergencySpike || issueType === '紧急待修复',
    module,
    issueType,
    severity,
    sentiment,
    symptomSummary,
    agentReasoning,
    confidence,
    needsReview,
    reviewReason,
    reviewStatus: needsReview ? 'pending' : 'confirmed',
    inPriorityList: severity === '阻断' || severity === '高' || isEmergencySpike,
    clusterKey,
  };
}

/**
 * 完整流水线：创建全新反馈条目
 */
export function createFeedbackItemFromText(
  text: string,
  source: FeedbackSource = '应用内反馈',
  deviceModel: DeviceModel = 'iPhone 15 Pro'
): FeedbackItem {
  const classified = classifyFeedbackDeterministic(text, source, deviceModel);
  const id = `FB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 899 + 100)}`;
  const now = new Date();
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const scoreInfo = calculatePriorityScore(
    classified.severity,
    1,
    classified.sentiment,
    classified.isEmergency
  );

  return {
    ...classified,
    id,
    createdAt,
    timestampMs: Date.now(),
    priorityScore: scoreInfo.finalScore,
  };
}
