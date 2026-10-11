import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FeedbackItem,
  FeedbackSource,
  DeviceModel,
  PipelineFilterStat,
  VehicleModel,
  GAC_HONDA_MODELS,
  getRandomGacHondaModel,
} from '../types/feedback';
import {
  preprocessRawFeedbacks,
  classifyFeedbackDeterministic,
  detectVehicleModelFromText,
} from '../utils/feedbackClassifier';
import { calculatePriorityScore } from '../utils/priorityScorer';
import { SAMPLE_FILTERED_SPAM } from '../data/mockFeedbacks';
import { DeviceBadge, IssueTypeBadge, SourceBadge, VehicleBadge } from './common/Badges';
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
  Car,
  Flame,
  FileSpreadsheet,
  FileCode,
  FolderOpen,
  Trash2,
  Check,
  Plus,
  LayoutList,
  Edit3,
  AlignLeft,
  RefreshCw,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCheck,
  Undo2,
} from 'lucide-react';

interface IngestionViewProps {
  onAddFeedbacks: (items: FeedbackItem[]) => void;
  onNavigateToWorklist: () => void;
}

export interface WorkspaceItem {
  id: string;
  text: string;
  source: FeedbackSource;
  device: DeviceModel;
  vehicle: VehicleModel;
  isEmergency?: boolean;
}

const PRESET_REAL_FEEDBACKS = [
  '【突发紧急】华为 Mate 60 Pro 升级 2.4.1 后打开车控首页必崩卡死！无法蓝牙解锁！车门打不开！',
  '在高速服务区国网快充桩，App扫码付了100块钱，充了3秒就跳枪报错，钱扣了充电桩直接断电，车没充上电！',
  '冬天零下20度，在App远程开启电池预热和车内除霜，显示开启成功但过去20分钟车窗还是厚厚的冰，远程控制根本没生效！',
  '小米 14 Ultra 手机锁屏小组件能不能支持显示当前充电功率和剩余分钟数？不要每次都特意点进App看。',
  '路线规划经过收费站时，能不能提醒ETC车道还是人工车道？',
  '好',
  '1111111111',
  '打卡签到领50积分',
  'iPhone 16 Pro Max 在地下车库用蓝牙钥匙解闭锁经常失效，在车旁等很长时间，希望增强离线鉴权能力。',
  '社区发提车作业帖，图片排版顺序经常乱掉，保存草稿后原图分辨率还变低了。',
  '👍👍👍🚗',
  '在积分商城兑换的随车充，发票抬头开错了，在线客服一直排队80多个人联系不上。',
];

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

/**
 * 智能字符集解码函数：支持 UTF-8、GBK/GB2312/GB18030、UTF-16LE，自动纠正乱码
 */
function decodeBufferToText(
  buffer: ArrayBuffer,
  forcedEncoding: 'auto' | 'gbk' | 'utf-8' = 'auto'
): { text: string; detectedEncoding: string } {
  const bytes = new Uint8Array(buffer);

  // 1. 如果用户手动指定了编码
  if (forcedEncoding === 'gbk') {
    try {
      const gbkDecoder = new TextDecoder('gb18030');
      return { text: gbkDecoder.decode(bytes), detectedEncoding: 'GB18030 / GBK (手动指定)' };
    } catch (e) {
      return { text: new TextDecoder('utf-8').decode(bytes), detectedEncoding: 'UTF-8' };
    }
  }

  if (forcedEncoding === 'utf-8') {
    return { text: new TextDecoder('utf-8').decode(bytes), detectedEncoding: 'UTF-8 (手动指定)' };
  }

  // 2. 检查 BOM 头
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), detectedEncoding: 'UTF-8 (带 BOM)' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), detectedEncoding: 'UTF-16LE' };
  }

  // 3. 严格检测 UTF-8 是否合法
  try {
    const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
    const decoded = strictUtf8.decode(bytes);

    // 检查是否有典型的 GBK 乱码误判（如连续的控制字符或特定乱码标志）
    return { text: decoded, detectedEncoding: 'UTF-8' };
  } catch (err) {
    // 遇到非法 UTF-8 字节序列，典型为 Windows 导出中文 CSV (GBK / GB2312 / GB18030)
    try {
      const gbkDecoder = new TextDecoder('gb18030');
      const text = gbkDecoder.decode(bytes);
      return {
        text,
        detectedEncoding: 'GBK / GB2312 (中文 Windows Excel 常见)',
      };
    } catch (e2) {
      return { text: new TextDecoder('utf-8').decode(bytes), detectedEncoding: 'UTF-8 (降级容错)' };
    }
  }
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  onAddFeedbacks,
  onNavigateToWorklist,
}) => {
  // Global defaults
  const [defaultSource, setDefaultSource] = useState<FeedbackSource>('应用内反馈');
  const [defaultDevice, setDefaultDevice] = useState<DeviceModel>('iPhone 15 Pro');

  // Itemized card list state (Core UX improvement)
  const [feedbackItems, setFeedbackItems] = useState<WorkspaceItem[]>(() => {
    return PRESET_REAL_FEEDBACKS.map((t, idx) => ({
      id: `ITEM-${Date.now()}-${idx + 1}`,
      text: t,
      source: '应用内反馈',
      device: t.includes('华为') ? '华为 Mate 60 Pro' : t.includes('小米') ? '小米 14 Ultra' : t.includes('iPhone') ? 'iPhone 16 Pro Max' : 'iPhone 15 Pro',
      vehicle: detectVehicleModelFromText(t),
      isEmergency: t.includes('【突发紧急】') || t.includes('必崩') || t.includes('跳枪报错'),
    }));
  });

  // View mode: 'cards' (distinct separated blocks) or 'batch' (raw textarea)
  const [viewMode, setViewMode] = useState<'cards' | 'batch'>('cards');
  const [batchRawText, setBatchRawText] = useState<string>('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [pasteInput, setPasteInput] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [pipelineStats, setPipelineStats] = useState<PipelineFilterStat | null>(null);
  const [filteredSpamList, setFilteredSpamList] = useState<Array<{ text: string; reason: string; tokensSaved: number }>>(() => [...SAMPLE_FILTERED_SPAM]);
  const [duplicatesList, setDuplicatesList] = useState<Array<{ text: string; reason: string }>>([]);
  const [processedFeedbacks, setProcessedFeedbacks] = useState<FeedbackItem[]>([]);
  const [stepStage, setStepStage] = useState<number>(0);

  // 前置拦截日志展开状态与误判纠偏一键结构化输出状态
  const [isLogExpanded, setIsLogExpanded] = useState<boolean>(true);
  const [expandedLogItemIdx, setExpandedLogItemIdx] = useState<number | null>(null);
  const [rescueToast, setRescueToast] = useState<string | null>(null);
  const [editingSpam, setEditingSpam] = useState<{ text: string; reason: string; tokensSaved: number } | null>(null);
  const [editSpamText, setEditSpamText] = useState('');
  const [editSpamNote, setEditSpamNote] = useState('');

  // Document upload state & file buffer cache for instant re-encoding
  const [cachedFile, setCachedFile] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);
  const [encodingChoice, setEncodingChoice] = useState<'auto' | 'gbk' | 'utf-8'>('auto');
  const [uploadedDoc, setUploadedDoc] = useState<{
    name: string;
    size: string;
    lineCount: number;
    format: string;
    detectedEncoding: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize batchRawText whenever feedbackItems change
  useEffect(() => {
    setBatchRawText(feedbackItems.map((item) => item.text).join('\n'));
  }, [feedbackItems]);

  // Parse Buffer into individual feedback items
  const parseBuffer = (
    buffer: ArrayBuffer,
    filename: string,
    forcedEncoding: 'auto' | 'gbk' | 'utf-8' = 'auto'
  ) => {
    let lines: string[] = [];
    let detectedEncoding = 'UTF-8';
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';

    // 1. 如果是 Excel 文件 (.xlsx 或 .xls)
    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        detectedEncoding = `Excel 二进制 (${ext.toUpperCase()} 表格)`;

        for (const row of rows) {
          if (!Array.isArray(row) || row.length === 0) continue;
          const cells = row.map((c) => (c != null ? String(c).trim() : '')).filter((c) => c.length > 0);
          if (cells.length === 0) continue;

          // 过滤表头
          const isHeader = cells.some((s) =>
            ['反馈', '内容', '描述', '工单', '用户原声', 'feedback', '序号'].some((k) =>
              s.toLowerCase().includes(k)
            ) && s.length < 8
          );
          if (lines.length === 0 && isHeader) {
            continue;
          }

          // 取长度最长或第一列作为反馈正文
          const contentCandidate = cells.reduce((prev, curr) => (curr.length > prev.length ? curr : prev), '');
          if (contentCandidate.length > 0) {
            lines.push(contentCandidate);
          }
        }
      } catch (err) {
        console.error('XLSX 解析失败，尝试文本降级', err);
        const res = decodeBufferToText(buffer, forcedEncoding);
        lines = res.text.split('\n');
        detectedEncoding = res.detectedEncoding;
      }
    } else if (ext === 'json') {
      // 2. 如果是 JSON 文件
      const res = decodeBufferToText(buffer, forcedEncoding);
      detectedEncoding = res.detectedEncoding;
      try {
        const parsed = JSON.parse(res.text);
        if (Array.isArray(parsed)) {
          lines = parsed.map((item) =>
            typeof item === 'string'
              ? item
              : item.text || item.content || item.feedback || JSON.stringify(item)
          );
        } else if (typeof parsed === 'object') {
          lines = Object.values(parsed).map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
        }
      } catch (e) {
        lines = res.text.split('\n');
      }
    } else {
      // 3. 如果是 CSV、TXT 或 Markdown 等纯文本
      const res = decodeBufferToText(buffer, forcedEncoding);
      detectedEncoding = res.detectedEncoding;

      const rawLines = res.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (ext === 'csv') {
        const firstLine = rawLines[0] || '';
        const startIndex =
          firstLine.includes('内容') || firstLine.includes('feedback') || firstLine.includes('反馈') ? 1 : 0;

        lines = rawLines.slice(startIndex).map((line) => {
          let cleaned = line.trim();
          if (cleaned.startsWith('"') && cleaned.includes('",')) {
            const match = cleaned.match(/^"([^"]+)"/);
            if (match) return match[1];
          }
          return cleaned.replace(/^"/, '').replace(/"$/, '').split(',')[0] || cleaned;
        });
      } else {
        lines = rawLines;
      }
    }

    // 针对车企高发机型和渠道自动预判
    let inferredDevice = defaultDevice;
    const fullText = lines.join(' ');
    if (fullText.includes('华为 Mate 60') || filename.includes('Mate60')) {
      inferredDevice = '华为 Mate 60 Pro';
    } else if (fullText.includes('iPhone 16') || filename.includes('iOS') || filename.includes('Apple')) {
      inferredDevice = 'iPhone 16 Pro Max';
    } else if (fullText.includes('小米 14') || filename.includes('Xiaomi')) {
      inferredDevice = '小米 14 Ultra';
    }

    let inferredSource = defaultSource;
    if (filename.includes('工单') || filename.includes('客服')) {
      inferredSource = '客服工单';
    } else if (filename.includes('App Store') || filename.includes('Store')) {
      inferredSource = 'App Store';
    } else if (filename.includes('社区') || filename.includes('微信') || filename.includes('群')) {
      inferredSource = '社群';
    }

    const validLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);

    // 转化为具有独立区隔的卡片条目
    const newItems: WorkspaceItem[] = validLines.map((lineText, idx) => ({
      id: `UPLOAD-${Date.now()}-${idx + 1}`,
      text: lineText,
      source: inferredSource,
      device: inferredDevice,
      vehicle: detectVehicleModelFromText(lineText),
      isEmergency: lineText.includes('【突发紧急】') || lineText.includes('必崩') || lineText.includes('跳枪报错') || lineText.includes('打不开'),
    }));

    setFeedbackItems(newItems);
    setUploadedDoc({
      name: filename,
      size: (buffer.byteLength / 1024).toFixed(1) + ' KB',
      lineCount: newItems.length,
      format: ext.toUpperCase(),
      detectedEncoding,
    });
  };

  // 处理真实本地文件选择
  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      setCachedFile({ name: file.name, buffer });
      parseBuffer(buffer, file.name, encodingChoice);
    } catch (err) {
      console.error('读取文件失败', err);
    }
  };

  // 用户点击切换编码（解决 Windows 中文 Excel 乱码的利器）
  const handleEncodingSwitch = (enc: 'auto' | 'gbk' | 'utf-8') => {
    setEncodingChoice(enc);
    if (cachedFile) {
      parseBuffer(cachedFile.buffer, cachedFile.name, enc);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

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
    if (file) handleFile(file);
  };

  // 载入预设示例文件
  const handleLoadSampleDoc = (key: string) => {
    const sample = SAMPLE_DOCUMENTS[key];
    if (!sample) return;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(sample.content).buffer;
    setCachedFile({ name: sample.filename, buffer });
    setDefaultSource(sample.source);
    setDefaultDevice(sample.device);
    parseBuffer(buffer, sample.filename, 'utf-8');
  };

  // 清除上传文档与卡片
  const handleClearAll = () => {
    setUploadedDoc(null);
    setCachedFile(null);
    setFeedbackItems([]);
  };

  // 恢复默认案例集
  const handleResetPresets = () => {
    setUploadedDoc(null);
    setCachedFile(null);
    setFeedbackItems(
      PRESET_REAL_FEEDBACKS.map((t, idx) => ({
        id: `PRESET-${idx + 1}`,
        text: t,
        source: '应用内反馈',
        device: t.includes('华为') ? '华为 Mate 60 Pro' : t.includes('小米') ? '小米 14 Ultra' : t.includes('iPhone') ? 'iPhone 16 Pro Max' : 'iPhone 15 Pro',
        vehicle: detectVehicleModelFromText(t),
        isEmergency: t.includes('【突发紧急】') || t.includes('必崩') || t.includes('跳枪报错'),
      }))
    );
  };

  // 卡片单条操作逻辑
  const handleUpdateItemText = (id: string, text: string) => {
    setFeedbackItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const handleToggleEmergency = (id: string) => {
    setFeedbackItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEmergency: !item.isEmergency } : item))
    );
  };

  const handleUpdateItemDevice = (id: string, device: DeviceModel) => {
    setFeedbackItems((prev) => prev.map((item) => (item.id === id ? { ...item, device } : item)));
  };

  const handleUpdateItemVehicle = (id: string, vehicle: VehicleModel) => {
    setFeedbackItems((prev) => prev.map((item) => (item.id === id ? { ...item, vehicle } : item)));
  };

  const handleUpdateItemSource = (id: string, source: FeedbackSource) => {
    setFeedbackItems((prev) => prev.map((item) => (item.id === id ? { ...item, source } : item)));
  };

  const handleDeleteItem = (id: string) => {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewCard = () => {
    const newItem: WorkspaceItem = {
      id: `ITEM-${Date.now()}-${feedbackItems.length + 1}`,
      text: '',
      source: defaultSource,
      device: defaultDevice,
      vehicle: getRandomGacHondaModel(),
      isEmergency: false,
    };
    setFeedbackItems((prev) => [...prev, newItem]);
  };

  // 批量追加弹窗确认
  const handleConfirmBatchPaste = () => {
    if (!pasteInput.trim()) return;
    const lines = pasteInput.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const added: WorkspaceItem[] = lines.map((l, i) => ({
      id: `BATCH-${Date.now()}-${i}`,
      text: l,
      source: defaultSource,
      device: defaultDevice,
      vehicle: detectVehicleModelFromText(l),
      isEmergency: l.includes('紧急') || l.includes('崩溃') || l.includes('卡死'),
    }));
    setFeedbackItems((prev) => [...prev, ...added]);
    setPasteInput('');
    setIsBatchModalOpen(false);
  };

  // 将批量文本同步回独立卡片
  const handleSyncFromBatchRaw = () => {
    const lines = batchRawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const items: WorkspaceItem[] = lines.map((l, idx) => ({
      id: `SYNC-${Date.now()}-${idx}`,
      text: l,
      source: defaultSource,
      device: defaultDevice,
      vehicle: detectVehicleModelFromText(l),
      isEmergency: l.includes('【突发紧急】') || l.includes('崩溃') || l.includes('卡死'),
    }));
    setFeedbackItems(items);
    setViewMode('cards');
  };

  // 执行清洗与分类流水线
  const handleStartPipeline = async () => {
    const validLines = feedbackItems.map((i) => i.text.trim()).filter((t) => t.length > 0);
    if (validLines.length === 0) return;

    setProcessing(true);
    setStepStage(1);

    setTimeout(() => {
      setStepStage(2); // Deduplication & cleaning

      setTimeout(() => {
        setStepStage(3); // Spam filtering

        const { accepted, duplicates, spamFiltered, stats } = preprocessRawFeedbacks(
          validLines,
          defaultSource,
          defaultDevice
        );

        setPipelineStats(stats);
        setFilteredSpamList(spamFiltered);
        setDuplicatesList(duplicates);

        setTimeout(() => {
          setStepStage(4); // Classification Agent

          const newItems: FeedbackItem[] = accepted.map((item, idx) => {
            // 查找对应卡片用户是否手动指定了机型、车型或渠道
            const originalCard = feedbackItems.find((fi) => fi.text.includes(item.originalText) || item.originalText.includes(fi.text));
            const itemDevice = originalCard?.device || item.deviceModel;
            const itemSource = originalCard?.source || item.source;
            const itemVehicle = originalCard?.vehicle || detectVehicleModelFromText(item.originalText);

            const classified = classifyFeedbackDeterministic(item.cleanedText, itemSource, itemDevice, itemVehicle);
            const isItemEmergency = originalCard?.isEmergency || classified.isEmergency;

            const scoreInfo = calculatePriorityScore(
              classified.severity,
              1,
              classified.sentiment,
              isItemEmergency
            );

            const now = new Date();
            const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            return {
              ...classified,
              source: itemSource,
              deviceModel: itemDevice,
              vehicleModel: itemVehicle,
              isEmergency: isItemEmergency,
              issueType: isItemEmergency ? '紧急待修复' : classified.issueType,
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

  // 误判纠偏：对前置拦截的一条日志一键结构化输出
  const handleSingleRescueAndStructure = (
    spam: { text: string; reason: string; tokensSaved: number },
    customText?: string,
    customNote?: string
  ) => {
    const rawText = customText?.trim() || spam.text;
    // 从拦截列表中剔除
    setFilteredSpamList((prev) => prev.filter((s) => s.text !== spam.text));

    // 更新流水线统计数字
    setPipelineStats((prev) =>
      prev
        ? {
            ...prev,
            spamFilteredCount: Math.max(0, prev.spamFilteredCount - 1),
            readyForAgentCount: prev.readyForAgentCount + 1,
            tokensSaved: Math.max(0, prev.tokensSaved - spam.tokensSaved),
          }
        : null
    );

    // 针对被拦截文本调用智能多维分类与打分模型 (包含广汽本田车型提取)
    const itemVehicle = detectVehicleModelFromText(rawText);
    const classified = classifyFeedbackDeterministic(rawText, defaultSource, defaultDevice, itemVehicle);
    const isEmerg =
      rawText.includes('紧急') ||
      rawText.includes('闪退') ||
      rawText.includes('崩溃') ||
      rawText.includes('打不开') ||
      rawText.includes('死机') ||
      classified.isEmergency;

    const scoreInfo = calculatePriorityScore(
      classified.severity,
      1,
      classified.sentiment,
      isEmerg
    );

    const now = new Date();
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newItem: FeedbackItem = {
      ...classified,
      id: `RESCUED-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
      originalText: rawText,
      cleanedText: rawText.replace(/^[#\s\d.-]+/, '').trim(),
      source: defaultSource,
      deviceModel: defaultDevice,
      vehicleModel: itemVehicle,
      isEmergency: isEmerg,
      issueType: isEmerg ? '紧急待修复' : classified.issueType,
      priorityScore: scoreInfo.finalScore,
      createdAt,
      timestampMs: Date.now(),
      agentReasoning: customNote
        ? `【PM人工误判纠偏】${customNote}`
        : `【PM人工误判纠偏】原前置规则判定为「${spam.reason}」，PM经人工复核确认其为真实车主有效痛点，一键完成结构化输出`,
      needsReview: false,
      reviewStatus: 'modified',
    };

    setProcessedFeedbacks((prev) => [newItem, ...prev]);
    setRescueToast(`已成功将「${rawText.slice(0, 16)}...」一键结构化并加入就绪列表！`);
    setTimeout(() => {
      setRescueToast(null);
    }, 3500);
  };

  // 误判纠偏：一键将所有被拦截的日志全部批量结构化输出
  const handleRescueAllSpam = () => {
    if (filteredSpamList.length === 0) return;
    const itemsToAdd: FeedbackItem[] = filteredSpamList.map((spam, idx) => {
      const itemVehicle = detectVehicleModelFromText(spam.text);
      const classified = classifyFeedbackDeterministic(spam.text, defaultSource, defaultDevice, itemVehicle);
      const isEmerg =
        spam.text.includes('紧急') ||
        spam.text.includes('闪退') ||
        spam.text.includes('崩溃') ||
        spam.text.includes('打不开') ||
        spam.text.includes('死机') ||
        classified.isEmergency;

      const scoreInfo = calculatePriorityScore(
        classified.severity,
        1,
        classified.sentiment,
        isEmerg
      );

      const now = new Date();
      const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      return {
        ...classified,
        id: `RESCUED-ALL-${Date.now().toString().slice(-4)}-${idx}`,
        originalText: spam.text,
        cleanedText: spam.text.trim(),
        source: defaultSource,
        deviceModel: defaultDevice,
        vehicleModel: itemVehicle,
        isEmergency: isEmerg,
        issueType: isEmerg ? '紧急待修复' : classified.issueType,
        priorityScore: scoreInfo.finalScore,
        createdAt,
        timestampMs: Date.now(),
        agentReasoning: `【PM一键全部纠偏】原前置拦截判定为「${spam.reason}」，经人工一键全部找回并结构化输出`,
        needsReview: false,
        reviewStatus: 'modified',
      };
    });

    setProcessedFeedbacks((prev) => [...itemsToAdd, ...prev]);
    setFilteredSpamList([]);
    setRescueToast(`已成功将全部 ${itemsToAdd.length} 条拦截日志一键结构化并转入输出列表！`);
    setTimeout(() => {
      setRescueToast(null);
    }, 3500);
  };

  // 开启编辑弹窗
  const handleOpenEditSpam = (spam: { text: string; reason: string; tokensSaved: number }) => {
    setEditingSpam(spam);
    setEditSpamText(spam.text);
    setEditSpamNote('人工补充实际用车场景与上下文');
  };

  const handleConfirmEditSpam = () => {
    if (!editingSpam || !editSpamText.trim()) return;
    handleSingleRescueAndStructure(editingSpam, editSpamText, editSpamNote);
    setEditingSpam(null);
  };

  const handleImportToWorkspace = () => {
    if (processedFeedbacks.length === 0) return;
    onAddFeedbacks(processedFeedbacks);
    setImportSuccessMsg(
      `成功将 ${processedFeedbacks.length} 条已清洗结构化的车企反馈（含机型识别与紧急需求标定）导入至核心工作台！`
    );
    setTimeout(() => {
      onNavigateToWorklist();
    }, 1200);
  };

  const emergencyCount = feedbackItems.filter((i) => i.isEmergency).length;

  return (
    <div className="space-y-6">
      {/* 隐藏的真实本地文件上传选择器 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".csv,.txt,.json,.md,.tsv,.xlsx,.xls"
        className="hidden"
      />

      {/* 1. 入口处：本地文档上传核心卡片 (Entry Point: Document Upload Dropzone) */}
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
                  支持 Excel (.xlsx/.xls) · CSV · TXT · JSON · MD
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  智能防乱码引擎 (支持 Windows GBK / GB2312 自动转码)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                针对车企 PM 常见的 Windows Excel 导出 CSV/Excel 做了**全自动字符编码识别与乱码拦截**。上传后自动按条目切分为清晰卡片。
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
          <div className="mt-4 p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs">
                  {uploadedDoc.format}
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-2">
                    <span>{uploadedDoc.name}</span>
                    <span className="text-[10px] text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                      {uploadedDoc.size}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                      ✨ 识别编码: {uploadedDoc.detectedEncoding}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 mt-0.5">
                    已成功解析提取为 <span className="font-bold text-blue-900">{uploadedDoc.lineCount}</span> 条独立卡片反馈 · 文本乱码已自动纠偏
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartPipeline}
                  disabled={processing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>启动清洗流水线</span>
                </button>
                <button
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="清除此文档"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 乱码应急手动切换开关 (防特殊历史工单系统) */}
            <div className="pt-2 border-t border-blue-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>若文字仍有乱码，请一键切换解码格式：</span>
                <div className="inline-flex rounded-lg border border-blue-200 bg-white p-0.5 shadow-2xs">
                  <button
                    onClick={() => handleEncodingSwitch('auto')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      encodingChoice === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    自动侦测
                  </button>
                  <button
                    onClick={() => handleEncodingSwitch('gbk')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      encodingChoice === 'gbk' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    强制 GBK / 简体中文 (Windows Excel)
                  </button>
                  <button
                    onClick={() => handleEncodingSwitch('utf-8')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      encodingChoice === 'utf-8' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    强制 UTF-8 (Mac/Web 常见)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Preset Document Quick Loaders */
          <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-medium">快速体验车企样本库:</span>
            <button
              onClick={() => handleLoadSampleDoc('service_csv')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>载入《客服工单导出反馈.csv》(含突发崩溃与扣费)</span>
            </button>
            <button
              onClick={() => handleLoadSampleDoc('appstore_txt')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>载入《App Store 1星差评汇总.txt》</span>
            </button>
            <button
              onClick={() => handleLoadSampleDoc('community_json')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
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

      {/* 2. 反馈文本待处理区（一条一条独立区隔的卡片工作台） */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Itemized Card Workspace */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LayoutList className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  待清洗反馈条目工作台 (单条独立卡片区隔)
                </h4>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 rounded-full">
                  共 {feedbackItems.length} 条独立条目
                </span>
                {emergencyCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 rounded-full flex items-center gap-0.5 animate-pulse">
                    <Flame className="w-3 h-3 text-rose-600" />
                    {emergencyCount} 起紧急
                  </span>
                )}
              </div>

              {/* View mode toggle & quick actions */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>独立卡片模式</span>
                  </button>
                  <button
                    onClick={() => setViewMode('batch')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      viewMode === 'batch' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>批量文本视图</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="多行文本批量追加"
                >
                  <Plus className="w-3.5 h-3.5" /> 批量追加
                </button>
              </div>
            </div>

            {/* Global Defaults Row */}
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 flex-wrap gap-2">
              <span className="font-semibold text-slate-700">新条目全局默认值：</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>默认渠道:</span>
                  <select
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value as FeedbackSource)}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800"
                  >
                    <option value="应用内反馈">应用内反馈</option>
                    <option value="客服工单">客服工单</option>
                    <option value="App Store">App Store</option>
                    <option value="社群">社群</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3 text-slate-400" />
                  <span>默认机型:</span>
                  <select
                    value={defaultDevice}
                    onChange={(e) => setDefaultDevice(e.target.value as DeviceModel)}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800"
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

            {/* 视图模式 1：一条一条独立区隔的卡片列表 */}
            {viewMode === 'cards' ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {feedbackItems.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">当前暂无待处理反馈条目</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={handleAddNewCard}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                      >
                        添加一条反馈
                      </button>
                      <button
                        onClick={handleResetPresets}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold"
                      >
                        载入标准案例
                      </button>
                    </div>
                  </div>
                ) : (
                  feedbackItems.map((item, index) => {
                    const isEmergency = item.isEmergency;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all space-y-2 shadow-2xs ${
                          isEmergency
                            ? 'bg-rose-50/30 border-rose-300 hover:border-rose-400'
                            : 'bg-white border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-800 text-white font-mono font-bold text-xs flex items-center justify-center">
                              #{String(index + 1).padStart(2, '0')}
                            </span>

                            {/* Device Model Selector on Card */}
                            <select
                              value={item.device}
                              onChange={(e) => handleUpdateItemDevice(item.id, e.target.value as DeviceModel)}
                              className="px-2 py-0.5 text-xs bg-slate-50 border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

                            {/* GAC Honda Vehicle Selector on Card */}
                            <select
                              value={item.vehicle || '雅阁 (Accord)'}
                              onChange={(e) => handleUpdateItemVehicle(item.id, e.target.value as VehicleModel)}
                              className="px-2 py-0.5 text-xs bg-blue-50/60 border border-blue-200 text-blue-900 rounded font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                              title="广汽本田车型分类"
                            >
                              {GAC_HONDA_MODELS.map((v) => (
                                <option key={v} value={v}>
                                  🚗 {v}
                                </option>
                              ))}
                            </select>

                            {/* Source Selector on Card */}
                            <select
                              value={item.source}
                              onChange={(e) => handleUpdateItemSource(item.id, e.target.value as FeedbackSource)}
                              className="px-2 py-0.5 text-xs bg-slate-50 border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="应用内反馈">应用内反馈</option>
                              <option value="客服工单">客服工单</option>
                              <option value="App Store">App Store</option>
                              <option value="社群">社群</option>
                            </select>

                            {/* 突发紧急标记按钮 */}
                            <button
                              type="button"
                              onClick={() => handleToggleEmergency(item.id)}
                              className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                isEmergency
                                  ? 'bg-rose-600 text-white shadow-2xs animate-pulse'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700'
                              }`}
                            >
                              <Flame className="w-3 h-3" />
                              {isEmergency ? '已标为突发紧急' : '标记紧急'}
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {item.text.length} 字符
                            </span>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                              title="删除此条反馈"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Card Text Input */}
                        <textarea
                          rows={2}
                          value={item.text}
                          onChange={(e) => handleUpdateItemText(item.id, e.target.value)}
                          placeholder="请输入该条反馈具体内容..."
                          className="w-full p-2.5 text-xs bg-slate-50/80 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y"
                        />
                      </div>
                    );
                  })
                )}

                {/* Card List Bottom Add Button */}
                <button
                  onClick={handleAddNewCard}
                  className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50/50 hover:bg-blue-50/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增一条反馈卡片</span>
                </button>
              </div>
            ) : (
              /* 视图模式 2：批量多行文本框 */
              <div className="space-y-2">
                <textarea
                  rows={13}
                  value={batchRawText}
                  onChange={(e) => setBatchRawText(e.target.value)}
                  placeholder="一行一条用户反馈文本..."
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white leading-relaxed"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    当前共有 {batchRawText.split('\n').filter((l) => l.trim().length > 0).length} 行
                  </span>
                  <button
                    onClick={handleSyncFromBatchRaw}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>解析并转换为独立卡片模式</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetPresets}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 恢复标准车企典型案例
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs text-slate-400 hover:text-red-600 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 清空全部条目
              </button>
            </div>

            <button
              onClick={handleStartPipeline}
              disabled={processing || feedbackItems.length === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              {processing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>智能清洗与分类诊断中...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>启动智能过滤与多维分类流水线 ({feedbackItems.length} 条)</span>
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
              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  stepStage >= 1
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      1
                    </span>
                    格式清洗与手机机型特征提取
                  </span>
                  {stepStage > 1 && <CheckCircle className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  去除特殊emoji噪点、多余空行，自动识别文本中的 iOS / 鸿蒙 / 安卓主力机型并打标
                </p>
              </div>

              {/* Step 2: Semantic Deduplication */}
              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  stepStage >= 2
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                      2
                    </span>
                    高频相似去重 (SimHash / Jaccard)
                  </span>
                  {stepStage > 2 && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  合并重复反馈，频次叠加记权，避免重复消耗大模型处理算力
                </p>
              </div>

              {/* Step 3: Spam & Meaningless Filter */}
              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  stepStage >= 3
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                      3
                    </span>
                    垃圾灌水前置过滤 (成本控制核心)
                  </span>
                  {stepStage > 3 && <CheckCircle className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  前置规则拦截"好"、"111"、纯标点、打卡刷分等无价值灌水，不调用 Agent
                </p>
              </div>

              {/* Step 4: Intelligent Classification Agent */}
              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  stepStage >= 4
                    ? 'bg-purple-50 border-purple-200 text-purple-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                      4
                    </span>
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
                    <span
                      className={`font-semibold ${
                        item.severity === '阻断' ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {item.severity}
                    </span>
                    <VehicleBadge model={item.vehicleModel} size="sm" />
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

      {/* Floating Rescue Toast Notification */}
      {rescueToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-500 flex items-center gap-2.5 animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0" />
          <span className="text-xs font-semibold">{rescueToast}</span>
        </div>
      )}

      {/* 前置拦截日志详情模块：支持可展开、误判纠偏与一键结构化输出 */}
      {filteredSpamList.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50/60 via-slate-50 to-orange-50/40 rounded-xl border border-amber-200/80 p-5 shadow-xs space-y-4">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900">
                    前置拦截日志详情
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                    {filteredSpamList.length} 条已拦截
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                    节约估算 ~{filteredSpamList.reduce((acc, s) => acc + s.tokensSaved, 0)} Tokens
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  规则前置过滤无意义输入与灌水，避免消耗大模型算力。<strong>如发现误判遗漏，可直接点击「一键结构化输出」纠偏找回！</strong>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRescueAllSpam}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="将当前拦截列表中的全部条目一键结构化并转入输出列表"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>一键全部结构化输出</span>
              </button>

              <button
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isLogExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>收起详情</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>展开详情 ({filteredSpamList.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Intercepted Items List */}
          {isLogExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-200">
              {filteredSpamList.map((spam, idx) => {
                const isExpanded = expandedLogItemIdx === idx;
                const isLikelyFalsePositive =
                  spam.text.includes('闪退') ||
                  spam.text.includes('崩溃') ||
                  spam.text.includes('连不上') ||
                  spam.text.includes('打不开') ||
                  spam.text.includes('退钱');

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-xl border transition-all p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs ${
                      isLikelyFalsePositive
                        ? 'border-rose-300 ring-1 ring-rose-200/60 bg-gradient-to-br from-white to-rose-50/20'
                        : 'border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      {/* Top Header of item */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-md">
                            拦截规则: {spam.reason}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ~{spam.tokensSaved} Tokens
                        </span>
                      </div>

                      {/* Content block */}
                      <div
                        onClick={() => setExpandedLogItemIdx(isExpanded ? null : idx)}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-100 cursor-pointer transition-colors"
                      >
                        <p className="text-xs text-slate-800 font-medium leading-relaxed">
                          "{spam.text}"
                        </p>
                      </div>

                      {isLikelyFalsePositive && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>提示：该条疑似包含车主实质痛点，建议一键结构化找回</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar: 一键结构化输出 / 编辑补充后输出 */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-400">
                        {isExpanded ? '点击文本可折叠' : '人工审核纠偏'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditSpam(spam)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                          title="修改文本或补充场景后转入"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>补充描述</span>
                        </button>

                        <button
                          onClick={() => handleSingleRescueAndStructure(spam)}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="针对误判内容：直接运行智能分类模型并输出至结果列表"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>一键结构化输出</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 补充描述并结构化输出弹窗 */}
      {editingSpam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-100 text-amber-700 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  人工纠偏：补充描述并一键结构化
                </h4>
              </div>
              <button
                onClick={() => setEditingSpam(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              原拦截原因：<span className="text-red-600 font-semibold">{editingSpam.reason}</span>。您可以在下方完善车主原声或补充具体车辆行为，系统将自动调用大模型多维诊断完成打标：
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                纠偏后反馈原声文本
              </label>
              <textarea
                rows={3}
                value={editSpamText}
                onChange={(e) => setEditSpamText(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PM 纠偏原因 / 补充备注
              </label>
              <input
                type="text"
                value={editSpamNote}
                onChange={(e) => setEditSpamNote(e.target.value)}
                placeholder="例如：车主在社群补充了具体故障症状，属于车机死机问题..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingSpam(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmEditSpam}
                disabled={!editSpamText.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>确认并一键结构化输出</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量追加文本弹窗 */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">批量粘贴追加反馈条目</h4>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              请在此处粘贴多行文本，每行将自动创建为一个独立的反馈卡片：
            </p>
            <textarea
              rows={8}
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="粘贴多行文本..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-mono"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBatchPaste}
                disabled={!pasteInput.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                确认追加到卡片清单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
