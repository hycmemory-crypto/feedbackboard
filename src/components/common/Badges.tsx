import React from 'react';
import {
  ModuleType,
  IssueType,
  SeverityLevel,
  SentimentLevel,
  FeedbackSource,
  ReviewRoutingReason,
  VehicleModel,
} from '../../types/feedback';
import { Car } from 'lucide-react';

export const ModuleBadge: React.FC<{ module: ModuleType; size?: 'sm' | 'md' }> = ({
  module,
  size = 'sm',
}) => {
  const styles: Record<ModuleType, { bg: string; text: string; border: string }> = {
    '车控': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    '导航': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    '充电': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    '社区': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    '商城': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    '账号': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  };

  const current = styles[module] || styles['车控'];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClass}`}
    >
      {module}
    </span>
  );
};

export const IssueTypeBadge: React.FC<{ type: IssueType; size?: 'sm' | 'md' }> = ({
  type,
  size = 'sm',
}) => {
  const styles: Record<IssueType, { bg: string; text: string; extra?: string }> = {
    '紧急待修复': { bg: 'bg-rose-600', text: 'text-white font-bold animate-pulse shadow-xs', extra: 'ring-1 ring-red-400' },
    'Bug': { bg: 'bg-rose-100', text: 'text-rose-800' },
    '体验摩擦': { bg: 'bg-amber-100', text: 'text-amber-800' },
    '功能请求': { bg: 'bg-blue-100', text: 'text-blue-800' },
    '咨询': { bg: 'bg-slate-100', text: 'text-slate-700' },
    '表扬': { bg: 'bg-teal-100', text: 'text-teal-800' },
  };

  const current = styles[type] || { bg: 'bg-slate-100', text: 'text-slate-700' };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md ${current.bg} ${current.text} ${current.extra || ''} ${sizeClass}`}>
      {type === '紧急待修复' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
      {type}
    </span>
  );
};

export const DeviceBadge: React.FC<{ model: string; size?: 'sm' | 'md' }> = ({
  model,
  size = 'sm',
}) => {
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';
  const isApple = model.toLowerCase().includes('iphone');
  const isHuawei = model.includes('华为');
  const isXiaomi = model.includes('小米');

  let tagStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  if (isApple) tagStyle = 'bg-sky-50 text-sky-800 border-sky-200';
  else if (isHuawei) tagStyle = 'bg-red-50 text-red-800 border-red-200';
  else if (isXiaomi) tagStyle = 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <span className={`inline-flex items-center font-mono rounded border ${tagStyle} ${sizeClass}`}>
      📱 {model}
    </span>
  );
};

export const VehicleBadge: React.FC<{ model?: VehicleModel | string; size?: 'sm' | 'md' }> = ({
  model = '雅阁 (Accord)',
  size = 'sm',
}) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-semibold';
  
  // 广汽本田车型个性化色系：
  // 极湃系列(纯电/新能源: 蓝绿色系)
  // 雅阁/皓影 (主力中高级旗舰: 靛蓝/青色系)
  // 型格/飞度 (年轻运动: 紫罗兰/琥珀色系)
  // 奥德赛/冠道 (豪华大空间: 墨蓝/深灰蓝)
  let tagStyle = 'bg-blue-50 text-blue-800 border-blue-200';
  if (model.includes('极湃')) {
    tagStyle = 'bg-teal-50 text-teal-800 border-teal-200';
  } else if (model.includes('雅阁')) {
    tagStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';
  } else if (model.includes('皓影')) {
    tagStyle = 'bg-cyan-50 text-cyan-800 border-cyan-200';
  } else if (model.includes('型格')) {
    tagStyle = 'bg-purple-50 text-purple-800 border-purple-200';
  } else if (model.includes('飞度')) {
    tagStyle = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (model.includes('奥德赛') || model.includes('冠道')) {
    tagStyle = 'bg-slate-100 text-slate-800 border-slate-300';
  }

  return (
    <span className={`inline-flex items-center gap-1 font-sans rounded-md border shadow-2xs ${tagStyle} ${sizeClass}`}>
      <Car className="w-3 h-3 text-slate-500 shrink-0" />
      <span>{model}</span>
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: SeverityLevel; size?: 'sm' | 'md' }> = ({
  severity,
  size = 'sm',
}) => {
  const styles: Record<SeverityLevel, { bg: string; text: string; ring: string; dot: string }> = {
    '阻断': { bg: 'bg-red-50', text: 'text-red-700 font-semibold', ring: 'ring-1 ring-red-300', dot: 'bg-red-500' },
    '高': { bg: 'bg-orange-50', text: 'text-orange-700 font-medium', ring: 'ring-1 ring-orange-200', dot: 'bg-orange-500' },
    '中': { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-1 ring-yellow-200', dot: 'bg-yellow-500' },
    '低': { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-1 ring-slate-200', dot: 'bg-slate-400' },
  };

  const current = styles[severity] || styles['中'];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${current.bg} ${current.text} ${current.ring} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {severity}
    </span>
  );
};

export const SentimentBadge: React.FC<{ sentiment: SentimentLevel }> = ({ sentiment }) => {
  const map: Record<SentimentLevel, { text: string; color: string }> = {
    '强烈负面': { text: '强烈负面', color: 'text-red-700 bg-red-100 border-red-200' },
    '负面': { text: '负面', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    '中性': { text: '中性', color: 'text-slate-600 bg-slate-100 border-slate-200' },
    '正面': { text: '正面', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  };

  const item = map[sentiment] || map['中性'];

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded border ${item.color}`}>
      {item.text}
    </span>
  );
};

export const SourceBadge: React.FC<{ source: FeedbackSource }> = ({ source }) => {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs text-slate-500 bg-slate-100 rounded">
      {source}
    </span>
  );
};

export const ReviewReasonPill: React.FC<{ reason: ReviewRoutingReason }> = ({ reason }) => {
  if (reason === 'none') return null;

  const map: Record<ReviewRoutingReason, { label: string; bg: string; text: string }> = {
    'emergency_spike': { label: '🚨 突发紧急待修复分流', bg: 'bg-rose-100', text: 'text-rose-800' },
    'blocker_safety': { label: '阻断主动路由 (安全/资金)', bg: 'bg-red-100', text: 'text-red-800' },
    'low_confidence': { label: '低置信度分流', bg: 'bg-amber-100', text: 'text-amber-800' },
    'cross_category': { label: '跨类复合诉求', bg: 'bg-purple-100', text: 'text-purple-800' },
    'cluster_anomaly': { label: '聚类语义离群项', bg: 'bg-rose-100', text: 'text-rose-800' },
    'none': { label: '', bg: '', text: '' },
  };

  const current = map[reason];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
};
