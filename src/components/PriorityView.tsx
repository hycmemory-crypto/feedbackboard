import React, { useState, useMemo } from 'react';
import {
  FeedbackItem,
  ModuleType,
} from '../types/feedback';
import {
  ModuleBadge,
  IssueTypeBadge,
  SeverityBadge,
  SentimentBadge,
  DeviceBadge,
} from './common/Badges';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ChevronRight,
  Share2,
  Flame,
  Zap,
  Radio,
} from 'lucide-react';

interface PriorityViewProps {
  feedbacks: FeedbackItem[];
  onReorderPriorityList: (reordered: FeedbackItem[]) => void;
  onOpenJiraExport: (items: FeedbackItem[]) => void;
}

export const PriorityView: React.FC<PriorityViewProps> = ({
  feedbacks,
  onReorderPriorityList,
  onOpenJiraExport,
}) => {
  // Filter for priority items or high/blocker items or emergency
  const priorityCandidates = useMemo(() => {
    return feedbacks.filter((f) => f.inPriorityList || f.severity === '阻断' || f.severity === '高' || f.isEmergency || f.issueType === '紧急待修复');
  }, [feedbacks]);

  // Priority list items (can be manually reordered)
  const [priorityItems, setPriorityItems] = useState<FeedbackItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [manualAdjustCount, setManualAdjustCount] = useState(0);
  const [feedbackFeedbackPrompt, setFeedbackFeedbackPrompt] = useState(false);
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string | null>(null);
  const [onlyShowEmergency, setOnlyShowEmergency] = useState(false);

  // Initialize sorted items: Emergency items placed first, followed by priority score
  React.useEffect(() => {
    const sorted = [...priorityCandidates].sort((a, b) => {
      const aEmerg = a.isEmergency || a.issueType === '紧急待修复';
      const bEmerg = b.isEmergency || b.issueType === '紧急待修复';
      if (aEmerg && !bEmerg) return -1;
      if (!aEmerg && bEmerg) return 1;
      return b.priorityScore - a.priorityScore;
    });
    setPriorityItems(sorted);
  }, [priorityCandidates]);

  // Compute High-Frequency Clusters for the Left Column
  const clusterGroups = useMemo(() => {
    const map: Record<
      string,
      {
        key: string;
        module: ModuleType;
        issueType: any;
        count: number;
        blockerCount: number;
        emergencyCount: number;
        highCount: number;
        avgScore: number;
        symptoms: string[];
      }
    > = {};

    feedbacks.forEach((item) => {
      const key = item.clusterKey;
      if (!map[key]) {
        map[key] = {
          key,
          module: item.module,
          issueType: item.issueType,
          count: 0,
          blockerCount: 0,
          emergencyCount: 0,
          highCount: 0,
          avgScore: 0,
          symptoms: [],
        };
      }
      map[key].count++;
      if (item.severity === '阻断') map[key].blockerCount++;
      if (item.isEmergency || item.issueType === '紧急待修复') map[key].emergencyCount++;
      if (item.severity === '高') map[key].highCount++;
      map[key].avgScore += item.priorityScore;
      if (item.symptomSummary && !map[key].symptoms.includes(item.symptomSummary)) {
        map[key].symptoms.push(item.symptomSummary);
      }
    });

    return Object.values(map)
      .map((g) => ({
        ...g,
        avgScore: Number((g.avgScore / Math.max(1, g.count)).toFixed(1)),
      }))
      .sort((a, b) => b.emergencyCount - a.emergencyCount || b.blockerCount - a.blockerCount || b.count - a.count);
  }, [feedbacks]);

  // Filtered priority items based on selected cluster or emergency toggle
  const displayItems = useMemo(() => {
    let list = priorityItems;
    if (onlyShowEmergency) {
      list = list.filter((i) => i.isEmergency || i.issueType === '紧急待修复');
    }
    if (selectedClusterFilter) {
      list = list.filter((i) => i.clusterKey === selectedClusterFilter);
    }
    return list;
  }, [priorityItems, selectedClusterFilter, onlyShowEmergency]);

  // Emergency items count
  const emergencyItems = useMemo(() => {
    return priorityItems.filter((i) => i.isEmergency || i.issueType === '紧急待修复');
  }, [priorityItems]);

  // Drag and Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newItems = [...priorityItems];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setDraggedIndex(targetIndex);
    setPriorityItems(newItems);
    setManualAdjustCount((prev) => prev + 1);
    setFeedbackFeedbackPrompt(true);
    onReorderPriorityList(newItems);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Up / Down button move
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= priorityItems.length) return;

    const newItems = [...priorityItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setPriorityItems(newItems);
    setManualAdjustCount((prev) => prev + 1);
    setFeedbackFeedbackPrompt(true);
    onReorderPriorityList(newItems);
  };

  // Feedback to model callback
  const handleSaveToModelFeedback = () => {
    setFeedbackFeedbackPrompt(false);
    alert(`已将 ${manualAdjustCount} 项 PM 人工干预排序规则沉淀入排序权重点阵，用于下一轮自动化推荐！`);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner: Explanation & Decision Mission */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              这周该修什么？—— 研发周会决策面板
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
              「严重度 × 频次」加权决策模型
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-3xl">
            摒弃重型 RICE 框架，贴合月度百条级体量：<strong>1条突发必崩/资金不可逆损失/极端天气锁死</strong>阻断级问题权重，严格高于100个视觉吐槽。Agent 自动化置顶紧急待修复突发缺陷，支持 PM 手动拖拽干预。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenJiraExport(priorityItems)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" /> 导出本周研发排期工单 (Jira/Markdown)
          </button>
        </div>
      </div>

      {/* 🔴 专区：突发性紧急待修复诉求一览 (清晰明了的紧急需求置顶专区) */}
      {emergencyItems.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-red-500/5 to-amber-500/10 border-2 border-red-300 rounded-2xl p-4 shadow-sm animate-pulse-subtle">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-red-200/80">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-red-600 text-white rounded-lg shadow-xs flex items-center justify-center">
                <Flame className="w-4 h-4 animate-bounce" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-red-900 text-sm tracking-tight">
                    🔥 突发性紧急待修复通道（需立即发热更 / 专人跟进）
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-red-600 text-white rounded-full">
                    {emergencyItems.length} 个紧急项
                  </span>
                </div>
                <p className="text-[11px] text-red-700 mt-0.5">
                  由 Agent 自动识别新版本突发必崩、全量开锁失联或极端重大险情，享受 1.5 倍加权置顶排期。
                </p>
              </div>
            </div>

            <button
              onClick={() => setOnlyShowEmergency(!onlyShowEmergency)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                onlyShowEmergency
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{onlyShowEmergency ? '显示所有排期' : '仅聚焦紧急待修复'}</span>
            </button>
          </div>

          {/* Quick Emergency Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
            {emergencyItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-red-200 p-3.5 shadow-xs flex flex-col justify-between hover:border-red-400 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-600 text-white rounded uppercase tracking-wider">
                      🚨 紧急待修复
                    </span>
                    <DeviceBadge model={item.deviceModel} size="sm" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                    {item.originalText}
                  </h4>
                  <p className="text-[11px] text-red-800 font-medium mt-1.5 bg-red-50 p-1.5 rounded border border-red-100 line-clamp-2">
                    {item.symptomSummary}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">{item.module} · {item.source}</span>
                  <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    优先级分: {item.priorityScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual adjustment light prompt notification banner */}
      {feedbackFeedbackPrompt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              已手动调整 <strong className="text-amber-950 font-bold">{manualAdjustCount}</strong> 项优先级顺序，是否反馈给系统用于后续优化？
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedbackFeedbackPrompt(false)}
              className="px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 rounded-md"
            >
              忽略
            </button>
            <button
              onClick={handleSaveToModelFeedback}
              className="px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-xs transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> 确认沉淀为排序模型特征
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Core Layout matching PDF specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: 高频聚类卡片 (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>高频聚类卡片 (Top N)</span>
              </div>
              {selectedClusterFilter && (
                <button
                  onClick={() => setSelectedClusterFilter(null)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  显示全部
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500 mb-3">
              Agent 按「功能模块 + 问题类型」聚类识别高发共性问题，包含突发性故障聚合。
            </p>

            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {clusterGroups.map((cluster) => {
                const isSelected = selectedClusterFilter === cluster.key;
                const hasEmergency = cluster.emergencyCount > 0;

                return (
                  <div
                    key={cluster.key}
                    onClick={() =>
                      setSelectedClusterFilter(isSelected ? null : cluster.key)
                    }
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                        : hasEmergency
                        ? 'border-red-300 bg-red-50/30 hover:border-red-400'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <ModuleBadge module={cluster.module} size="sm" />
                        <span className="font-bold text-slate-800 text-xs">
                          {cluster.key}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasEmergency && (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold bg-red-600 text-white rounded">
                            紧急
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full">
                          频次 {cluster.count}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 line-clamp-1 mt-1">
                      {cluster.symptoms[0] || '车主高频反馈痛点'}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {cluster.blockerCount > 0 && (
                          <span className="font-bold text-red-600">
                            {cluster.blockerCount} 阻断级
                          </span>
                        )}
                        {cluster.highCount > 0 && (
                          <span className="text-orange-600 font-medium">
                            {cluster.highCount} 高风险
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono">
                        综合分: {cluster.avgScore}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: 排序后优先级列表 (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  排序后优先级列表 ({displayItems.length} 项)
                </h3>
                {selectedClusterFilter && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold">
                    已筛选: {selectedClusterFilter}
                  </span>
                )}
                {onlyShowEmergency && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-md font-semibold">
                    仅紧急项
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                可拖拽手柄调整顺序，PM 拥有最终决策裁量权并覆盖 Agent 初始判断
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                支持整行拖拽
              </span>
            </div>
          </div>

          {/* Draggable Items List */}
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[calc(100vh-270px)] p-2 space-y-1">
            {displayItems.map((item, index) => {
              const isBlocker = item.severity === '阻断';
              const isEmergency = item.isEmergency || item.issueType === '紧急待修复';

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 group ${
                    draggedIndex === index
                      ? 'opacity-40 bg-blue-50 border-dashed border-blue-400'
                      : isEmergency
                      ? 'border-red-300 bg-gradient-to-r from-red-100/40 via-red-50/30 to-white shadow-xs hover:border-red-400'
                      : isBlocker
                      ? 'border-red-200 bg-gradient-to-r from-red-50/40 via-white to-white hover:border-red-300'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  {/* Drag Handle & Rank Number */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                      title="拖拽上下排序"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                        isEmergency
                          ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-200 animate-pulse'
                          : index === 0
                          ? 'bg-red-600 text-white shadow-xs'
                          : index === 1
                          ? 'bg-orange-500 text-white'
                          : index === 2
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </div>

                  {/* Item Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <ModuleBadge module={item.module} />
                      <IssueTypeBadge type={item.issueType} />
                      <SeverityBadge severity={item.severity} />
                      <SentimentBadge sentiment={item.sentiment} />
                      <DeviceBadge model={item.deviceModel} />

                      {/* Formula / Score Breakdown Pill */}
                      <span className="ml-auto font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md" title={`综合得分 = 严重度 × 频次 × 情绪: ${item.priorityScore}`}>
                        评分: {item.priorityScore}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {item.originalText}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate max-w-[85%] text-slate-600">
                        <span className="font-semibold text-slate-700">决策依据：</span>
                        {item.agentReasoning}
                      </span>
                      <span className="text-[11px] text-slate-400">来源: {item.source}</span>
                    </div>
                  </div>

                  {/* Manual Arrow Move Buttons */}
                  <div className="flex flex-col gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === displayItems.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded"
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
