import React, { useState, useMemo } from 'react';
import {
  FeedbackItem,
  FilterState,
  ModuleType,
  IssueType,
  SeverityLevel,
  SentimentLevel,
  FeedbackSource,
  CorrectionRecord,
} from '../types/feedback';
import {
  ModuleBadge,
  IssueTypeBadge,
  SeverityBadge,
  SentimentBadge,
  SourceBadge,
  DeviceBadge,
  ReviewReasonPill,
} from './common/Badges';
import {
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  PlusCircle,
  MinusCircle,
  Save,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Smartphone,
  Flame,
  BrainCircuit,
  BookOpen,
  Copy,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { buildAgentSystemPrompt } from '../utils/fewShotManager';

interface WorklistViewProps {
  feedbacks: FeedbackItem[];
  filterState: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  selectedFeedbackId: string | null;
  onSelectFeedback: (id: string) => void;
  onUpdateFeedbackTags: (
    id: string,
    updates: {
      module: ModuleType;
      issueType: IssueType;
      severity: SeverityLevel;
      sentiment: SentimentLevel;
      correctionNote?: string;
    }
  ) => void;
  onConfirmReview: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onBatchConfirm: (ids: string[]) => void;
  onBatchTogglePriority: (ids: string[], inPriority: boolean) => void;
  corrections?: CorrectionRecord[];
  onToggleFewShotInjection?: (id: string) => void;
  onAddCustomCorrection?: (correction: CorrectionRecord) => void;
}

export const WorklistView: React.FC<WorklistViewProps> = ({
  feedbacks,
  filterState,
  onFilterChange,
  onResetFilters,
  selectedFeedbackId,
  onSelectFeedback,
  onUpdateFeedbackTags,
  onConfirmReview,
  onTogglePriority,
  onBatchConfirm,
  onBatchTogglePriority,
  corrections = [],
  onToggleFewShotInjection,
  onAddCustomCorrection,
}) => {
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // PM edit state for detail panel
  const [editModule, setEditModule] = useState<ModuleType>('车控');
  const [editIssueType, setEditIssueType] = useState<IssueType>('Bug');
  const [editSeverity, setEditSeverity] = useState<SeverityLevel>('中');
  const [editSentiment, setEditSentiment] = useState<SentimentLevel>('中性');
  const [correctionNote, setCorrectionNote] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);

  // Few-Shot modal state
  const [isFewShotModalOpen, setIsFewShotModalOpen] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleNote, setNewRuleNote] = useState('');

  const activeFewShotCount = corrections.filter((c) => c.injectedToFewShot).length;
  const currentPrompt = buildAgentSystemPrompt(corrections);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(currentPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Filtered list
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      if (filterState.module !== '全部' && item.module !== filterState.module) return false;
      if (filterState.issueType !== '全部' && item.issueType !== filterState.issueType) return false;
      if (filterState.severity !== '全部' && item.severity !== filterState.severity) return false;
      if (filterState.sentiment !== '全部' && item.sentiment !== filterState.sentiment) return false;
      if (filterState.source !== '全部' && item.source !== filterState.source) return false;
      if (filterState.deviceModel && filterState.deviceModel !== '全部' && item.deviceModel !== filterState.deviceModel) return false;
      if (filterState.onlyEmergency && !item.isEmergency && item.issueType !== '紧急待修复') return false;
      if (filterState.onlyPriority && !item.inPriorityList) return false;

      if (filterState.reviewStatus === '待复核' && !(item.needsReview && item.reviewStatus === 'pending')) return false;
      if (filterState.reviewStatus === '已确认' && item.reviewStatus !== 'confirmed') return false;
      if (filterState.reviewStatus === '已修正' && item.reviewStatus !== 'modified') return false;

      if (filterState.search) {
        const query = filterState.search.toLowerCase();
        const inText = item.originalText.toLowerCase().includes(query);
        const inSymptom = item.symptomSummary.toLowerCase().includes(query);
        const inReason = item.agentReasoning.toLowerCase().includes(query);
        if (!inText && !inSymptom && !inReason) return false;
      }

      return true;
    });
  }, [feedbacks, filterState]);

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedFeedbackId && filteredFeedbacks.length > 0) {
      return filteredFeedbacks[0];
    }
    return feedbacks.find((f) => f.id === selectedFeedbackId) || filteredFeedbacks[0] || null;
  }, [selectedFeedbackId, feedbacks, filteredFeedbacks]);

  // Sync edit form whenever selected item changes
  React.useEffect(() => {
    if (selectedItem) {
      setEditModule(selectedItem.module);
      setEditIssueType(selectedItem.issueType);
      setEditSeverity(selectedItem.severity);
      setEditSentiment(selectedItem.sentiment);
      setCorrectionNote('');
      setSavedSuccessMsg(false);
    }
  }, [selectedItem?.id]);

  // Batch toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredFeedbacks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFeedbacks.map((f) => f.id));
    }
  };

  const toggleSelectOne = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Has changes compared to selectedItem?
  const hasTagModifications = selectedItem && (
    editModule !== selectedItem.module ||
    editIssueType !== selectedItem.issueType ||
    editSeverity !== selectedItem.severity ||
    editSentiment !== selectedItem.sentiment
  );

  const handleSaveCorrection = () => {
    if (!selectedItem) return;
    onUpdateFeedbackTags(selectedItem.id, {
      module: editModule,
      issueType: editIssueType,
      severity: editSeverity,
      sentiment: editSentiment,
      correctionNote,
    });
    setSavedSuccessMsg(true);
    setTimeout(() => setSavedSuccessMsg(false), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-140px)]">
      {/* 1. 左侧筛选栏 (Filters Column) */}
      <aside className="w-full lg:w-60 shrink-0 bg-white rounded-xl border border-slate-200 p-4 shadow-xs self-start space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>维度筛选栏</span>
          </div>
          <button
            onClick={onResetFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> 重置
          </button>
        </div>

        {/* 突发紧急快速过滤开关 */}
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!filterState.onlyEmergency}
              onChange={(e) => onFilterChange({ onlyEmergency: e.target.checked })}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            <div className="flex items-center gap-1 text-xs font-bold text-rose-700">
              <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
              <span>仅看突发紧急待修复</span>
            </div>
          </label>
        </div>

        {/* 关键词搜索 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">关键词搜索</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={filterState.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="搜索反馈原文、理由、机型..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* 手机机型筛选 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              手机机型
            </span>
            {filterState.deviceModel && filterState.deviceModel !== '全部' && (
              <span className="text-[10px] text-blue-600 font-normal">已选</span>
            )}
          </label>
          <select
            value={filterState.deviceModel || '全部'}
            onChange={(e) => onFilterChange({ deviceModel: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部机型</option>
            <option value="iPhone 15 Pro">iPhone 15 Pro</option>
            <option value="iPhone 16 Pro Max">iPhone 16 Pro Max</option>
            <option value="华为 Mate 60 Pro">华为 Mate 60 Pro (高发崩溃)</option>
            <option value="华为 Pura 70">华为 Pura 70</option>
            <option value="小米 14 Ultra">小米 14 Ultra</option>
            <option value="小米 15">小米 15</option>
            <option value="OPPO Find X7">OPPO Find X7</option>
            <option value="vivo X100 Pro">vivo X100 Pro</option>
            <option value="三星 Galaxy S24">三星 Galaxy S24</option>
            <option value="其他机型">其他机型</option>
          </select>
        </div>

        {/* 是否待复核 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">复核状态</label>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {(['全部', '待复核', '已确认', '已修正'] as const).map((status) => (
              <button
                key={status}
                onClick={() => onFilterChange({ reviewStatus: status })}
                className={`px-2 py-1.5 rounded-md font-medium text-left transition-colors flex items-center justify-between ${
                  filterState.reviewStatus === status
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{status}</span>
                {status === '待复核' && (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 功能模块 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">功能模块</label>
          <select
            value={filterState.module}
            onChange={(e) => onFilterChange({ module: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部模块</option>
            <option value="车控">车控</option>
            <option value="导航">导航</option>
            <option value="充电">充电</option>
            <option value="社区">社区</option>
            <option value="商城">商城</option>
            <option value="账号">账号</option>
          </select>
        </div>

        {/* 问题类型 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">问题类型</label>
          <select
            value={filterState.issueType}
            onChange={(e) => onFilterChange({ issueType: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部类型</option>
            <option value="紧急待修复">🚨 紧急待修复 (突发Bug/崩溃)</option>
            <option value="Bug">Bug (常规缺陷故障)</option>
            <option value="体验摩擦">体验摩擦 (交互痛点)</option>
            <option value="功能请求">功能请求 (新诉求)</option>
            <option value="咨询">咨询</option>
            <option value="表扬">表扬</option>
          </select>
        </div>

        {/* 严重程度 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">严重程度</label>
          <select
            value={filterState.severity}
            onChange={(e) => onFilterChange({ severity: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部等级</option>
            <option value="阻断">阻断 (资金/安全/控制失效)</option>
            <option value="高">高 (核心阻断有替代)</option>
            <option value="中">中 (体验明显变差)</option>
            <option value="低">低 (建议/锦上添花)</option>
          </select>
        </div>

        {/* 情绪强度 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">情绪强度</label>
          <select
            value={filterState.sentiment}
            onChange={(e) => onFilterChange({ sentiment: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部情绪</option>
            <option value="强烈负面">强烈负面 (舆情高危)</option>
            <option value="负面">负面</option>
            <option value="中性">中性</option>
            <option value="正面">正面</option>
          </select>
        </div>

        {/* 来源 */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">反馈渠道来源</label>
          <select
            value={filterState.source}
            onChange={(e) => onFilterChange({ source: e.target.value as any })}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="全部">全部渠道</option>
            <option value="App Store">App Store</option>
            <option value="客服工单">客服工单</option>
            <option value="应用内反馈">应用内反馈</option>
            <option value="社群">社群 (微信/车友圈)</option>
          </select>
        </div>

        {/* 快捷勾选：仅看已入选优先级 */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filterState.onlyPriority}
              onChange={(e) => onFilterChange({ onlyPriority: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>仅显示决策优先级清单项</span>
          </label>
        </div>

        {/* Few-Shot 标注库快捷小入口 (合并自原顶部模块) */}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={() => setIsFewShotModalOpen(true)}
            className="w-full p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-600 text-white flex items-center justify-center shrink-0">
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-950 group-hover:text-purple-900">Few-Shot 标注库</div>
                <div className="text-[10px] text-purple-700">PM人工纠偏规则集</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-purple-800 bg-white px-1.5 py-0.5 rounded border border-purple-200">
              {corrections.length} 条
            </span>
          </button>
        </div>
      </aside>

      {/* 2. 中间反馈列表 (Center Feedbacks Column) */}
      <section className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* List Header & Batch Actions Toolbar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === filteredFeedbacks.length}
                onChange={toggleSelectAll}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>全选 ({filteredFeedbacks.length} 条)</span>
            </label>
            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                已选中 {selectedIds.length} 项
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Few-Shot 样本库小入口按钮 */}
            <button
              onClick={() => setIsFewShotModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="查看 PM 人工复核沉淀的 Few-Shot 样本库与 Prompt 调优"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
              <span>Few-Shot 标注库</span>
              <span className="px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded-full text-[10px] font-bold">
                {activeFewShotCount} 已激活
              </span>
            </button>

            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onBatchConfirm(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> 批量标记确认
                </button>
                <button
                  onClick={() => {
                    onBatchTogglePriority(selectedIds, true);
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> 批量加入优先级
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Scrollable Feedback Cards */}
        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[calc(100vh-210px)]">
          {filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">暂无匹配的反馈条目</p>
              <button
                onClick={onResetFilters}
                className="mt-3 text-xs text-blue-600 hover:underline"
              >
                清除所有筛选条件
              </button>
            </div>
          ) : (
            filteredFeedbacks.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isChecked = selectedIds.includes(item.id);

              const isEmergency = item.isEmergency || item.issueType === '紧急待修复';

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectFeedback(item.id)}
                  className={`p-4 transition-all cursor-pointer relative hover:bg-slate-50/80 ${
                    isSelected
                      ? isEmergency
                        ? 'bg-rose-50/60 border-l-4 border-rose-600'
                        : 'bg-blue-50/50 border-l-4 border-blue-600'
                      : isEmergency
                      ? 'bg-rose-50/20 border-l-4 border-rose-400'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggleSelectOne(item.id, e)}
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Top Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isEmergency && (
                          <span className="px-2 py-0.5 text-[11px] font-black bg-rose-600 text-white rounded-md shadow-xs animate-pulse flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-300" />
                            突发紧急
                          </span>
                        )}
                        <DeviceBadge model={item.deviceModel} />
                        <SourceBadge source={item.source} />
                        <ModuleBadge module={item.module} />
                        <IssueTypeBadge type={item.issueType} />
                        <SeverityBadge severity={item.severity} />
                        <SentimentBadge sentiment={item.sentiment} />

                        {/* Review routing badge if triggered */}
                        {item.needsReview && item.reviewStatus === 'pending' && (
                          <ReviewReasonPill reason={item.reviewReason} />
                        )}

                        {item.reviewStatus === 'modified' && (
                          <span className="px-1.5 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 rounded">
                            已人工纠偏
                          </span>
                        )}

                        {item.inPriorityList && (
                          <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                            已入选排期
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 ml-auto">
                          {item.createdAt}
                        </span>
                      </div>

                      {/* Text Excerpt / Symptom */}
                      <p className="text-xs sm:text-sm text-slate-800 font-medium line-clamp-2 leading-relaxed">
                        {item.originalText}
                      </p>

                      {/* Agent symptom distillation */}
                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span className="truncate max-w-[85%] text-slate-600">
                          <span className="font-semibold text-slate-700">症状提炼：</span>
                          {item.symptomSummary}
                        </span>
                        <span className="text-[11px] text-blue-600 font-medium shrink-0 flex items-center gap-0.5">
                          置信度 {item.confidence}%
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. 右侧详情面板 (Right Detail Panel) */}
      <aside className="w-full lg:w-96 shrink-0 bg-white rounded-xl border border-slate-200 p-5 shadow-xs self-start space-y-4">
        {selectedItem ? (
          <>
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-slate-400">ID: {selectedItem.id}</span>
                  <DeviceBadge model={selectedItem.deviceModel} />
                  {(selectedItem.isEmergency || selectedItem.issueType === '紧急待修复') && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-rose-600 text-white rounded">
                      突发紧急
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">反馈诊断与人工复核</h4>
              </div>

              {/* Priority list toggle button */}
              <button
                onClick={() => onTogglePriority(selectedItem.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                  selectedItem.inPriorityList
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {selectedItem.inPriorityList ? (
                  <>
                    <MinusCircle className="w-3.5 h-3.5" /> 移出优先级
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" /> 加入优先级
                  </>
                )}
              </button>
            </div>

            {/* 1. 完整原始反馈 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">完整原始反馈</label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800 max-h-36 overflow-y-auto">
                {selectedItem.originalText}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>机型: {selectedItem.deviceModel || '未识别'} · 渠道: {selectedItem.source}</span>
                <span>提交时间: {selectedItem.createdAt}</span>
              </div>
            </div>

            {/* 2. Agent 分类理由（自然语言核心：扫一眼确认） */}
            <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-blue-50/60 border border-indigo-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Agent 分类诊断理由
                </span>
                <span className="text-[10px] font-semibold bg-white/80 px-1.5 py-0.5 rounded text-indigo-700 border border-indigo-100">
                  置信度 {selectedItem.confidence}%
                </span>
              </div>
              <p className="text-xs text-indigo-950 leading-relaxed">
                {selectedItem.agentReasoning}
              </p>
              <div className="pt-1 text-[11px] text-indigo-800/80 font-medium">
                处境症状：{selectedItem.symptomSummary}
              </div>
            </div>

            {/* Review Reason Highlight if routed */}
            {selectedItem.needsReview && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800">
                  <span className="font-bold">主动复核触发：</span>
                  {selectedItem.reviewReason === 'blocker_safety' && '阻断级判据（涉及资金损失、极端环境安全或车辆控制失效），强制人工确认'}
                  {selectedItem.reviewReason === 'cross_category' && '跨模块复合诉求，单一标签无法覆盖，需人工拆分评估'}
                  {selectedItem.reviewReason === 'low_confidence' && '模型分类置信度低于75%，特征模糊'}
                  {selectedItem.reviewReason === 'cluster_anomaly' && '语义与同聚类明显脱节，可能为误归离群点'}
                </div>
              </div>
            )}

            {/* 3. 标签修改下拉框 (PM 可覆盖 Agent 判断) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  标签修改 (PM 可覆盖 Agent 判断)
                </label>
                {hasTagModifications && (
                  <span className="text-[11px] text-amber-600 font-semibold">
                    有未保存的人工纠偏
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 模块 */}
                <div>
                  <span className="text-slate-500 mb-1 block">功能模块</span>
                  <select
                    value={editModule}
                    onChange={(e) => setEditModule(e.target.value as ModuleType)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-medium"
                  >
                    <option value="车控">车控</option>
                    <option value="充电">充电</option>
                    <option value="导航">导航</option>
                    <option value="账号">账号</option>
                    <option value="商城">商城</option>
                    <option value="社区">社区</option>
                  </select>
                </div>

                {/* 问题类型 */}
                <div>
                  <span className="text-slate-500 mb-1 block">问题类型</span>
                  <select
                    value={editIssueType}
                    onChange={(e) => setEditIssueType(e.target.value as IssueType)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-medium"
                  >
                    <option value="紧急待修复">🚨 紧急待修复 (突发Bug)</option>
                    <option value="Bug">Bug (常规修bug)</option>
                    <option value="体验摩擦">体验摩擦</option>
                    <option value="功能请求">功能请求 (做需求)</option>
                    <option value="咨询">咨询</option>
                    <option value="表扬">表扬</option>
                  </select>
                </div>

                {/* 严重程度 */}
                <div>
                  <span className="text-slate-500 mb-1 block">严重程度</span>
                  <select
                    value={editSeverity}
                    onChange={(e) => setEditSeverity(e.target.value as SeverityLevel)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-medium"
                  >
                    <option value="阻断">阻断 (资金/安全/控制)</option>
                    <option value="高">高 (核心阻断)</option>
                    <option value="中">中 (体验变差)</option>
                    <option value="低">低 (建议/锦上添花)</option>
                  </select>
                </div>

                {/* 情绪强度 */}
                <div>
                  <span className="text-slate-500 mb-1 block">情绪强度</span>
                  <select
                    value={editSentiment}
                    onChange={(e) => setEditSentiment(e.target.value as SentimentLevel)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-medium"
                  >
                    <option value="强烈负面">强烈负面</option>
                    <option value="负面">负面</option>
                    <option value="中性">中性</option>
                    <option value="正面">正面</option>
                  </select>
                </div>
              </div>

              {/* PM 纠偏备注 */}
              {hasTagModifications && (
                <div>
                  <span className="text-slate-500 text-xs mb-1 block">
                    人工修正原因 (将沉淀为 Few-Shot 样本规则)
                  </span>
                  <input
                    type="text"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder="例：用户反映极端严寒无法开门，纠偏为阻断级"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Save Correction Action */}
              {hasTagModifications && (
                <button
                  onClick={handleSaveCorrection}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" /> 保存纠偏并沉淀至 Few-Shot 样本库
                </button>
              )}

              {savedSuccessMsg && (
                <div className="p-2 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  已记录人工修正，系统已将该样本纳入后续 Prompt Few-shot 学习集！
                </div>
              )}

              {/* Confirm button */}
              {selectedItem.reviewStatus === 'pending' && !hasTagModifications && (
                <button
                  onClick={() => onConfirmReview(selectedItem.id)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> 扫一眼确认无误（归档并消除待复核）
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-slate-400">
            <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs">请在中间列表中点击任意反馈条目</p>
          </div>
        )}
      </aside>

      {/* 4. Few-Shot 样本库与提示词调优弹窗 (Few-Shot Modal) */}
      {isFewShotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Few-Shot 标注库与模型调优
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                      共 {corrections.length} 条 · {activeFewShotCount} 条已激活注入
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    记录 PM 人工纠偏历史，沉淀「原始AI判断 vs 人工修正」，实时动态注入 Agent Prompt 调优模型推理精准度。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPromptPreview(!showPromptPreview)}
                  className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{showPromptPreview ? '收起提示词' : '预览注入 Prompt'}</span>
                </button>
                <button
                  onClick={handleCopyPrompt}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt ? '已复制' : '复制 System Prompt'}</span>
                </button>
                <button
                  onClick={() => setIsFewShotModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prompt Preview Panel */}
            {showPromptPreview && (
              <div className="p-4 bg-slate-900 text-slate-200 border-b border-slate-800 max-h-56 overflow-y-auto font-mono text-xs leading-relaxed space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span>实时注入的大模型 System Instruction（系统提示词）</span>
                  <span>包含已勾选的 {activeFewShotCount} 条车企样本规则</span>
                </div>
                <pre className="whitespace-pre-wrap">{currentPrompt}</pre>
              </div>
            )}

            {/* Modal Body: Corrections List */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(90vh-160px)]">
              {corrections.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <BrainCircuit className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">暂无人工纠偏样本</p>
                  <p className="text-xs text-slate-500 mt-1">
                    当你在右侧详情面板修改标签并保存后，纠偏记录将自动沉淀并显示在此处。
                  </p>
                </div>
              ) : (
                corrections.map((item) => {
                  const isInjected = item.injectedToFewShot;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isInjected
                          ? 'bg-white border-purple-200 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          {/* Original Text */}
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">[{item.id}]</span>
                            <span>"{item.originalText}"</span>
                          </div>

                          {/* Contrast comparison */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                                🤖 Agent 原始判定 (初筛)
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px]">
                                  {item.originalTags.module}
                                </span>
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px]">
                                  {item.originalTags.issueType}
                                </span>
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px]">
                                  {item.originalTags.severity}
                                </span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-purple-50/80 rounded-lg border border-purple-200">
                              <span className="text-[11px] font-bold text-purple-900 block mb-1">
                                👨‍💻 PM 人工纠偏 (基准事实)
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <ModuleBadge module={item.correctedTags.module} size="sm" />
                                <IssueTypeBadge type={item.correctedTags.issueType} size="sm" />
                                <SeverityBadge severity={item.correctedTags.severity} size="sm" />
                              </div>
                            </div>
                          </div>

                          {/* Correction Reason */}
                          {item.notes && (
                            <div className="text-xs text-slate-600 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 flex items-start gap-1.5">
                              <span className="font-bold text-amber-900 shrink-0">纠偏成因规则:</span>
                              <span className="text-amber-950">{item.notes}</span>
                            </div>
                          )}

                          <div className="text-[11px] text-slate-400">
                            修正时间: {new Date(item.correctedAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Toggle Injection Button */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            onClick={() => onToggleFewShotInjection && onToggleFewShotInjection(item.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isInjected
                                ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {isInjected ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-purple-600" />
                                <span>已激活注入</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                                <span>未激活</span>
                              </>
                            )}
                          </button>
                          <span className="text-[10px] text-slate-400">
                            {isInjected ? '参与模型 Prompt 学习' : '仅归档不注入'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                提示：在工作台修改任意条目的模块或类型后，点击「保存纠偏」即可直接同步沉淀至此。
              </span>
              <button
                onClick={() => setIsFewShotModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                完成并返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
