import React, { useState, useEffect } from 'react';
import {
  FeedbackItem,
  FilterState,
  ModuleType,
  IssueType,
  SeverityLevel,
  SentimentLevel,
  CorrectionRecord,
} from './types/feedback';
import { INITIAL_FEEDBACKS } from './data/mockFeedbacks';
import { getStoredCorrections, saveCorrections } from './utils/fewShotManager';
import { computeAllPriorityScores, calculatePriorityScore } from './utils/priorityScorer';
import { Header, TabKey } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { WorklistView } from './components/WorklistView';
import { PriorityView } from './components/PriorityView';
import { IngestionView } from './components/IngestionView';
import { JiraExportModal } from './components/JiraExportModal';

const FEEDBACKS_STORAGE_KEY = 'autofeedback_items_v1';

export default function App() {
  // Main Data States
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => {
    try {
      const stored = localStorage.getItem(FEEDBACKS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            deviceModel: item.deviceModel || 'iPhone 15 Pro',
            isEmergency: item.isEmergency ?? (item.issueType === '紧急待修复'),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load feedbacks from localStorage', e);
    }
    return INITIAL_FEEDBACKS;
  });

  const [corrections, setCorrections] = useState<CorrectionRecord[]>(() => {
    return getStoredCorrections();
  });

  // Navigation & Tabs
  const [currentTab, setCurrentTab] = useState<TabKey>('dashboard');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

  // Filters State
  const [filterState, setFilterState] = useState<FilterState>({
    module: '全部',
    issueType: '全部',
    severity: '全部',
    sentiment: '全部',
    source: '全部',
    deviceModel: '全部',
    onlyEmergency: false,
    reviewStatus: '全部',
    search: '',
    onlyPriority: false,
  });

  // Modal states
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraExportItems, setJiraExportItems] = useState<FeedbackItem[]>([]);

  // Save feedbacks on change
  useEffect(() => {
    try {
      localStorage.setItem(FEEDBACKS_STORAGE_KEY, JSON.stringify(feedbacks));
    } catch (e) {
      console.error('Failed to persist feedbacks', e);
    }
  }, [feedbacks]);

  // Save corrections on change
  useEffect(() => {
    saveCorrections(corrections);
  }, [corrections]);

  // Pending review count calculation
  const pendingReviewCount = feedbacks.filter(
    (f) => f.needsReview && f.reviewStatus === 'pending'
  ).length;

  // Filter handlers
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilterState({
      module: '全部',
      issueType: '全部',
      severity: '全部',
      sentiment: '全部',
      source: '全部',
      deviceModel: '全部',
      onlyEmergency: false,
      reviewStatus: '全部',
      search: '',
      onlyPriority: false,
    });
  };

  // Jump to Review Queue
  const handleJumpToReview = () => {
    setFilterState({
      module: '全部',
      issueType: '全部',
      severity: '全部',
      sentiment: '全部',
      source: '全部',
      deviceModel: '全部',
      onlyEmergency: false,
      reviewStatus: '待复核',
      search: '',
      onlyPriority: false,
    });
    setCurrentTab('worklist');
  };

  // Update Feedback Tags & Record PM Correction
  const handleUpdateFeedbackTags = (
    id: string,
    updates: {
      module: ModuleType;
      issueType: IssueType;
      severity: SeverityLevel;
      sentiment: SentimentLevel;
      correctionNote?: string;
    }
  ) => {
    setFeedbacks((prev) => {
      const targetIndex = prev.findIndex((f) => f.id === id);
      if (targetIndex === -1) return prev;

      const current = prev[targetIndex];
      const hasChanged =
        current.module !== updates.module ||
        current.issueType !== updates.issueType ||
        current.severity !== updates.severity ||
        current.sentiment !== updates.sentiment;

      if (!hasChanged) return prev;

      // Log correction record for few-shot prompt injection
      const correction: CorrectionRecord = {
        id: `CORR-${Date.now().toString().slice(-4)}`,
        feedbackId: current.id,
        originalText: current.originalText,
        originalTags: {
          module: current.module,
          issueType: current.issueType,
          severity: current.severity,
          sentiment: current.sentiment,
          symptomSummary: current.symptomSummary,
        },
        correctedTags: {
          module: updates.module,
          issueType: updates.issueType,
          severity: updates.severity,
          sentiment: updates.sentiment,
          symptomSummary: current.symptomSummary,
        },
        correctedAt: Date.now(),
        notes: updates.correctionNote || 'PM人工覆盖纠偏并规范化标注',
        injectedToFewShot: true,
      };

      setCorrections((cPrev) => [correction, ...cPrev]);

      // Calculate new priority score
      const newScore = calculatePriorityScore(
        updates.severity,
        1,
        updates.sentiment
      ).finalScore;

      const updatedItem: FeedbackItem = {
        ...current,
        module: updates.module,
        issueType: updates.issueType,
        severity: updates.severity,
        sentiment: updates.sentiment,
        clusterKey: `${updates.module}-${updates.issueType}`,
        reviewStatus: 'modified',
        needsReview: false,
        priorityScore: newScore,
        originalTags: current.originalTags || {
          module: current.module,
          issueType: current.issueType,
          severity: current.severity,
          sentiment: current.sentiment,
        },
        correctedAt: Date.now(),
      };

      const copy = [...prev];
      copy[targetIndex] = updatedItem;
      return computeAllPriorityScores(copy);
    });
  };

  // Confirm single review item without modification
  const handleConfirmReview = (id: string) => {
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, reviewStatus: 'confirmed', needsReview: false } : f
      )
    );
  };

  // Toggle in priority list
  const handleTogglePriority = (id: string) => {
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, inPriorityList: !f.inPriorityList } : f
      )
    );
  };

  // Batch actions
  const handleBatchConfirm = (ids: string[]) => {
    setFeedbacks((prev) =>
      prev.map((f) =>
        ids.includes(f.id)
          ? { ...f, reviewStatus: 'confirmed', needsReview: false }
          : f
      )
    );
  };

  const handleBatchTogglePriority = (ids: string[], inPriority: boolean) => {
    setFeedbacks((prev) =>
      prev.map((f) =>
        ids.includes(f.id) ? { ...f, inPriorityList: inPriority } : f
      )
    );
  };

  // Add new feedbacks from Ingestion
  const handleAddFeedbacks = (newItems: FeedbackItem[]) => {
    setFeedbacks((prev) => {
      const combined = [...newItems, ...prev];
      return computeAllPriorityScores(combined);
    });
  };

  // Reorder priority items
  const handleReorderPriorityList = (reordered: FeedbackItem[]) => {
    const reorderedMap = new Map(reordered.map((item, idx) => [item.id, idx]));

    setFeedbacks((prev) => {
      return [...prev].sort((a, b) => {
        const rankA = reorderedMap.get(a.id);
        const rankB = reorderedMap.get(b.id);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        return b.priorityScore - a.priorityScore;
      });
    });
  };

  // Toggle few shot injection
  const handleToggleFewShotInjection = (id: string) => {
    setCorrections((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, injectedToFewShot: !c.injectedToFewShot } : c
      )
    );
  };

  // Emergency count calculation
  const emergencyCount = feedbacks.filter(
    (f) => f.isEmergency || f.issueType === '紧急待修复'
  ).length;

  // Reset to factory sample
  const handleResetData = () => {
    setFeedbacks(INITIAL_FEEDBACKS);
    localStorage.removeItem(FEEDBACKS_STORAGE_KEY);
    handleResetFilters();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        pendingReviewCount={pendingReviewCount}
        emergencyCount={emergencyCount}
        onOpenIngestion={() => setCurrentTab('ingestion')}
        onResetData={handleResetData}
        onJumpToReview={handleJumpToReview}
        onJumpToEmergency={() => setCurrentTab('priority')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            feedbacks={feedbacks}
            onSelectCluster={(clusterKey) => {
              const mod = clusterKey.split('-')[0] as ModuleType;
              handleFilterChange({ module: mod });
              setCurrentTab('priority');
            }}
            onNavigateToWorklist={(filterUpdates) => {
              if (filterUpdates) handleFilterChange(filterUpdates);
              setCurrentTab('worklist');
            }}
            onJumpToReview={handleJumpToReview}
          />
        )}

        {currentTab === 'worklist' && (
          <WorklistView
            feedbacks={feedbacks}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            selectedFeedbackId={selectedFeedbackId}
            onSelectFeedback={(id) => setSelectedFeedbackId(id)}
            onUpdateFeedbackTags={handleUpdateFeedbackTags}
            onConfirmReview={handleConfirmReview}
            onTogglePriority={handleTogglePriority}
            onBatchConfirm={handleBatchConfirm}
            onBatchTogglePriority={handleBatchTogglePriority}
            corrections={corrections}
            onToggleFewShotInjection={handleToggleFewShotInjection}
            onAddCustomCorrection={(c) => setCorrections((prev) => [c, ...prev])}
          />
        )}

        {currentTab === 'priority' && (
          <PriorityView
            feedbacks={feedbacks}
            onReorderPriorityList={handleReorderPriorityList}
            onOpenJiraExport={(items) => {
              setJiraExportItems(items);
              setIsJiraModalOpen(true);
            }}
          />
        )}

        {currentTab === 'ingestion' && (
          <IngestionView
            onAddFeedbacks={handleAddFeedbacks}
            onNavigateToWorklist={() => setCurrentTab('worklist')}
          />
        )}
      </main>

      {/* Jira / Feishu Markdown Export Modal */}
      <JiraExportModal
        isOpen={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        items={jiraExportItems}
      />
    </div>
  );
}
