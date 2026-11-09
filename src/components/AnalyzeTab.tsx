import React, { useState, useMemo, useRef } from 'react';
import {
  ClientProfile,
  ProcessedAdRow,
  GoalSummary,
  CampaignSummary,
  AdSetSummary,
  AutomaticFlag,
  ThresholdSettings,
  ManualBusinessResults,
  AIAnalysisOutput,
  ColumnStatus,
  ChatMessage,
  ComparisonMetric,
} from '../types';
import { parseMetaAdsFile } from '../utils/parser';
import {
  calculateAggregations,
  detectAutomaticFlags,
  comparePeriods,
  calculateBusinessMetrics,
} from '../utils/calculator';
import { Storage } from '../utils/storage';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowUpDown,
  Send,
  Save,
  Check,
  RotateCcw,
  Plus,
  RefreshCw,
  Search,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';

interface Props {
  selectedClient: ClientProfile | null;
  thresholds: ThresholdSettings;
  onOpenSettings: () => void;
  onNavigateToClients: () => void;
}

type TableTab = 'campaigns' | 'adsets' | 'ads';

export const AnalyzeTab: React.FC<Props> = ({
  selectedClient,
  thresholds,
  onOpenSettings,
  onNavigateToClients,
}) => {
  // File state
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentRows, setCurrentRows] = useState<ProcessedAdRow[]>([]);
  const [columnStatuses, setColumnStatuses] = useState<ColumnStatus[]>([]);
  const [currencyDetected, setCurrencyDetected] = useState<string>('THB');
  const [excludedRowsCount, setExcludedRowsCount] = useState<number>(0);
  const [showColumnsModal, setShowColumnsModal] = useState(false);

  // Previous file state (optional for comparison)
  const [previousFile, setPreviousFile] = useState<File | null>(null);
  const [previousRows, setPreviousRows] = useState<ProcessedAdRow[]>([]);

  // Manual Inputs
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualInputs, setManualInputs] = useState<ManualBusinessResults>({
    uniqueReach: null,
    resultLabel: 'Real Customers / Orders',
    resultCount: null,
    revenue: null,
  });

  // Campaign goal overrides
  const [campaignGoalOverrides, setCampaignGoalOverrides] = useState<Record<string, string>>({});

  // Loading & error states
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // AI Analysis Output (all editable)
  const [analysis, setAnalysis] = useState<AIAnalysisOutput | null>(null);
  const [approvedLessonsSet, setApprovedLessonsSet] = useState<Set<number>>(new Set());

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Table state
  const [activeTableTab, setActiveTableTab] = useState<TableTab>('campaigns');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('totalSpend');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Flag filter
  const [flagSeverityFilter, setFlagSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const curr = selectedClient?.currency || currencyDetected || 'THB';

  // Calculations for current period
  const { campaigns, adSets, goalSummaries, effectiveRows } = useMemo(() => {
    if (!currentRows.length) {
      return { campaigns: [], adSets: [], goalSummaries: {}, effectiveRows: [] };
    }
    return calculateAggregations(currentRows, campaignGoalOverrides);
  }, [currentRows, campaignGoalOverrides]);

  // Calculations for previous period
  const previousData = useMemo(() => {
    if (!previousRows.length) return null;
    return calculateAggregations(previousRows);
  }, [previousRows]);

  // Comparisons
  const periodComparisons = useMemo(() => {
    if (!previousData || !Object.keys(goalSummaries).length) return null;
    return comparePeriods(goalSummaries, previousData.goalSummaries);
  }, [goalSummaries, previousData]);

  // Automatic flags
  const flags = useMemo(() => {
    if (!effectiveRows.length) return [];
    return detectAutomaticFlags(
      effectiveRows,
      campaigns,
      adSets,
      goalSummaries,
      selectedClient,
      thresholds
    );
  }, [effectiveRows, campaigns, adSets, goalSummaries, selectedClient, thresholds]);

  // Real business metrics
  const businessMetrics = useMemo(() => {
    const totalSpend = campaigns.reduce((acc, c) => acc + c.totalSpend, 0);
    return calculateBusinessMetrics(totalSpend, manualInputs, curr);
  }, [campaigns, manualInputs, curr]);

  // Handlers for file upload
  const handleCurrentFileUpload = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    try {
      const result = await parseMetaAdsFile(file);
      setCurrentFile(file);
      setCurrentRows(result.rows);
      setColumnStatuses(result.columnStatuses);
      setCurrencyDetected(result.currencyDetected || 'THB');
      setExcludedRowsCount(result.excludedZeroSpendRows);
      // Reset AI analysis when new file is uploaded
      setAnalysis(null);
      setApprovedLessonsSet(new Set());
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse Meta Ads export file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePreviousFileUpload = async (file: File) => {
    try {
      const result = await parseMetaAdsFile(file);
      setPreviousFile(file);
      setPreviousRows(result.rows);
    } catch (err: any) {
      alert(`Error parsing comparison file: ${err.message}`);
    }
  };

  // Run AI Analysis
  const handleRunAnalysis = async () => {
    if (!selectedClient) {
      alert('Please select a client profile first.');
      return;
    }
    if (!effectiveRows.length) {
      alert('Please upload a Meta Ads CSV/XLSX export first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Get only Valid lessons from last 5 periods of this client
      const validLessons = Storage.getValidLessonsForAnalysis(selectedClient.id);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: selectedClient,
          goalSummaries,
          campaigns,
          flags,
          validLessons,
          manualResults: {
            ...manualInputs,
            calculated: businessMetrics,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate analysis');
      }

      setAnalysis(data);
      setApprovedLessonsSet(new Set());
    } catch (err: any) {
      setAnalysisError(err.message || 'Error running AI analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Approve a suggested lesson into long-term history
  const handleApproveLesson = (lessonText: string, index: number) => {
    if (!selectedClient) return;

    const periodName = campaigns[0]?.campaignName || 'Meta Campaign';
    Storage.addLesson({
      clientId: selectedClient.id,
      text: lessonText,
      periodOrCampaign: periodName,
      date: new Date().toISOString().split('T')[0],
      status: 'Valid',
    });

    setApprovedLessonsSet((prev) => new Set(prev).add(index));
  };

  // Chat message send
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedClient || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...chatMessages, userMessage];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const validLessons = Storage.getValidLessonsForAnalysis(selectedClient.id);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: chatMessages.slice(-6),
          context: {
            client: selectedClient,
            goalSummaries,
            campaigns,
            flags,
            validLessons,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      const botMessage: ChatMessage = {
        id: `msg_${Date.now()}_bot`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages([...newHistory, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages([...newHistory, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Sort and filter table rows
  const filteredAndSortedRows = useMemo(() => {
    let result: any[] = [];
    if (activeTableTab === 'campaigns') result = [...campaigns];
    else if (activeTableTab === 'adsets') result = [...adSets];
    else result = [...effectiveRows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const name = (item.campaignName || item.adSetName || item.adName || '').toLowerCase();
        return name.includes(q);
      });
    }

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA === valB) return 0;
      if (valA > valB) return sortAsc ? 1 : -1;
      return sortAsc ? -1 : 1;
    });

    return result;
  }, [campaigns, adSets, effectiveRows, activeTableTab, searchQuery, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (!selectedClient) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
        <Layers className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-neutral-900 mb-1">Select a Client First</h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
          Every calculation, benchmark check, and AI analysis is strictly isolated per client profile.
        </p>
        <button
          onClick={onNavigateToClients}
          className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
        >
          View Client Profiles
        </button>
      </div>
    );
  }

  const filteredFlags = flags.filter((f) => {
    if (flagSeverityFilter === 'all') return true;
    return f.severity === flagSeverityFilter;
  });

  return (
    <div className="space-y-6">
      {/* 1. Client Context Banner */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Active Client:</span>
              <span className="text-sm font-bold text-neutral-900">{selectedClient.name}</span>
              <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                {curr}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {selectedClient.businessAndProduct} · <span className="text-neutral-700 font-medium">{selectedClient.targetLocation}</span> · {selectedClient.mainGoals}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
              <span>Thresholds</span>
            </button>
            <button
              onClick={onNavigateToClients}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium transition-colors"
            >
              Switch Client
            </button>
          </div>
        </div>
      </div>

      {/* 2. File Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Primary Current File */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-neutral-900" />
              1. Current Period Meta Ads File (Required)
            </h2>
            {currentFile && (
              <button
                onClick={() => setShowColumnsModal(true)}
                className="text-[11px] text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium underline"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Columns ({columnStatuses.filter((c) => c.found).length}/{columnStatuses.length})
              </button>
            )}
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-lg p-5 cursor-pointer bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
            <Upload className="w-6 h-6 text-neutral-400 mb-2" />
            <span className="text-xs font-semibold text-neutral-800">
              {currentFile ? currentFile.name : 'Upload Meta Ads Manager Export (CSV / XLSX)'}
            </span>
            <span className="text-[11px] text-neutral-500 mt-1">
              Exported from Ads Tab with all standard columns
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCurrentFileUpload(f);
              }}
              className="hidden"
            />
          </label>

          {isParsing && (
            <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Parsing file columns and numbers...
            </p>
          )}

          {parseError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {currentFile && currentRows.length > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
              <span className="font-mono">{currentRows.length} active ads loaded</span>
              {excludedRowsCount > 0 && (
                <span className="text-neutral-500 text-[11px]">
                  ({excludedRowsCount} zero-spend rows excluded)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Optional Comparison File */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-neutral-500" />
              2. Previous Period File (Optional Comparison)
            </h2>
            {previousFile && (
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Comparison active
              </span>
            )}
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-lg p-5 cursor-pointer bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
            <Upload className="w-6 h-6 text-neutral-400 mb-2" />
            <span className="text-xs font-semibold text-neutral-800">
              {previousFile ? previousFile.name : 'Upload Prior Period (CSV / XLSX)'}
            </span>
            <span className="text-[11px] text-neutral-500 mt-1">
              Calculates % change (▲ / ▼) against previous period
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePreviousFileUpload(f);
              }}
              className="hidden"
            />
          </label>

          {previousFile && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
              <span className="font-mono">{previousRows.length} prior ads loaded</span>
              <button
                onClick={() => {
                  setPreviousFile(null);
                  setPreviousRows([]);
                }}
                className="text-[11px] text-rose-600 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Manual Inputs Section (Optional) */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <button
          onClick={() => setShowManualInputs(!showManualInputs)}
          className="w-full flex items-center justify-between text-left text-xs font-semibold text-neutral-800"
        >
          <span className="flex items-center gap-2">
            <span>Optional Manual Business Inputs</span>
            {(manualInputs.uniqueReach || manualInputs.resultCount || manualInputs.revenue) && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                Inputs active
              </span>
            )}
          </span>
          {showManualInputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showManualInputs && (
          <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-neutral-600 mb-1">
                Unique Period Reach (Deduped)
              </label>
              <input
                type="number"
                placeholder="e.g. 85000"
                value={manualInputs.uniqueReach ?? ''}
                onChange={(e) =>
                  setManualInputs({
                    ...manualInputs,
                    uniqueReach: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1">
                Real Business Result Label
              </label>
              <input
                type="text"
                placeholder="e.g. Orders, Real Customers, App Installs"
                value={manualInputs.resultLabel}
                onChange={(e) =>
                  setManualInputs({
                    ...manualInputs,
                    resultLabel: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1">
                Real Result Count
              </label>
              <input
                type="number"
                placeholder="e.g. 142"
                value={manualInputs.resultCount ?? ''}
                onChange={(e) =>
                  setManualInputs({
                    ...manualInputs,
                    resultCount: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-neutral-600 mb-1">
                Total Revenue ({curr})
              </label>
              <input
                type="number"
                placeholder="e.g. 450000"
                value={manualInputs.revenue ?? ''}
                onChange={(e) =>
                  setManualInputs({
                    ...manualInputs,
                    revenue: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            {manualInputs.resultCount && (
              <div className="sm:col-span-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-wrap gap-4 text-xs font-mono">
                <span>
                  Cost per Real {businessMetrics.label}: <strong className="text-neutral-900">{businessMetrics.costPerRealResult}</strong>
                </span>
                {businessMetrics.roas && (
                  <span>
                    ROAS: <strong className="text-neutral-900">{businessMetrics.roas}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Goal Overrides (If campaigns detected) */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Detected Campaign Goals
            </h2>
            <span className="text-[11px] text-neutral-500">
              Override detected goal per campaign if necessary
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaigns.map((camp) => (
              <div key={camp.campaignName} className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs">
                <span className="font-semibold text-neutral-900 block truncate mb-1">
                  {camp.campaignName}
                </span>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[11px] text-neutral-500">Goal:</span>
                  <select
                    value={campaignGoalOverrides[camp.campaignName] || camp.goal}
                    onChange={(e) =>
                      setCampaignGoalOverrides({
                        ...campaignGoalOverrides,
                        [camp.campaignName]: e.target.value,
                      })
                    }
                    className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium bg-white text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
                  >
                    <option value="Awareness">Awareness</option>
                    <option value="Traffic (clicks)">Traffic (clicks)</option>
                    <option value="Traffic (landing page views)">Traffic (landing page views)</option>
                    <option value="Engagement">Engagement</option>
                    <option value="Lead Generation">Lead Generation</option>
                    <option value="Messages / Leads">Messages / Leads</option>
                    <option value="Sales / Conversions">Sales / Conversions</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Goal Summaries (Separate per goal - NEVER add results of different goals together) */}
      {Object.keys(goalSummaries).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-neutral-900">
              Performance Summaries by Goal
            </h2>
            <span className="text-xs text-neutral-500">
              Calculated in JavaScript · Strictly isolated per goal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(goalSummaries).map(([goal, summary]) => {
              const comparisons = periodComparisons?.[goal] || [];
              const cprComp = comparisons.find((c) => c.metric === 'Cost per Result');
              const spendComp = comparisons.find((c) => c.metric === 'Spend');

              return (
                <div key={goal} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
                    <div>
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Goal</span>
                      <h3 className="text-base font-bold text-neutral-900">{goal}</h3>
                    </div>
                    <div className="text-right text-xs text-neutral-500 font-mono">
                      <span>{summary.campaignCount} campaigns · {summary.adCount} ads</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 text-xs font-mono">
                    <div>
                      <span className="text-neutral-500 text-[11px] block">Spend</span>
                      <span className="font-bold text-neutral-900 text-sm">
                        {curr} {summary.totalSpend.toLocaleString()}
                      </span>
                      {spendComp && (
                        <span
                          className={`text-[10px] block font-medium ${
                            spendComp.diffPercent > 0 ? 'text-neutral-600' : 'text-neutral-500'
                          }`}
                        >
                          {spendComp.diffPercent > 0 ? `▲ +${spendComp.diffPercent}%` : `▼ ${spendComp.diffPercent}%`}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">Results</span>
                      <span className="font-bold text-neutral-900 text-sm">
                        {summary.totalResults.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">Cost per Result</span>
                      <span className="font-bold text-neutral-900 text-sm">
                        {summary.costPerResult > 0 ? `${curr} ${summary.costPerResult}` : '—'}
                      </span>
                      {cprComp && (
                        <span
                          className={`text-[10px] block font-medium ${
                            cprComp.favorable ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {cprComp.diffPercent > 0 ? `▲ +${cprComp.diffPercent}%` : `▼ ${cprComp.diffPercent}%`}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">CPM</span>
                      <span className="font-bold text-neutral-900 text-sm">
                        {curr} {summary.cpm}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">Link Clicks</span>
                      <span className="text-neutral-900 font-semibold">{summary.totalLinkClicks.toLocaleString()}</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">CTR</span>
                      <span className="text-neutral-900 font-semibold">{summary.ctr}%</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">CPC</span>
                      <span className="text-neutral-900 font-semibold">
                        {summary.cpc > 0 ? `${curr} ${summary.cpc}` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 text-[11px] block">LPV Rate</span>
                      <span
                        className={`font-semibold ${
                          summary.lpvRate < thresholds.lpvRateMin ? 'text-amber-700' : 'text-neutral-900'
                        }`}
                      >
                        {summary.lpvRate}%
                      </span>
                    </div>
                  </div>

                  {/* Reach & Frequency footer */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                    <span>Reach: {summary.totalReach.toLocaleString()}</span>
                    <span>Impressions: {summary.totalImpressions.toLocaleString()}</span>
                    <span>Frequency: {summary.frequency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Automatic Flags (Code only!) */}
      {flags.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Automatic Performance Flags ({flags.length})
                </h2>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Calculated strictly in JavaScript based on Meta Ads algorithms and marketing rules.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg self-start sm:self-auto">
              {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFlagSeverityFilter(sev)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    flagSeverityFilter === sev
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-100 mt-2">
            {filteredFlags.map((flag) => {
              const isCrit = flag.severity === 'critical';
              const isWarn = flag.severity === 'warning';

              return (
                <div key={flag.id} className="py-3.5 first:pt-2 last:pb-1">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isCrit
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : isWarn
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        }`}
                      >
                        {flag.severity}
                      </span>
                      <span className="text-xs font-bold text-neutral-900">{flag.title}</span>
                      <span className="text-xs text-neutral-500">
                        {flag.entityType}: <strong className="text-neutral-800 font-medium">{flag.entityName}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Metrics snapshot */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 my-1.5 text-xs font-mono text-neutral-600 bg-neutral-50 p-2 rounded">
                    {Object.entries(flag.metrics).map(([k, v]) => (
                      <span key={k}>
                        {k}: <strong className="text-neutral-900">{String(v)}</strong>
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-neutral-700 leading-relaxed mb-1 font-sans">
                    {flag.explanation}
                  </p>

                  <p className="text-xs text-neutral-900 font-medium font-sans">
                    <span className="text-neutral-500">Action:</span> {flag.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Detailed Data Tables (Campaigns / Ad Sets / Ads) */}
      {effectiveRows.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            {/* View Tabs */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
              <button
                onClick={() => setActiveTableTab('campaigns')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTableTab === 'campaigns'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Campaigns ({campaigns.length})
              </button>
              <button
                onClick={() => setActiveTableTab('adsets')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTableTab === 'adsets'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Ad Sets ({adSets.length})
              </button>
              <button
                onClick={() => setActiveTableTab('ads')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTableTab === 'ads'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Individual Ads ({effectiveRows.length})
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/75 text-[11px] font-semibold text-neutral-600">
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    {activeTableTab === 'campaigns'
                      ? 'Campaign Name'
                      : activeTableTab === 'adsets'
                      ? 'Ad Set / Campaign'
                      : 'Ad Name / Ad Set'}
                  </th>
                  {activeTableTab === 'campaigns' && (
                    <th className="py-2.5 px-3 whitespace-nowrap">Goal</th>
                  )}
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('totalSpend')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Spend ({curr}) <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </span>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('results')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Results <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </span>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('costPerResult')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Cost / Result <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                    </span>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('impressions')}
                  >
                    Impressions
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('frequency')}
                  >
                    Freq
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('cpm')}
                  >
                    CPM
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('linkClicks')}
                  >
                    Clicks
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('ctr')}
                  >
                    CTR
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('cpc')}
                  >
                    CPC
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-900 whitespace-nowrap"
                    onClick={() => handleSort('lpvRate')}
                  >
                    LPV Rate
                  </th>
                  {activeTableTab === 'ads' && (
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Rankings (Q / E / C)
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono tabular-nums text-neutral-800">
                {filteredAndSortedRows.map((row: any, i: number) => {
                  const spend = row.totalSpend ?? row.amountSpent ?? 0;
                  const cpr = row.costPerResult ?? 0;
                  const resCount = row.results ?? 0;

                  return (
                    <tr key={row.id || `${row.campaignName}_${row.adSetName}_${i}`} className="hover:bg-neutral-50/75">
                      <td className="py-2.5 px-3 font-sans text-neutral-900 max-w-xs truncate">
                        <span className="font-semibold block truncate">
                          {activeTableTab === 'campaigns'
                            ? row.campaignName
                            : activeTableTab === 'adsets'
                            ? row.adSetName
                            : row.adName}
                        </span>
                        {activeTableTab === 'adsets' && (
                          <span className="text-[11px] text-neutral-500 block truncate">
                            {row.campaignName}
                          </span>
                        )}
                        {activeTableTab === 'ads' && (
                          <span className="text-[11px] text-neutral-500 block truncate">
                            {row.adSetName}
                          </span>
                        )}
                      </td>

                      {activeTableTab === 'campaigns' && (
                        <td className="py-2.5 px-3 font-sans text-neutral-600 text-xs whitespace-nowrap">
                          {row.goal}
                        </td>
                      )}

                      <td className="py-2.5 px-3 text-right font-semibold">
                        {spend.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {resCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {cpr > 0 ? cpr : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {(row.impressions || row.totalImpressions || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {row.frequency}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {row.cpm}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {(row.linkClicks || row.totalLinkClicks || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {row.ctr}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-600">
                        {row.cpc > 0 ? row.cpc : '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-medium ${
                          row.lpvRate < thresholds.lpvRateMin ? 'text-amber-700' : 'text-neutral-700'
                        }`}
                      >
                        {row.lpvRate}%
                      </td>

                      {activeTableTab === 'ads' && (
                        <td className="py-2.5 px-3 text-right font-sans text-[11px] text-neutral-500 whitespace-nowrap">
                          {row.qualityRanking || '-'} / {row.engagementRateRanking || '-'} / {row.conversionRateRanking || '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. AI Analysis Section (Gemini in Burmese) */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neutral-900" />
              <h2 className="text-base font-bold text-neutral-900">
                Gemini AI Analysis & Decision Insights
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Strictly grounded on your JS-calculated numbers · Explanations in natural Burmese (Myanmar Unicode) · All sections editable.
            </p>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || !effectiveRows.length}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 text-xs font-medium transition-colors shrink-0 shadow-xs"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing Campaign...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-neutral-300" />
                <span>{analysis ? 'Re-generate Analysis' : 'Generate AI Analysis'}</span>
              </>
            )}
          </button>
        </div>

        {analysisError && (
          <div className="mt-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <strong className="block font-semibold">AI Analysis Generation Failed:</strong>
              <span>{analysisError}</span>
              <p className="mt-1 text-rose-700">
                Make sure your API key is configured in the Settings &gt; Secrets panel.
              </p>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-6 space-y-4 animate-pulse">
            <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
            <div className="h-16 bg-neutral-100 rounded w-full"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
            <div className="h-16 bg-neutral-100 rounded w-full"></div>
          </div>
        )}

        {analysis && !isAnalyzing && (
          <div className="mt-6 space-y-6">
            {/* 1. အခြေအနေ အကျဉ်းချုပ် */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-900">
                ၁။ အခြေအနေ အကျဉ်းချုပ် (Spend vs Results per Goal)
              </label>
              <textarea
                rows={4}
                value={analysis.summary}
                onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-800 focus:border-neutral-900 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>

            {/* 2. အကောင်းဆုံး / အညံ့ဆုံး */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-900">
                ၂။ အကောင်းဆုံး / အညံ့ဆုံး (Compare within Same Goal)
              </label>
              <textarea
                rows={4}
                value={analysis.bestWorst}
                onChange={(e) => setAnalysis({ ...analysis, bestWorst: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-800 focus:border-neutral-900 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>

            {/* 3. ပြဿနာများ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-900">
                ၃။ ပြဿနာများ (Flags & Root Causes)
              </label>
              <textarea
                rows={4}
                value={analysis.issues}
                onChange={(e) => setAnalysis({ ...analysis, issues: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-800 focus:border-neutral-900 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>

            {/* 4. Creative သင်ခန်းစာ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-900">
                ၄။ Creative သင်ခန်းစာ (Creative Styles, CTR, CPR & Rankings)
              </label>
              <textarea
                rows={4}
                value={analysis.creativeLessons}
                onChange={(e) => setAnalysis({ ...analysis, creativeLessons: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-800 focus:border-neutral-900 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>

            {/* 5. နောက် campaign အတွက် အကြံ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-900">
                ၅။ နောက် campaign အတွက် အကြံ (Prioritized Action Items & Budget Splits)
              </label>
              <textarea
                rows={4}
                value={analysis.recommendations}
                onChange={(e) => setAnalysis({ ...analysis, recommendations: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-800 focus:border-neutral-900 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>

            {/* 6. Suggested Lessons for Marketer to Approve */}
            <div className="space-y-3 pt-3 border-t border-neutral-100">
              <div>
                <label className="block text-xs font-bold text-neutral-900">
                  ၆။ အကြံပြုသင်ခန်းစာများ (Suggested Lessons for Approval)
                </label>
                <p className="text-[11px] text-neutral-500">
                  Review and click "Approve Lesson" to store in {selectedClient.name}'s verified knowledge base for future campaigns.
                </p>
              </div>

              <div className="space-y-2">
                {analysis.suggestedLessons?.map((item, idx) => {
                  const isApproved = approvedLessonsSet.has(idx);
                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
                    >
                      <p className="text-xs text-neutral-800 leading-relaxed font-sans flex-1">
                        • {item}
                      </p>
                      {isApproved ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold px-2.5 py-1 rounded bg-emerald-50 shrink-0">
                          <Check className="w-3.5 h-3.5" /> Approved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApproveLesson(item, idx)}
                          className="flex items-center gap-1 text-[11px] font-medium text-neutral-800 border border-neutral-300 hover:border-neutral-900 px-2.5 py-1 rounded bg-white hover:bg-neutral-100 transition-colors shrink-0"
                        >
                          <Plus className="w-3 h-3" /> Approve Lesson
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. Chat Assistant Section */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="pb-3 border-b border-neutral-100 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900">Follow-up Analysis Chat</h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
              Burmese response · Real data only
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Ask Gemini any follow-up questions regarding {selectedClient.name}'s campaign results, budget allocations, or ad creatives.
          </p>
        </div>

        {/* Message history */}
        <div className="space-y-3 max-h-80 overflow-y-auto mb-4 p-2">
          {chatMessages.length === 0 ? (
            <p className="text-xs text-neutral-400 italic text-center py-4">
              Ask follow-up questions like: "ဘယ် creative ကို ဘာကြောင့် ဆက်သုံးသင့်သလဲ?" or "CPR အကျိုးအမြတ် ဘယ်လို ပိုကောင်းအောင် လုပ်မလဲ?"
            </p>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-2xl rounded-xl p-3 text-xs leading-relaxed font-sans ${
                    msg.role === 'user'
                      ? 'bg-neutral-900 text-white rounded-br-xs'
                      : 'bg-neutral-100 text-neutral-800 rounded-bl-xs'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-neutral-400 mt-1 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Ads Analyst is preparing your answer...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendChat} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask a follow-up question in Burmese or English..."
            disabled={!effectiveRows.length || isChatLoading}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-hidden disabled:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || !effectiveRows.length || isChatLoading}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      </div>

      {/* Columns Status Modal */}
      {showColumnsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-neutral-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold text-neutral-900">
                Column Mapping Report
              </h2>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-neutral-600 mt-2 mb-3">
              Meta Ads Manager columns mapped by name. Missing optional columns are gracefully skipped without breaking analysis.
            </p>

            <div className="overflow-y-auto divide-y divide-neutral-100 pr-1 text-xs">
              {columnStatuses.map((col) => (
                <div key={col.name} className="py-2 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-medium text-neutral-900">{col.name}</span>
                    {col.required && <span className="text-rose-500 ml-1 text-[11px]">*Required</span>}
                    {col.aliasMatched && col.aliasMatched !== col.name && (
                      <span className="block text-[11px] text-neutral-400 font-mono truncate">
                        Matched: "{col.aliasMatched}"
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium shrink-0 ${
                      col.found
                        ? 'bg-emerald-50 text-emerald-800'
                        : col.required
                        ? 'bg-rose-50 text-rose-800'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {col.found ? 'Found' : col.required ? 'Missing (Required)' : 'Missing (Optional)'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-3 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setShowColumnsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
