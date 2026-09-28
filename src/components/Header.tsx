import React from 'react';
import {
  Car,
  LayoutDashboard,
  ListFilter,
  ArrowUpDown,
  UploadCloud,
  BrainCircuit,
  AlertCircle,
  RotateCcw,
  Flame,
} from 'lucide-react';

export type TabKey = 'dashboard' | 'worklist' | 'priority' | 'ingestion';

interface HeaderProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pendingReviewCount: number;
  emergencyCount?: number;
  onOpenIngestion: () => void;
  onResetData: () => void;
  onJumpToReview: () => void;
  onJumpToEmergency?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  pendingReviewCount,
  emergencyCount = 0,
  onOpenIngestion,
  onResetData,
  onJumpToReview,
  onJumpToEmergency,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">AutoFeedback PM</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  车企反馈决策中台
                </span>
              </div>
              <p className="text-xs text-slate-500">智能多维分类 · 主动人工复核 · 「严重度×频次」决策排序</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              <span>总览看板</span>
            </button>

            <button
              onClick={() => onTabChange('worklist')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                currentTab === 'worklist'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-4 h-4 text-indigo-600" />
              <span>分类结果列表</span>
              {pendingReviewCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {pendingReviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('priority')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                currentTab === 'priority'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpDown className="w-4 h-4 text-emerald-600" />
              <span>决策优先级</span>
            </button>

            <button
              onClick={() => onTabChange('ingestion')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                currentTab === 'ingestion'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-cyan-600" />
              <span>数据接入清洗</span>
            </button>
          </nav>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Direct jump to Emergency Queue */}
            {emergencyCount > 0 && (
              <button
                onClick={onJumpToEmergency || (() => onTabChange('priority'))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-xs animate-pulse"
                title="检测到突发紧急待修复问题，点击直达决策页紧急通道"
              >
                <Flame className="w-4 h-4 text-amber-300" />
                <span>突发紧急 ({emergencyCount})</span>
              </button>
            )}

            {/* Direct jump to Pending Review Queue */}
            {pendingReviewCount > 0 && (
              <button
                onClick={onJumpToReview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                title="点击直接处理阻断级/低置信度主动分流队列"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>待复核 ({pendingReviewCount})</span>
              </button>
            )}

            <button
              onClick={onOpenIngestion}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>导入反馈</span>
            </button>

            <button
              onClick={onResetData}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="重置为标准车企案例集"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
