import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  dispatchCampaignCalls,
  fetchCampaignCallLogs,
  buildCampaignLogScope,
  resolveDurationFromOmnidimLog,
  resolveStatusFromOmnidimLog,
  resolveLatestLogForCandidate,
  matchCampaignCandidatesToLogs,
  resolveOmnidimStatusLabel,
  type CampaignLogScope,
  type DispatchProgressCallback,
} from '../services/omnidimension';
import type {
  Campaign,
  Candidate,
  CandidateResult,
  CallStatus,
  DashboardStats,
  UploadedFile,
  ParsedCandidate,
  CampaignReport,
} from '../types';
import {
  buildCampaignReport,
  loadStoredReports,
  REPORT_GENERATION_DELAY_MS,
  saveStoredReports,
} from '../utils/generateReport';
import { syncReportSummary } from '../utils/reportStats';
import { buildCampaignResultsWithRetry } from '../utils/postCallData';

export interface StartCampaignResult {
  success: boolean;
  dispatched: number;
  failed: number;
  error?: string;
  errors?: string[];
}

export interface PendingReportGeneration {
  campaignId: string;
  campaignName: string;
  readyAt: number;
}

export interface ReportReadyAlert {
  reportId: string;
  campaignName: string;
}

interface AppContextValue {
  dashboardStats: DashboardStats;
  campaign: Campaign;
  liveCandidates: Candidate[];
  candidateResults: CandidateResult[];
  campaignReports: CampaignReport[];
  pendingReport: PendingReportGeneration | null;
  pendingReportSeconds: number;
  reportReadyAlert: ReportReadyAlert | null;
  uploadedFile: UploadedFile | null;
  isCampaignRunning: boolean;
  agentRunningSeconds: number;
  hasActiveCampaign: boolean;
  setUploadedFile: (file: UploadedFile | null) => void;
  reloadReports: () => void;
  dismissReportReadyAlert: () => void;
  startCampaign: (
    name: string,
    onProgress?: DispatchProgressCallback,
  ) => Promise<StartCampaignResult>;
}

const AppContext = createContext<AppContextValue | null>(null);

const emptyDashboardStats: DashboardStats = {
  totalCandidates: 0,
  completedCalls: 0,
  activeCalls: 0,
  pendingCalls: 0,
  failedCalls: 0,
  qualifiedCandidates: 0,
};

const idleCampaign: Campaign = {
  id: '—',
  name: 'No Active Campaign',
  status: 'draft',
  createdBy: '—',
  startedAt: '—',
  totalCandidates: 0,
  completed: 0,
  running: 0,
  queued: 0,
  retries: 0,
  failed: 0,
  averageDuration: '—',
  progress: 0,
};

export function formatAgentTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function finalizeCampaignReport(
  candidates: Candidate[],
  campaign: Campaign,
  stats: DashboardStats,
  bulkCallId: number | undefined,
  candidateMeta: Map<string, ParsedCandidate>,
  logScope: CampaignLogScope,
): Promise<CampaignReport> {
  const results = await buildCampaignResultsWithRetry(
    candidates,
    logScope,
    candidateMeta,
  );
  const qualifiedCandidates = results.filter((row) => row.result === 'Qualified').length;

  return buildCampaignReport(
    {
      ...campaign,
      completed: stats.completedCalls,
      running: 0,
      queued: 0,
      progress: 100,
      status: 'completed',
    },
    candidates,
    results,
    {
      ...stats,
      qualifiedCandidates,
    },
    bulkCallId,
  );
}

function countByStatus(candidates: Candidate[]) {
  return {
    running: candidates.filter((c) => c.status === 'calling').length,
    queued: candidates.filter((c) => c.status === 'queued').length,
    completed: candidates.filter((c) => c.status === 'completed').length,
    failed: candidates.filter((c) => c.status === 'failed' && !c.dispatchFailed).length,
    retry: candidates.filter((c) => c.status === 'retry').length,
    dispatchFailed: candidates.filter((c) => c.dispatchFailed).length,
  };
}

interface PollUpdateResult {
  next: Candidate[];
  counts: ReturnType<typeof countByStatus>;
  progress: number;
  allDone: boolean;
}

function isTerminalCallStatus(status: CallStatus): boolean {
  return status === 'completed' || status === 'retry' || status === 'failed';
}

function applyLiveCandidatePollUpdate(
  prev: Candidate[],
  logs: Awaited<ReturnType<typeof fetchCampaignCallLogs>>,
  options: {
    logScope: CampaignLogScope;
    completedIds: Set<string>;
  },
): PollUpdateResult {
  const logsByPhone = matchCampaignCandidatesToLogs(prev, logs, options.logScope);

  const next = prev.map((candidate) => {
    if (candidate.dispatchFailed) return candidate;

    const log = resolveLatestLogForCandidate(candidate, logsByPhone);

    if (!log) {
      return {
        ...candidate,
        status: 'calling' as CallStatus,
        duration: '—',
        callLogId: undefined,
        omnidimCallStatus: 'Not Initiated',
      };
    }

    const mappedStatus = resolveStatusFromOmnidimLog(log);
    const duration = resolveDurationFromOmnidimLog(log);

    if (!isTerminalCallStatus(mappedStatus)) {
      return {
        ...candidate,
        status: 'calling' as CallStatus,
        duration,
        callLogId: log.id,
        omnidimCallStatus: resolveOmnidimStatusLabel(log) || 'Calling',
      };
    }

    if (mappedStatus === 'completed') {
      options.completedIds.add(candidate.id);
    }

    return {
      ...candidate,
      status: mappedStatus,
      duration,
      callLogId: log.id,
      omnidimCallStatus: resolveOmnidimStatusLabel(log),
    };
  });

  const counts = countByStatus(next);
  const dialable = next.filter((c) => !c.dispatchFailed).length;
  const finished = counts.completed + counts.failed + counts.retry;
  const progress = dialable > 0 ? Math.round((finished / dialable) * 100) : 0;
  const allDone =
    dialable > 0 &&
    next.filter((c) => !c.dispatchFailed).every((c) => isTerminalCallStatus(c.status));

  return { next, counts, progress, allDone };
}

function buildLiveCandidateList(
  callable: ParsedCandidate[],
  dispatchById: Map<string, { success: boolean; requestId?: number }>,
): Candidate[] {
  return callable.map((c) => {
    const dispatch = dispatchById.get(c.id);

    if (!dispatch?.success) {
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        phoneNormalized: c.phoneNormalized ?? undefined,
        status: 'failed' as CallStatus,
        duration: '00:00',
        retry: 0,
        dispatchFailed: true,
      };
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      phoneNormalized: c.phoneNormalized ?? undefined,
      status: 'calling' as CallStatus,
      duration: '—',
      retry: 0,
      requestId: dispatch.requestId,
      dispatchFailed: false,
      omnidimCallStatus: 'Not Initiated',
    };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(emptyDashboardStats);
  const [campaign, setCampaign] = useState<Campaign>(idleCampaign);
  const [liveCandidates, setLiveCandidates] = useState<Candidate[]>([]);
  const [candidateResults, setCandidateResults] = useState<CandidateResult[]>([]);
  const [uploadedFile, setUploadedFileState] = useState<UploadedFile | null>(null);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);
  const [agentRunningSeconds, setAgentRunningSeconds] = useState(0);
  const [hasActiveCampaign, setHasActiveCampaign] = useState(false);
  const [campaignReports, setCampaignReports] = useState<CampaignReport[]>(() => loadStoredReports());
  const [pendingReport, setPendingReport] = useState<PendingReportGeneration | null>(null);
  const [pendingReportSeconds, setPendingReportSeconds] = useState(0);
  const [reportReadyAlert, setReportReadyAlert] = useState<ReportReadyAlert | null>(null);

  const candidateMetaRef = useRef<Map<string, ParsedCandidate>>(new Map());
  const bulkCallIdRef = useRef<number | undefined>(undefined);
  const campaignLogScopeRef = useRef<CampaignLogScope>({});
  const completedIdsRef = useRef<Set<string>>(new Set());
  const reportGeneratedRef = useRef<string | null>(null);
  const pendingReportDataRef = useRef<{
    candidates: Candidate[];
    campaign: Campaign;
    stats: DashboardStats;
    bulkCallId?: number;
    candidateMeta: Map<string, ParsedCandidate>;
    logScope: CampaignLogScope;
  } | null>(null);
  const campaignRef = useRef(campaign);
  const candidateResultsRef = useRef(candidateResults);
  const dashboardStatsRef = useRef(dashboardStats);
  const liveCandidatesRef = useRef(liveCandidates);

  useEffect(() => {
    campaignRef.current = campaign;
  }, [campaign]);

  useEffect(() => {
    candidateResultsRef.current = candidateResults;
  }, [candidateResults]);

  useEffect(() => {
    dashboardStatsRef.current = dashboardStats;
  }, [dashboardStats]);

  useEffect(() => {
    liveCandidatesRef.current = liveCandidates;
  }, [liveCandidates]);

  useEffect(() => {
    if (!pendingReport) {
      setPendingReportSeconds(0);
      return;
    }

    const tick = () => {
      setPendingReportSeconds(
        Math.max(0, Math.ceil((pendingReport.readyAt - Date.now()) / 1000)),
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pendingReport]);

  useEffect(() => {
    const stored = loadStoredReports();
    if (stored.length > 0) {
      setCampaignReports(stored.map(syncReportSummary));
    }
  }, []);

  const saveReport = useCallback((report: CampaignReport) => {
    const stored = loadStoredReports();
    const synced = syncReportSummary(report);
    const filtered = stored.filter((r) => r.campaignId !== synced.campaignId);
    const next = [synced, ...filtered];
    saveStoredReports(next);
    setCampaignReports(next);
  }, []);

  const reloadReports = useCallback(() => {
    setCampaignReports(loadStoredReports().map(syncReportSummary));
  }, []);

  const dismissReportReadyAlert = useCallback(() => {
    setReportReadyAlert(null);
  }, []);

  const setUploadedFile = useCallback((file: UploadedFile | null) => {
    setUploadedFileState(file);
  }, []);

  const startCampaign = useCallback(
    async (
      name: string,
      onProgress?: DispatchProgressCallback,
    ): Promise<StartCampaignResult> => {
      const callable =
        uploadedFile?.candidates.filter((c) => c.phoneNormalized) ?? [];

      if (callable.length === 0) {
        return {
          success: false,
          dispatched: 0,
          failed: 0,
          error: 'No candidates with valid phone numbers to call.',
        };
      }

      const { results, dispatched, failed, bulkCallId } =
        await dispatchCampaignCalls(callable, name, onProgress);

      bulkCallIdRef.current = bulkCallId;
      campaignLogScopeRef.current = buildCampaignLogScope({
        bulkCallId,
        candidatePhones: callable.map((c) => c.phoneNormalized ?? c.phone),
        startedAfterMs: Date.now(),
      });
      completedIdsRef.current = new Set();
      reportGeneratedRef.current = null;
      pendingReportDataRef.current = null;
      setPendingReport(null);
      setReportReadyAlert(null);

      if (dispatched === 0) {
        const errors = results.map((r) => r.error).filter(Boolean) as string[];
        return {
          success: false,
          dispatched: 0,
          failed,
          error: errors[0] ?? 'All call dispatches failed. Check OmniDimension API credentials.',
          errors,
        };
      }

      const dispatchById = new Map(results.map((r) => [r.candidateId, r]));
      candidateMetaRef.current = new Map(callable.map((c) => [c.id, c]));

      const total = callable.length;
      const dispatchFailedCount = results.filter((r) => !r.success).length;

      const now = new Date();
      const startedAt = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const liveList = buildLiveCandidateList(callable, dispatchById);

      const counts = countByStatus(liveList);

      setCampaign({
        id: bulkCallId
          ? `CMP-BULK-${bulkCallId}`
          : `CMP-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`,
        name,
        status: 'running',
        createdBy: 'HR Admin — Manav Raval',
        startedAt,
        totalCandidates: total,
        completed: counts.completed,
        running: counts.running,
        queued: counts.queued,
        retries: 0,
        failed: 0,
        averageDuration: '0m 00s',
        progress: 0,
      });

      setLiveCandidates(liveList);
      liveCandidatesRef.current = liveList;
      setCandidateResults([]);
      setIsCampaignRunning(true);
      setHasActiveCampaign(true);
      setAgentRunningSeconds(0);

      setDashboardStats({
        totalCandidates: total,
        completedCalls: counts.completed,
        activeCalls: counts.running,
        pendingCalls: counts.queued,
        failedCalls: dispatchFailedCount,
        qualifiedCandidates: 0,
      });

      return {
        success: true,
        dispatched,
        failed,
        errors: results.filter((r) => r.error).map((r) => `${r.candidateName}: ${r.error}`),
      };
    },
    [uploadedFile],
  );

  useEffect(() => {
    if (!isCampaignRunning || !hasActiveCampaign) return;

    const pollAndUpdate = async () => {
      setAgentRunningSeconds((s) => s + 5);

      const logs = await fetchCampaignCallLogs(campaignLogScopeRef.current);
      const update = applyLiveCandidatePollUpdate(liveCandidatesRef.current, logs, {
        logScope: campaignLogScopeRef.current,
        completedIds: completedIdsRef.current,
      });

      liveCandidatesRef.current = update.next;
      setLiveCandidates(update.next);

      setCampaign((c) => ({
        ...c,
        completed: update.counts.completed,
        running: update.counts.running,
        queued: update.counts.queued,
        retries: update.counts.retry,
        failed: update.counts.failed,
        progress: update.progress,
        status: update.allDone ? 'completed' : 'running',
      }));

      setDashboardStats({
        totalCandidates: update.next.length,
        completedCalls: update.counts.completed,
        activeCalls: update.counts.running,
        pendingCalls: update.counts.queued,
        failedCalls:
          update.counts.dispatchFailed + update.counts.failed + update.counts.retry,
        qualifiedCandidates: update.counts.completed,
      });

      if (update.allDone) {
        setIsCampaignRunning(false);
        if (reportGeneratedRef.current !== campaignRef.current.id) {
          reportGeneratedRef.current = campaignRef.current.id;
          const statsSnapshot: DashboardStats = {
            totalCandidates: update.next.length,
            completedCalls: update.counts.completed,
            activeCalls: update.counts.running,
            pendingCalls: update.counts.queued,
            failedCalls:
              update.counts.dispatchFailed + update.counts.failed + update.counts.retry,
            qualifiedCandidates: update.counts.completed,
          };

          pendingReportDataRef.current = {
            candidates: update.next,
            campaign: {
              ...campaignRef.current,
              completed: update.counts.completed,
              running: 0,
              queued: 0,
              progress: 100,
              status: 'completed',
            },
            stats: statsSnapshot,
            bulkCallId: bulkCallIdRef.current,
            candidateMeta: candidateMetaRef.current,
            logScope: campaignLogScopeRef.current,
          };

          setPendingReport({
            campaignId: campaignRef.current.id,
            campaignName: campaignRef.current.name,
            readyAt: Date.now() + REPORT_GENERATION_DELAY_MS,
          });
        }
      }
    };

    pollAndUpdate();
    const interval = setInterval(pollAndUpdate, 5000);
    return () => clearInterval(interval);
  }, [isCampaignRunning, hasActiveCampaign]);

  useEffect(() => {
    if (!pendingReport) return;

    const delayMs = Math.max(0, pendingReport.readyAt - Date.now());
    const timer = setTimeout(async () => {
      const data = pendingReportDataRef.current;
      if (!data || data.campaign.id !== pendingReport.campaignId) {
        setPendingReport(null);
        return;
      }

      try {
        const report = await finalizeCampaignReport(
          data.candidates,
          data.campaign,
          data.stats,
          data.bulkCallId,
          data.candidateMeta,
          data.logScope,
        );
        saveReport(report);
        setReportReadyAlert({
          reportId: report.id,
          campaignName: report.campaignName,
        });
        setCandidateResults(report.results);
        candidateResultsRef.current = report.results;
        setDashboardStats((prev) => ({
          ...prev,
          qualifiedCandidates: report.summary.qualifiedCandidates,
        }));
      } catch (err) {
        console.error('Failed to build campaign report with post-call data:', err);
        const fallbackReport = buildCampaignReport(
          data.campaign,
          data.candidates,
          [],
          data.stats,
          data.bulkCallId,
        );
        saveReport(fallbackReport);
        setReportReadyAlert({
          reportId: fallbackReport.id,
          campaignName: fallbackReport.campaignName,
        });
      } finally {
        pendingReportDataRef.current = null;
        setPendingReport(null);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [pendingReport, saveReport]);

  const value = useMemo(
    () => ({
      dashboardStats,
      campaign,
      liveCandidates,
      candidateResults,
      campaignReports,
      pendingReport,
      pendingReportSeconds,
      reportReadyAlert,
      uploadedFile,
      isCampaignRunning,
      agentRunningSeconds,
      hasActiveCampaign,
      setUploadedFile,
      reloadReports,
      dismissReportReadyAlert,
      startCampaign,
    }),
    [
      dashboardStats,
      campaign,
      liveCandidates,
      candidateResults,
      campaignReports,
      pendingReport,
      pendingReportSeconds,
      reportReadyAlert,
      uploadedFile,
      isCampaignRunning,
      agentRunningSeconds,
      hasActiveCampaign,
      setUploadedFile,
      reloadReports,
      dismissReportReadyAlert,
      startCampaign,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
