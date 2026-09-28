import React, { useState } from 'react';
import { CorrectionRecord } from '../types/feedback';
import { buildAgentSystemPrompt } from '../utils/fewShotManager';
import {
  ModuleBadge,
  IssueTypeBadge,
  SeverityBadge,
} from './common/Badges';
import {
  BrainCircuit,
  Sparkles,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Plus,
  BookOpen,
  ArrowRight,
  Sliders,
} from 'lucide-react';

interface FewShotViewProps {
  corrections: CorrectionRecord[];
  onToggleInjection: (id: string) => void;
  onAddCustomCorrection: (correction: CorrectionRecord) => void;
}

export const FewShotView: React.FC<FewShotViewProps> = ({
  corrections,
  onToggleInjection,
  onAddCustomCorrection,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const activeCount = corrections.filter((c) => c.injectedToFewShot).length;
  const currentPrompt = buildAgentSystemPrompt(corrections);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(currentPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                模块四附加价值：人工复核标注沉淀与 Few-Shot 注入引擎
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                人工复核不是兜底，更是主动飞轮。每次 PM 纠偏都会记录「原始判断 vs 人工修正」，积累后动态注入 Agent Prompt 调优模型。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPromptPreview(!showPromptPreview)}
            className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            <span>{showPromptPreview ? '收起系统提示词' : '预览注入后的 System Prompt'}</span>
          </button>
          <button
            onClick={handleCopyPrompt}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedPrompt ? '已复制' : '复制完整提示词'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">累计人工纠偏样本</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{corrections.length}</span>
            <span className="text-xs text-slate-400">条标注数据</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">形成车企专属调优数据集</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">已激活注入 Prompt</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600">{activeCount}</span>
            <span className="text-xs text-purple-600/80">条动态注入</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">自动进入模型推理 System Instruction</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">目标飞轮规模</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{corrections.length}/100</span>
            <span className="text-xs text-emerald-600/80">
              进度 {Math.min(100, Math.round((corrections.length / 100) * 100))}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">达50~100条可启动LoRA轻量微调</p>
        </div>
      </div>

      {/* Prompt Preview Modal/Drawer if expanded */}
      {showPromptPreview && (
        <div className="bg-slate-900 rounded-xl p-5 text-slate-200 shadow-md space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <Sparkles className="w-4 h-4" />
              <span>实时生成的 Gemini Agent System Prompt (含动态 Few-Shot)</span>
            </div>
            <button
              onClick={handleCopyPrompt}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> 复制代码
            </button>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-2 text-slate-300 font-sans">
            {currentPrompt}
          </pre>
        </div>
      )}

      {/* Corrections List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              「原始判断 vs 人工修正」样本明细
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              点击开关可控制该纠偏是否作为 Few-Shot 范例传给智能分类 Agent
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {corrections.map((corr) => (
            <div key={corr.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2.5">
              {/* Top row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 font-semibold">{corr.id}</span>
                <button
                  onClick={() => onToggleInjection(corr.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    corr.injectedToFewShot
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {corr.injectedToFewShot ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-purple-600" />
                      <span>已注入 Few-Shot 样本</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-slate-400" />
                      <span>未注入</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback text */}
              <div className="text-xs sm:text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                "{corr.originalText}"
              </div>

              {/* Diff Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Original AI classification */}
                <div className="p-3 bg-red-50/40 border border-red-100 rounded-lg space-y-1 text-xs">
                  <div className="text-red-700 font-bold flex items-center gap-1">
                    <span>初始 Agent 误判：</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <ModuleBadge module={corr.originalTags.module} />
                    <IssueTypeBadge type={corr.originalTags.issueType} />
                    <SeverityBadge severity={corr.originalTags.severity} />
                  </div>
                </div>

                {/* PM Corrected */}
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-1 text-xs">
                  <div className="text-emerald-700 font-bold flex items-center gap-1">
                    <span>PM 人工纠偏正确标签：</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <ModuleBadge module={corr.correctedTags.module} />
                    <IssueTypeBadge type={corr.correctedTags.issueType} />
                    <SeverityBadge severity={corr.correctedTags.severity} />
                  </div>
                </div>
              </div>

              {/* Notes & principle applied */}
              {corr.notes && (
                <div className="text-xs text-slate-600 bg-purple-50/40 p-2 rounded border border-purple-100 flex items-start gap-1.5">
                  <span className="font-bold text-purple-900 shrink-0">纠偏原则应用：</span>
                  <span>{corr.notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
