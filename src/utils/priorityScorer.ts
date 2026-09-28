import { FeedbackItem, SeverityLevel, SentimentLevel } from '../types/feedback';

export const SEVERITY_BASE_WEIGHTS: Record<SeverityLevel, number> = {
  '阻断': 100, // 资金损失、人身安全、车辆控制失效
  '高': 30,    // 核心流程走不通，但有替代方案
  '中': 10,    // 体验明显变差但不影响任务完成
  '低': 2,     // 建议 / 锦上添花
};

export const SENTIMENT_MULTIPLIERS: Record<SentimentLevel, number> = {
  '强烈负面': 1.3,
  '负面': 1.1,
  '中性': 1.0,
  '正面': 0.8,
};

export interface PriorityScoreDetails {
  baseWeight: number;
  frequency: number;
  frequencyFactor: number;
  sentimentMultiplier: number;
  finalScore: number;
  formulaStr: string;
}

/**
 * 计算单条反馈或聚类的优先级得分
 * 核心原则：严重度权重大于频次，1条阻断级（不可逆资金/安全）> 100条视觉吐槽
 * 对于突发性紧急待修复问题，给予置顶加权系数
 */
export function calculatePriorityScore(
  severity: SeverityLevel,
  frequency: number = 1,
  sentiment: SentimentLevel = '中性',
  isEmergency: boolean = false
): PriorityScoreDetails {
  const baseWeight = SEVERITY_BASE_WEIGHTS[severity] ?? 10;
  
  // 频次增益：对数或线性平滑增长，避免海量轻度反馈刷分
  // 1条: factor=1.0; 5条: factor=1.3; 10条: factor=1.5; 20条: factor=1.8
  const freq = Math.max(1, frequency);
  const frequencyFactor = Number((1 + 0.12 * Math.log2(freq + 0.5)).toFixed(2));
  
  const sentimentMultiplier = SENTIMENT_MULTIPLIERS[sentiment] ?? 1.0;
  // 突发性紧急待修复加权系数：1.5倍加权，确保研发决策页置顶展示
  const emergencyFactor = isEmergency ? 1.5 : 1.0;
  
  const rawScore = baseWeight * frequencyFactor * sentimentMultiplier * emergencyFactor;
  const finalScore = Number(rawScore.toFixed(1));
  
  const formulaStr = `${baseWeight}(严重度:${severity}) × ${frequencyFactor}(频次:${freq}) × ${sentimentMultiplier}(情绪:${sentiment})${isEmergency ? ' × 1.5(突发紧急加权)' : ''} = ${finalScore}分`;

  return {
    baseWeight,
    frequency: freq,
    frequencyFactor,
    sentimentMultiplier,
    finalScore,
    formulaStr,
  };
}

/**
 * 刷新所有反馈项的优先级得分
 */
export function computeAllPriorityScores(items: FeedbackItem[]): FeedbackItem[] {
  // 先统计每个聚类的频次
  const clusterCounts: Record<string, number> = {};
  items.forEach(item => {
    clusterCounts[item.clusterKey] = (clusterCounts[item.clusterKey] || 0) + 1;
  });

  return items.map(item => {
    const clusterFreq = clusterCounts[item.clusterKey] || 1;
    const isEmerg = item.isEmergency || item.issueType === '紧急待修复';
    const scoreInfo = calculatePriorityScore(item.severity, clusterFreq, item.sentiment, isEmerg);
    return {
      ...item,
      isEmergency: isEmerg,
      priorityScore: scoreInfo.finalScore,
    };
  });
}
