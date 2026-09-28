import React, { useState, useRef } from 'react';
import {
  FeedbackItem,
  FeedbackSource,
  DeviceModel,
  PipelineFilterStat,
} from '../types/feedback';
import {
  preprocessRawFeedbacks,
  classifyFeedbackDeterministic,
} from '../utils/feedbackClassifier';
import { calculatePriorityScore } from '../utils/priorityScorer';
import { DeviceBadge, IssueTypeBadge } from './common/Badges';
import {
  UploadCloud,
  FileText,
  Filter,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Layers,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Flame,
  FileSpreadsheet,
  FileCode,
  FolderOpen,
  Trash2,
  Check,
} from 'lucide-react';

interface IngestionViewProps {
  onAddFeedbacks: (items: FeedbackItem[]) => void;
  onNavigateToWorklist: () => void;
}

const PRESET_REAL_FEEDBACKS = `【突发紧急】华为 Mate 60 Pro 升级 2.4.1 后打开车控首页必崩卡死！无法蓝牙解锁！车门打不开！
在高速服务区国网快充桩，App扫码付了100块钱，充了3秒就跳枪报错，钱扣了充电桩直接断电，车没充上电！
冬天零下20度，在App远程开启电池预热和车内除霜，显示开启成功但过去20分钟车窗还是厚厚的冰，远程控制根本没生效！
小米 14 Ultra 手机锁屏小组件能不能支持显示当前充电功率和剩余分钟数？不要每次都特意点进App看。
路线规划经过收费站时，能不能提醒ETC车道还是人工车道？
好
1111111111
打卡签到领50积分
iPhone 16 Pro Max 在地下车库用蓝牙钥匙解闭锁经常失效，在车旁等很长时间，希望增强离线鉴权能力。
社区发提车作业帖，图片排版顺序经常乱掉，保存草稿后原图分辨率还变低了。
👍👍👍🚗
在积分商城兑换的随车充，发票抬头开错了，在线客服一直排队80多个人联系不上。`;

// Sample presets for document simulation
const SAMPLE_DOCUMENTS: Record<string, { filename: string; source: FeedbackSource; device: DeviceModel; content: string }> = {
  service_csv: {
    filename: '2026年9月_客服工单系统导出反馈_客诉批次.csv',
    source: '客服工单',
    device: '华为 Mate 60 Pro',
    content: `反馈内容,提交渠道,上报机型,严重级评估
"【突发紧急】华为 Mate 60 Pro 升级 2.4.1 后车控页必崩卡死，无法蓝牙解锁，用户滞留在地下车库车门打不开！",客服工单,华为 Mate 60 Pro,阻断
"在高速服务区充电桩，App扫码付了120元立即跳枪报错扣款成功但无法充电！",客服工单,iPhone 15 Pro,阻断
"积分商城兑换的家充桩延期两周未发货，且物流页面无法查询单号。",客服工单,小米 14 Ultra,中
"社区App发帖时选择多张4K原图上传后卡死退出，导致已写好的提车日记草稿丢失。",客服工单,vivo X100 Pro,高
"好",客服工单,其他机型,低
"打卡打卡1111",客服工单,通用机型,低
"车机导航路线偶发漂移，在高架桥下容易识别为辅路导致错误提示掉头。",客服工单,iPhone 16 Pro Max,高`,
  },
  appstore_txt: {
    filename: 'App_Store_1星差评汇总与崩溃上报.txt',
    source: 'App Store',
    device: 'iPhone 16 Pro Max',
    content: `【突发紧急】iOS最新版蓝牙钥匙近场解锁彻底失灵！站在车旁5分钟感应不到，只能掏出实体钥匙！
App支付充电费后没有生成开票入口，客服一直排队80人无法解决。
希望锁屏小组件能够常驻显示剩余电量和充电倒计时。
很好用很赞
太垃圾了根本打不开，点开就闪退！
在零下15度使用远程暖车功能没有任何热风，车内完全没有反应！`,
  },
  community_json: {
    filename: '车友俱乐部社区与微信群高频槽点.json',
    source: '社群',
    device: '小米 14 Ultra',
    content: `[
  "【突发紧急】小米 14 Ultra 在升级澎湃OS最新补丁后，App蓝牙连接直接报错Code 401，无法启动车辆哨兵模式！",
  "希望导航能够增加长途充电规划的沿途充电桩空闲枪数实时显示功能。",
  "商城积分兑换专区好物上架太慢了，而且经常缺货。",
  "签到领积分",
  "远程寻车鸣笛闪灯时延迟长达30秒，在大型地库找车很吃力。"
]`,
  },
};

export const IngestionView: React.FC<IngestionViewProps> = ({
  onAddFeedbacks,
  onNavigateToWorklist,
}) => {
  const [inputText, setInputText] = useState(PRESET_REAL_FEEDBACKS);
  const [defaultSource, setDefaultSource] = useState<FeedbackSource>('应用内反馈');
  const [defaultDevice, setDefaultDevice] = useState<DeviceModel>('iPhone 15 Pro');
  const [processing, setProcessing] = useState(false);
  const [pipelineStats, setPipelineStats] = useState<PipelineFilterStat | null>(null);
  const [filteredSpamList, setFilteredSpamList] = useState<Array<{ text: string; reason: string; tokensSaved: number }>>([]);
  const [duplicatesList, setDuplicatesList] = useState<Array<{ text: string; reason: string }>>([]);
  const [processedFeedbacks, setProcessedFeedbacks] = useState<FeedbackItem[]>([]);
  const [stepStage, setStepStage] = useState<number>(0);

  // Document upload state
  const [uploadedDoc, setUploadedDoc] = useState<{
    name: string;
    size: string;
    lineCount: number;
    format: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse text or file contents into lines
  const parseDocumentContent = (content: string, filename: string) => {
    let lines: string[] = [];
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';

    if (ext === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          lines = parsed.map((item) =>
            typeof item === 'string' ? item : item.text || item.content || item.feedback || JSON.stringify(item)
          );
        } else if (typeof parsed === 'object') {
          lines = Object.values(parsed).map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
        }
      } catch (e) {
        lines = content.split('\n');
      }
    } else if (ext === 'csv') {
      const rawLines = content.split('\n').filter((l) => l.trim().length > 0);
      // Skip header if it contains typical header keywords
      const firstLine = rawLines[0] || '';
      const startIndex = firstLine.includes('内容') || firstLine.includes('feedback') || firstLine.includes('反馈') ? 1 : 0;
      
      lines = rawLines.slice(startIndex).map((line) => {
        // Strip quotes or commas
        let cleaned = line.trim();
        if (cleaned.startsWith('"') && cleaned.includes('",')) {
          const match = cleaned.match(/^"([^"]+)"/);
          if (match) return match[1];
        }
        return cleaned.replace(/^"/, '').replace(/"$/, '').split(',')[0] || cleaned;
      });
    } else {
      lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    }

    // Auto-detect device model if mentioned in filename or content
    if (content.includes('华为 Mate 60') || filename.includes('Mate60')) {
      setDefaultDevice('华为 Mate 60 Pro');
    } else if (content.includes('iPhone 16') || filename.includes('iOS') || filename.includes('Apple')) {
      setDefaultDevice('iPhone 16 Pro Max');
    } else if (content.includes('小米 14') || filename.includes('Xiaomi')) {
      setDefaultDevice('小米 14 Ultra');
    }

    if (filename.includes('工单') || filename.includes('客服')) {
      setDefaultSource('客服工单');
    } else if (filename.includes('App Store') || filename.includes('Store')) {
      setDefaultSource('App Store');
    } else if (filename.includes('社区') || filename.includes('微信') || filename.includes('群')) {
      setDefaultSource('社群');
    }

    const validLines = lines.filter((l) => l.trim().length > 0);
    setInputText(validLines.join('\n'));
    setUploadedDoc({
      name: filename,
      size: (content.length / 1024).toFixed(1) + ' KB',
      lineCount: validLines.length,
      format: ext.toUpperCase(),
    });
  };

  // Handle file selected from disk
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseDocumentContent(text, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parseDocumentContent(text, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSampleDoc = (key: string) => {
    const sample = SAMPLE_DOCUMENTS[key];
    if (!sample) return;
    setDefaultSource(sample.source);
    setDefaultDevice(sample.device);
    parseDocumentContent(sample.content, sample.filename);
  };

  const handleClearDoc = () => {
    setUploadedDoc(null);
    setInputText('');
  };

  const handleStartPipeline = async () => {
    if (!inputText.trim()) return;

    setProcessing(true);
    setStepStage(1);

    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    setTimeout(() => {
      setStepStage(2); // Deduplication & cleaning

      setTimeout(() => {
        setStepStage(3); // Spam filtering

        const { accepted, duplicates, spamFiltered, stats } = preprocessRawFeedbacks(
          lines,
          defaultSource,
          defaultDevice
        );

        setPipelineStats(stats);
        setFilteredSpamList(spamFiltered);
        setDuplicatesList(duplicates);

        setTimeout(() => {
          setStepStage(4); // Classification Agent

          const newItems: FeedbackItem[] = accepted.map((item, idx) => {
            const classified = classifyFeedbackDeterministic(item.cleanedText, item.source, item.deviceModel);
            const scoreInfo = calculatePriorityScore(
              classified.severity,
              1,
              classified.sentiment,
              classified.isEmergency
            );

            const now = new Date();
            const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            return {
              ...classified,
              id: `FB-${Date.now().toString().slice(-5)}-${idx + 100}`,
              createdAt,
              timestampMs: Date.now(),
              priorityScore: scoreInfo.finalScore,
            };
          });

          setProcessedFeedbacks(newItems);
          setProcessing(false);
          setStepStage(5); // Complete
        }, 600);
      }, 500);
    }, 500);
  };

  const handleImportToWorkspace = () => {
    if (processedFeedbacks.length === 0) return;
    onAddFeedbacks(processedFeedbacks);
    setImportSuccessMsg(`成功将 ${processedFeedbacks.length} 条已清洗结构化的车企反馈（含机型识别与紧急需求标定）导入至核心工作台！`);
    setTimeout(() => {
      onNavigateToWorklist();
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* 隐藏的真实文件选择控件 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv,.txt,.json,.md,.tsv,.xlsx"
        className="hidden"
      />

      {/* 1. 入口处：文档上传核心卡片 (Entry Point: Document Upload Dropzone) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white rounded-xl border-2 transition-all p-5 shadow-xs relative overflow-hidden ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
            : 'border-dashed border-slate-300 hover:border-blue-400 bg-gradient-to-br from-white via-slate-50/40 to-blue-50/20'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <UploadCloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  📁 数据接入入口：上传反馈文档与批量导入
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  支持 CSV · TXT · JSON · Markdown · Excel导出
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                可直接拖拽或点击上传客服工单导出表格、App Store评价汇总或社区日志。系统自动提取手机机型（iOS/鸿蒙/安卓主力机）与紧急突发故障。
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>选择本地文档上传</span>
            </button>
          </div>
        </div>

        {/* Uploaded File Info Preview Banner if present */}
        {uploadedDoc ? (
          <div className="mt-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                {uploadedDoc.format}
              </div>
              <div>
                <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
                  <span>{uploadedDoc.name}</span>
                  <span className="text-[10px] text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                    {uploadedDoc.size}
                  </span>
                </div>
                <div className="text-[11px] text-blue-800 mt-0.5">
                  已解析提取 <span className="font-bold text-blue-900">{uploadedDoc.lineCount}</span> 条车主反馈数据 · 默认机型: <span className="font-semibold">{defaultDevice}</span> · 渠道: <span className="font-semibold">{defaultSource}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleStartPipeline}
                disabled={processing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs flex items-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3" />
                <span>立即启动智能清洗</span>
              </button>
              <button
                onClick={handleClearDoc}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="清除此文档"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Preset Document Quick Loaders */
          <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-medium">快速体验车企样本库:</span>
            <button
              onClick={() => handleLoadSampleDoc('service_csv')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>载入《客服工单导出反馈.csv》(含突发崩溃与扣费)</span>
            </button>
            <button
              onClick={() => handleLoadSampleDoc('appstore_txt')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>载入《App Store 1星差评汇总.txt》</span>
            </button>
            <button
              onClick={() => handleLoadSampleDoc('community_json')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-600" />
              <span>载入《车友群高频槽点.json》</span>
            </button>
          </div>
        )}
      </div>

      {/* Import Success Notification */}
      {importSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{importSuccessMsg}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-normal">正在跳转至工作台...</span>
        </div>
      )}

      {/* 2. 文本编辑与流水线监控 (Input Textarea & Pipeline Visualizer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Textarea */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <label className="text-xs font-bold text-slate-800">
                反馈文本待处理区 (一行一条，可直接编辑修改)
              </label>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">渠道:</span>
                <select
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value as FeedbackSource)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                >
                  <option value="应用内反馈">应用内反馈</option>
                  <option value="客服工单">客服工单</option>
                  <option value="App Store">App Store</option>
                  <option value="社群">社群</option>
                </select>
              </div>

              {/* 机型选择 */}
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">默认机型:</span>
                <select
                  value={defaultDevice}
                  onChange={(e) => setDefaultDevice(e.target.value as DeviceModel)}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                >
                  <option value="iPhone 16 Pro Max">iPhone 16 Pro Max</option>
                  <option value="iPhone 15 Pro">iPhone 15 Pro</option>
                  <option value="iPhone 14">iPhone 14</option>
                  <option value="华为 Mate 60 Pro">华为 Mate 60 Pro</option>
                  <option value="华为 Pura 70">华为 Pura 70</option>
                  <option value="小米 14 Ultra">小米 14 Ultra</option>
                  <option value="小米 13">小米 13</option>
                  <option value="OPPO Find X7">OPPO Find X7</option>
                  <option value="vivo X100 Pro">vivo X100 Pro</option>
                  <option value="三星 Galaxy S24">三星 Galaxy S24</option>
                  <option value="其他机型">其他机型</option>
                </select>
              </div>
            </div>
          </div>

          <textarea
            rows={10}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入或粘贴车企用户反馈，例如：【突发紧急】华为Mate 60 Pro升级后车控首页闪退..."
            className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <button
              onClick={() => {
                setUploadedDoc(null);
                setInputText(PRESET_REAL_FEEDBACKS);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 恢复标准车企典型案例 (含突发紧急与各主流机型)
            </button>

            <button
              onClick={handleStartPipeline}
              disabled={processing || !inputText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              {processing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>流水线清洗与分类中...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>运行前置过滤与分类流水线</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Real-time Pipeline Visualizer */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              流水线工序监控与成本节约
            </h3>

            {/* 4 Pipeline Stages */}
            <div className="space-y-3">
              {/* Step 1: Text format standardization & Device parsing */}
              <div className={`p-3 rounded-lg border text-xs transition-all ${
                stepStage >= 1 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    格式清洗与手机机型特征提取
                  </span>
                  {stepStage > 1 && <CheckCircle className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  去除特殊emoji噪点、多余空行，自动识别文本中的 iOS / 鸿蒙 / 安卓主力机型并打标
                </p>
              </div>

              {/* Step 2: Semantic Deduplication */}
              <div className={`p-3 rounded-lg border text-xs transition-all ${
                stepStage >= 2 ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    高频相似去重 (SimHash / Jaccard)
                  </span>
                  {stepStage > 2 && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  合并重复反馈，频次叠加记权，避免重复消耗大模型处理算力
                </p>
              </div>

              {/* Step 3: Spam & Meaningless Filter */}
              <div className={`p-3 rounded-lg border text-xs transition-all ${
                stepStage >= 3 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                    垃圾灌水前置过滤 (成本控制核心)
                  </span>
                  {stepStage > 3 && <CheckCircle className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  前置规则拦截"好"、"111"、纯标点、打卡刷分等无价值灌水，不调用 Agent
                </p>
              </div>

              {/* Step 4: Intelligent Classification Agent */}
              <div className={`p-3 rounded-lg border text-xs transition-all ${
                stepStage >= 4 ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">4</span>
                    Agent 多维诊断与突发紧急嗅探
                  </span>
                  {stepStage >= 5 && <CheckCircle className="w-4 h-4 text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  输出功能模块、严重度、问题类型（含突发紧急修复识别）、置信度与推理成因
                </p>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          {pipelineStats && (
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-400 block text-[10px]">原始输入条数</span>
                <span className="font-bold text-slate-800 text-sm">{pipelineStats.rawCount}</span>
              </div>
              <div className="p-2 bg-red-50 text-red-700 rounded">
                <span className="block text-[10px]">拦截无效/重复</span>
                <span className="font-bold text-sm">
                  {pipelineStats.spamFilteredCount + pipelineStats.dedupedCount}
                </span>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded">
                <span className="block text-[10px]">节约估算Token</span>
                <span className="font-bold text-sm">~{pipelineStats.tokensSaved}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 清洗后结构化结果预览 (Processed Results Table) */}
      {processedFeedbacks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>清洗后结构化输出</span>
                <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-bold">
                  {processedFeedbacks.length} 条已就绪
                </span>
                {processedFeedbacks.some((f) => f.isEmergency || f.issueType === '紧急待修复') && (
                  <span className="px-2 py-0.5 text-xs bg-rose-600 text-white rounded-full font-bold animate-pulse flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-300" />
                    含突发紧急待修复
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                每条反馈已自动完成机型标定、多维标签诊断与优先级综合打分
              </p>
            </div>

            <button
              onClick={handleImportToWorkspace}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" /> 一键导入到核心工作台
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {processedFeedbacks.map((item, idx) => (
              <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-700">{item.module}</span>
                    <span className="text-slate-400">·</span>
                    <IssueTypeBadge type={item.issueType} />
                    <span className="text-slate-400">·</span>
                    <span className={`font-semibold ${
                      item.severity === '阻断' ? 'text-red-600' : 'text-slate-700'
                    }`}>
                      {item.severity}
                    </span>
                    <DeviceBadge model={item.deviceModel} size="sm" />
                    <span className="text-[11px] text-slate-400">({item.source})</span>
                  </div>
                  <p className="text-slate-800 font-medium">{item.originalText}</p>
                  <p className="text-slate-500 text-[11px]">
                    <span className="font-medium text-slate-600">AI理由:</span> {item.agentReasoning}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[11px] font-bold">
                    得分: {item.priorityScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtered Spam & Duplicates Log */}
      {filteredSpamList.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>前置拦截日志详情（未发送给 Agent 处理，节约算力）</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {filteredSpamList.map((spam, idx) => (
              <div key={idx} className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-medium truncate max-w-[60%]">"{spam.text}"</span>
                <span className="text-[11px] text-red-600 font-mono">{spam.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
