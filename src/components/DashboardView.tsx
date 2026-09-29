import React, { useState } from 'react';
import {
  FeedbackItem,
  ModuleType,
  SeverityLevel,
} from '../types/feedback';
import {
  ModuleBadge,
  SeverityBadge,
  DeviceBadge,
  IssueTypeBadge,
} from './common/Badges';
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Zap,
  Flame,
  Smartphone,
  Search,
  Award,
  Calendar,
  History,
  Check,
  RotateCcw,
} from 'lucide-react';

interface DashboardViewProps {
  feedbacks: FeedbackItem[];
  onSelectCluster: (clusterKey: string) => void;
  onNavigateToWorklist: (filter?: any) => void;
  onJumpToReview: () => void;
  onToggleOptimized?: (id: string, notes?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  feedbacks,
  onSelectCluster,
  onNavigateToWorklist,
  onJumpToReview,
  onToggleOptimized,
}) => {
  // 近30天已优化需求筛选状态
  const [optModuleFilter, setOptModuleFilter] = useState<ModuleType | '全部'>('全部');
  const [optSearch, setOptSearch] = useState<string>('');

  // 1. 顶部指标计算
  const totalCount = feedbacks.length;
  const emergencyCount = feedbacks.filter((f) => f.isEmergency || f.issueType === '紧急待修复').length;
  const pendingReviewCount = feedbacks.filter((f) => f.needsReview && f.reviewStatus === 'pending').length;
  const confirmedCount = feedbacks.filter((f) => f.reviewStatus === 'confirmed' || f.reviewStatus === 'modified').length;
  const blockerCount = feedbacks.filter((f) => f.severity === '阻断').length;

  // 近30天已优化需求计算 (30天内标记为已优化的需求内容)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - thirtyDaysMs;
  const optimizedRecent30Days = feedbacks
    .filter((f) => f.isOptimized && (!f.optimizedTimestampMs || f.optimizedTimestampMs >= thirtyDaysAgo))
    .sort((a, b) => (b.optimizedTimestampMs || 0) - (a.optimizedTimestampMs || 0));

  const optimizedCount30Days = optimizedRecent30Days.length;

  // 筛选后的已优化需求列表
  const filteredOptimizedList = optimizedRecent30Days.filter((item) => {
    if (optModuleFilter !== '全部' && item.module !== optModuleFilter) return false;
    if (optSearch.trim()) {
      const q = optSearch.toLowerCase();
      return (
        item.originalText.toLowerCase().includes(q) ||
        item.symptomSummary.toLowerCase().includes(q) ||
        (item.optimizedNotes && item.optimizedNotes.toLowerCase().includes(q)) ||
        item.deviceModel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 2. 模块分布统计
  const moduleCounts: Record<ModuleType, number> = {
    '车控': 0,
    '充电': 0,
    '导航': 0,
    '账号': 0,
    '商城': 0,
    '社区': 0,
  };
  feedbacks.forEach((f) => {
    if (moduleCounts[f.module] !== undefined) {
      moduleCounts[f.module]++;
    }
  });

  const moduleColors: Record<ModuleType, { bar: string; text: string; bg: string }> = {
    '车控': { bar: 'bg-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50' },
    '充电': { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
    '导航': { bar: 'bg-cyan-500', text: 'text-cyan-600', bg: 'bg-cyan-50' },
    '账号': { bar: 'bg-slate-600', text: 'text-slate-600', bg: 'bg-slate-50' },
    '商城': { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
    '社区': { bar: 'bg-purple-500', text: 'text-purple-600', bg: 'bg-purple-50' },
  };

  // 3. 手机机型分布统计
  const deviceCounts: Record<string, { count: number; emergencyCount: number }> = {};
  feedbacks.forEach((f) => {
    const dev = f.deviceModel || '未识别机型';
    if (!deviceCounts[dev]) deviceCounts[dev] = { count: 0, emergencyCount: 0 };
    deviceCounts[dev].count++;
    if (f.isEmergency || f.issueType === '紧急待修复') {
      deviceCounts[dev].emergencyCount++;
    }
  });

  const topDevices = Object.entries(deviceCounts)
    .sort((a, b) => b[1].emergencyCount - a[1].emergencyCount || b[1].count - a[1].count)
    .slice(0, 6);

  // 4. Top 5 高频问题聚类
  const clusterMap: Record<
    string,
    {
      clusterKey: string;
      module: ModuleType;
      issueType: any;
      count: number;
      blockerCount: number;
      emergencyCount: number;
      highCount: number;
      symptoms: string[];
      maxScore: number;
      sampleItem: FeedbackItem;
    }
  > = {};

  feedbacks.forEach((item) => {
    const key = item.clusterKey;
    if (!clusterMap[key]) {
      clusterMap[key] = {
        clusterKey: key,
        module: item.module,
        issueType: item.issueType,
        count: 0,
        blockerCount: 0,
        emergencyCount: 0,
        highCount: 0,
        symptoms: [],
        maxScore: 0,
        sampleItem: item,
      };
    }
    clusterMap[key].count++;
    if (item.severity === '阻断') clusterMap[key].blockerCount++;
    if (item.isEmergency || item.issueType === '紧急待修复') clusterMap[key].emergencyCount++;
    if (item.severity === '高') clusterMap[key].highCount++;
    if (item.symptomSummary && !clusterMap[key].symptoms.includes(item.symptomSummary)) {
      clusterMap[key].symptoms.push(item.symptomSummary);
    }
    if (item.priorityScore > clusterMap[key].maxScore) {
      clusterMap[key].maxScore = item.priorityScore;
    }
  });

  const top5Clusters = Object.values(clusterMap)
    .sort((a, b) => b.emergencyCount - a.emergencyCount || b.maxScore - a.maxScore || b.count - a.count)
    .slice(0, 5);

  // 5. 情绪趋势数据（近 4 周负面反馈占比曲线）
  const weeklyTrends = [
    { week: '第36周 (W-3)', negRate: 34, event: 'v2.3.8 基础维护版' },
    { week: '第37周 (W-2)', negRate: 28, event: '优化蓝牙协议栈' },
    { week: '第38周 (W-1)', negRate: 46, event: 'v2.4.0 冰雪天暖车大版本推送' },
    { week: '本周 (当前)', negRate: 39, event: '正在推进阻断与紧急修复' },
  ];

  return (
    <div className="space-y-6">
      {/* 突发紧急待修复高优先级预警横幅 */}
      {emergencyCount > 0 && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 rounded-xl p-4 text-white shadow-md flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 text-amber-200 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wide">🚨 突发紧急警报</span>
                <span className="px-2 py-0.5 text-xs bg-white text-rose-700 font-black rounded-full shadow-xs">
                  {emergencyCount} 起待修复
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                检测到关键车控崩溃 / 无法解锁等突发致命缺陷，已自动置顶决策页优先序列，建议立即安排热更新（Hotfix）！
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToWorklist({ onlyEmergency: true })}
              className="px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1"
            >
              仅看紧急反馈 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 顶部数字指标卡 (Top Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Feedback */}
        <div
          onClick={() => onNavigateToWorklist({ reviewStatus: '全部' })}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">本月反馈总数</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              +12% 较上月
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">已自动完成机型与渠道归因</p>
        </div>

        {/* 紧急待修复指标卡 */}
        <div
          onClick={() => onNavigateToWorklist({ onlyEmergency: true })}
          className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer group relative overflow-hidden ${
            emergencyCount > 0
              ? 'border-rose-400 bg-rose-50/40 hover:border-rose-500'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">突发紧急待修复</span>
              {emergencyCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{emergencyCount}</span>
            <span className="text-[11px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded-full">
              最高置顶
            </span>
          </div>
          <p className="mt-1 text-[11px] text-rose-700/80 flex items-center justify-between">
            <span>突发Bug / 闪退卡死</span>
            <span className="text-rose-600 font-bold group-hover:underline flex items-center gap-0.5">
              立即排期 <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* 近30天已优化需求指标卡 (User Request 4) */}
        <div
          onClick={() => {
            const el = document.getElementById('optimized-demands-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer group relative overflow-hidden ${
            optimizedCount30Days > 0
              ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-500'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">近30天已优化需求</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{optimizedCount30Days}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              闭环交付
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/80 flex items-center justify-between">
            <span>产研排期已上线</span>
            <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-0.5">
              查看成果 <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* Pending Review with Alert Pulse */}
        <div
          onClick={onJumpToReview}
          className={`bg-white rounded-xl border p-4 shadow-xs transition-all cursor-pointer group relative overflow-hidden ${
            pendingReviewCount > 0
              ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">待人工复核</span>
              {pendingReviewCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{pendingReviewCount}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">
              主动分流
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 flex items-center justify-between">
            <span>低置信/阻断主动分流</span>
            <span className="text-amber-600 font-semibold group-hover:underline flex items-center gap-0.5">
              立即复核 <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* Processed & Confirmed */}
        <div
          onClick={() => onNavigateToWorklist({ reviewStatus: '已确认' })}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">已处理/已确认数</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{confirmedCount}</span>
            <span className="text-xs text-slate-500">
              确认率 {totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">PM已核实或Agent高置信通过</p>
        </div>

        {/* Blocker Safety Hazards */}
        <div
          onClick={() => onNavigateToWorklist({ severity: '阻断' })}
          className="bg-white rounded-xl border border-rose-200 p-4 shadow-xs hover:border-rose-400 transition-all cursor-pointer group bg-gradient-to-br from-white to-rose-50/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">阻断级安全/资金</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">{blockerCount}</span>
            <span className="text-xs font-semibold text-rose-600">严重度权重</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-700/80">车控失效 / 充电扣费未履约</p>
        </div>
      </div>

      {/* Middle Section: Distribution Charts & Device Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module Distribution (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">功能模块反馈分布</h3>
              <p className="text-xs text-slate-500 mt-0.5">点击可直接筛选工作台</p>
            </div>
          </div>

          <div className="space-y-3">
            {(Object.entries(moduleCounts) as [ModuleType, number][]).map(([mod, count]) => {
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              const color = moduleColors[mod];
              const modBlockers = feedbacks.filter((f) => f.module === mod && f.severity === '阻断').length;

              return (
                <div
                  key={mod}
                  onClick={() => onNavigateToWorklist({ module: mod })}
                  className="group p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${color.bar}`} />
                      <span className="text-slate-900 font-semibold">{mod}</span>
                      {modBlockers > 0 && (
                        <span className="px-1 py-0.2 text-[10px] font-bold bg-red-100 text-red-700 rounded">
                          {modBlockers} 阻断
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500">
                      <span className="font-bold text-slate-800">{count} 条</span>
                      <span className="text-slate-400 ml-1">({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color.bar} transition-all duration-500`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 手机机型分布与故障集中度 (1 col) - NEW FEATURE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">手机机型集中度监控</h3>
              </div>
              <span className="text-[11px] text-slate-400">模块一接入机型</span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              识别特定机型/系统升级引发的突发性兼容崩溃与蓝牙连接失效
            </p>

            <div className="space-y-2.5">
              {topDevices.map(([device, data]) => {
                const pct = totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0;
                return (
                  <div
                    key={device}
                    onClick={() => onNavigateToWorklist({ deviceModel: device })}
                    className="p-2 bg-slate-50/70 hover:bg-indigo-50/60 rounded-lg cursor-pointer transition-colors border border-slate-100 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <DeviceBadge model={device} />
                      {data.emergencyCount > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-rose-600 text-white rounded flex items-center gap-0.5 animate-pulse">
                          <Flame className="w-2.5 h-2.5" />
                          {data.emergencyCount} 起紧急
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-right">
                      <span className="font-bold text-slate-800">{data.count} 条</span>
                      <span className="text-slate-400 text-[11px] ml-1">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>点击机型快速下钻查看反馈</span>
            <span className="text-blue-600 font-medium">按机型聚合诊断</span>
          </div>
        </div>

        {/* Sentiment Trend & Token banner (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">近 4 周负面反馈率趋势</h3>
              <TrendingDown className="w-4 h-4 text-slate-400" />
            </div>

            {/* Sparkline / Trend visualization */}
            <div className="space-y-2.5">
              {weeklyTrends.map((t, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{t.week}</span>
                    <span className={`font-bold ${t.negRate > 40 ? 'text-red-600' : 'text-amber-600'}`}>
                      负面率: {t.negRate}%
                    </span>
                  </div>
                  <div className="mt-1 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.negRate > 40 ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${t.negRate}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 truncate">{t.event}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Token & Cost Pre-filtering Banner */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>模块一前置过滤与成本控制</span>
            </div>
            <p className="mt-1 text-[11px] text-blue-800 leading-relaxed">
              支持批量机型导入，前置过滤 42 条无意义灌水，节约约 38,400 Tokens 算力消耗。
            </p>
          </div>
        </div>
      </div>

      {/* ✨ 需求4：近30天标记为已优化的需求内容看板 (Recent 30 Days Resolved & Optimized Demands) */}
      <div id="optimized-demands-section" className="bg-white rounded-xl border border-emerald-300/80 p-5 shadow-xs space-y-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-base">
                    近30天标记为已优化的需求内容
                  </h3>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                    已归档 {optimizedRecent30Days.length} 项
                  </span>
                  {optimizedRecent30Days.filter((i) => i.isEmergency || i.severity === '阻断').length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 rounded-full border border-rose-200 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-600" />
                      含紧急/阻断级修复 {optimizedRecent30Days.filter((i) => i.isEmergency || i.severity === '阻断').length} 项
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  自动记录并保存近30天内在<strong>「研发周会决策列表」</strong>被 PM 标记为「已优化」的真实上线车主痛点与闭环交付成果
                </p>
              </div>
            </div>
          </div>

          {/* Module Filter & Search in Section */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={optSearch}
                onChange={(e) => setOptSearch(e.target.value)}
                placeholder="搜索已优化内容/机型..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-52"
              />
            </div>

            {/* Module Filter dropdown */}
            <select
              value={optModuleFilter}
              onChange={(e) => setOptModuleFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="全部">全部模块 ({optimizedRecent30Days.length})</option>
              {(['车控', '充电', '导航', '账号', '商城', '社区'] as ModuleType[]).map((mod) => {
                const count = optimizedRecent30Days.filter((i) => i.module === mod).length;
                return (
                  <option key={mod} value={mod}>
                    {mod} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Content: List of Optimized Cards */}
        {filteredOptimizedList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {filteredOptimizedList.map((item) => (
              <div
                key={item.id}
                className="bg-gradient-to-br from-emerald-50/40 via-white to-white rounded-xl border border-emerald-200 p-4 shadow-2xs hover:shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ModuleBadge module={item.module} size="sm" />
                      <IssueTypeBadge type={item.issueType} />
                      <SeverityBadge severity={item.severity} />
                      <DeviceBadge model={item.deviceModel} size="sm" />
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded-full border border-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {item.optimizedAt ? item.optimizedAt.slice(0, 10) : '近30天'}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {item.originalText}
                  </h4>

                  <p className="mt-2 text-xs text-slate-600 line-clamp-2 bg-slate-50/90 p-2 rounded-lg border border-slate-100">
                    <strong className="text-slate-700">车主处境与症状：</strong> {item.symptomSummary}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>来源: {item.source}</span>
                    <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      历史优先级分: {item.priorityScore}
                    </span>
                  </div>

                  {item.optimizedNotes && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50/90 p-2 rounded-lg border border-emerald-200/80 leading-relaxed">
                      <span className="font-bold">优化版本说明: </span>
                      {item.optimizedNotes}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => onNavigateToWorklist({ search: item.originalText.slice(0, 8) })}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>在分类列表溯源</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    {onToggleOptimized && (
                      <button
                        onClick={() => onToggleOptimized(item.id)}
                        className="text-[11px] text-slate-400 hover:text-red-600 font-medium flex items-center gap-1 cursor-pointer"
                        title="误标记可撤销优化状态"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>撤销标记</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
            <div className="w-12 h-12 mx-auto bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">近30天暂无匹配的已优化需求</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              在「研发决策」页面，当产研团队在排序后优先级列表中将某个排期项点击「已优化」后，系统将自动保存并归档展示在此看板中。
            </p>
            <button
              onClick={() => onSelectCluster('全部')}
              className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-2xs cursor-pointer"
            >
              前往研发周会决策列表
            </button>
          </div>
        )}
      </div>

      {/* Bottom Section: Top 5 High-Frequency Clusters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-base">Top 5 高频核心聚类 (按决策优先级模型)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              遵循「严重度 × 频次 + 突发紧急加权」模型：突发卡死/扣费阻断级问题权重严格高于100个视觉槽点
            </p>
          </div>
          <button
            onClick={() => onNavigateToWorklist({})}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            查看全部反馈 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {top5Clusters.map((cluster, idx) => (
            <div
              key={cluster.clusterKey}
              onClick={() => onSelectCluster(cluster.clusterKey)}
              className={`border rounded-xl p-4 transition-all cursor-pointer bg-white flex flex-col justify-between group ${
                cluster.emergencyCount > 0
                  ? 'border-rose-300 bg-rose-50/20 hover:border-rose-500 shadow-xs'
                  : 'border-slate-200 hover:border-blue-400 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                      cluster.emergencyCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    {cluster.emergencyCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-rose-600 text-white rounded animate-pulse">
                        突发紧急
                      </span>
                    )}
                    <ModuleBadge module={cluster.module} size="sm" />
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  {cluster.clusterKey}
                </h4>

                <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {cluster.symptoms[0] || cluster.sampleItem.symptomSummary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">频次: {cluster.count}</span>
                {cluster.blockerCount > 0 ? (
                  <span className="text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                    {cluster.blockerCount} 阻断
                  </span>
                ) : (
                  <span className="text-slate-500">得分: {cluster.maxScore}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
