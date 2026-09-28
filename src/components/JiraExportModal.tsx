import React, { useState } from 'react';
import { FeedbackItem } from '../types/feedback';
import { X, Copy, Check, Download, FileSpreadsheet } from 'lucide-react';

interface JiraExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: FeedbackItem[];
}

export const JiraExportModal: React.FC<JiraExportModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const [format, setFormat] = useState<'markdown' | 'jira' | 'csv'>('markdown');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate Markdown
  const markdownContent = `# 车企 App 研发排期工单（周度反馈决策）
生成时间: ${new Date().toLocaleDateString()}
决策模型: 「严重度 × 频次」加权优先级

| 排序 | 严重度 | 模块 | 类型 | 用户核心症状 / 痛点 | 综合得分 | 建议处理方式 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${items
  .slice(0, 15)
  .map(
    (item, idx) =>
      `| ${idx + 1} | ${item.severity} | ${item.module} | ${item.issueType} | ${item.symptomSummary} | ${item.priorityScore} | ${
        item.severity === '阻断' ? '🔴 本周紧急热更/专项修复' : '🟡 纳入下迭代版本研发'
      } |`
  )
  .join('\n')}

---
**附注说明**：
- 阻断级缺陷涉及资金扣减异常、极端天气车辆解闭锁失效或人身安全风险，研发已通过人工复核。
- 排期遵照「1条阻断级 > 100条视觉吐槽」产品原则。
`;

  // Generate Jira CSV
  const csvContent = `Issue Type,Summary,Priority,Component,Description
${items
  .slice(0, 15)
  .map((item, idx) => {
    const jiraPriority = item.severity === '阻断' ? 'Highest' : item.severity === '高' ? 'High' : item.severity === '中' ? 'Medium' : 'Low';
    return `Bug,"[AutoFeedback-${item.module}] ${item.symptomSummary.replace(/,/g, ' ')}",${jiraPriority},${item.module},"${item.originalText.replace(/"/g, '""')} (Agent得分: ${item.priorityScore})"`;
  })
  .join('\n')}`;

  const currentContent = format === 'csv' ? csvContent : markdownContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = format === 'csv' ? 'csv' : 'md';
    const blob = new Blob([currentContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autofeedback-weekly-priority-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">导出研发排期工单</h3>
            <p className="text-xs text-slate-500">
              包含前 {items.length} 项优先级决策事项，可直接粘贴至飞书文档、Jira 或 TAPD
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">导出格式:</span>
            <button
              onClick={() => setFormat('markdown')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                format === 'markdown'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              飞书 / Markdown 表格
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                format === 'csv'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Jira / TAPD 导入 CSV
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制到剪贴板' : '复制全文'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载文件</span>
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-900 text-slate-200 text-xs font-mono">
          <pre className="whitespace-pre-wrap leading-relaxed select-all">
            {currentContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
