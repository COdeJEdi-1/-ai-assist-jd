import type { CampaignReport, Candidate, DashboardStats } from '../types';

export interface AggregatedAnalytics {
  totalCampaigns: number;
  totalCandidates: number;
  completedCalls: number;
  failedCalls: number;
  qualifiedCandidates: number;
  activeCalls: number;
  pendingCalls: number;
  completionRate: number;
  qualificationRate: number;
  failureRate: number;
  campaignTrend: { label: string; calls: number }[];
  outcomeBreakdown: { name: string; value: number; color: string }[];
  recentCampaigns: {
    id: string;
    name: string;
    date: string;
    candidates: number;
    completed: number;
    failed: number;
    qualified: number;
    progress: number;
  }[];
  hasData: boolean;
}

const OUTCOME_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Failed: '#DC2626',
  Retry: '#F59E0B',
  'In Progress': '#2563EB',
  Queued: '#5C6166',
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

export function buildAggregatedAnalytics(
  reports: CampaignReport[],
  dashboardStats: DashboardStats,
  hasActiveCampaign: boolean,
  isCampaignRunning: boolean,
  liveCandidates: Candidate[],
): AggregatedAnalytics {
  const reportTotals = reports.reduce(
    (acc, report) => ({
      totalCandidates: acc.totalCandidates + report.summary.totalCandidates,
      completedCalls: acc.completedCalls + report.summary.completedCalls,
      failedCalls: acc.failedCalls + report.summary.failedCalls,
      qualifiedCandidates: acc.qualifiedCandidates + report.summary.qualifiedCandidates,
    }),
    {
      totalCandidates: 0,
      completedCalls: 0,
      failedCalls: 0,
      qualifiedCandidates: 0,
    },
  );

  const includeLiveCampaign = hasActiveCampaign && isCampaignRunning;

  const activeCalls = includeLiveCampaign ? dashboardStats.activeCalls : 0;
  const pendingCalls = includeLiveCampaign ? dashboardStats.pendingCalls : 0;

  let totalCandidates = reportTotals.totalCandidates;
  let completedCalls = reportTotals.completedCalls;
  let failedCalls = reportTotals.failedCalls;
  let qualifiedCandidates = reportTotals.qualifiedCandidates;

  if (includeLiveCampaign) {
    totalCandidates += dashboardStats.totalCandidates;
    completedCalls += dashboardStats.completedCalls;
    failedCalls += dashboardStats.failedCalls;
    qualifiedCandidates += dashboardStats.qualifiedCandidates;
  }

  const statusCounts: Record<string, number> = {
    Completed: 0,
    Failed: 0,
    Retry: 0,
    'In Progress': 0,
    Queued: 0,
  };

  reports.forEach((report) => {
    report.candidateRows.forEach((row) => {
      if (row.status === 'completed') statusCounts.Completed += 1;
      else if (row.status === 'failed') statusCounts.Failed += 1;
      else if (row.status === 'retry') statusCounts.Retry += 1;
      else if (row.status === 'calling') statusCounts['In Progress'] += 1;
      else if (row.status === 'queued') statusCounts.Queued += 1;
    });
  });

  if (includeLiveCampaign) {
    liveCandidates.forEach((candidate) => {
      if (candidate.dispatchFailed) {
        statusCounts.Failed += 1;
        return;
      }
      if (candidate.status === 'completed') statusCounts.Completed += 1;
      else if (candidate.status === 'failed') statusCounts.Failed += 1;
      else if (candidate.status === 'retry') statusCounts.Retry += 1;
      else if (candidate.status === 'calling') statusCounts['In Progress'] += 1;
      else if (candidate.status === 'queued') statusCounts.Queued += 1;
    });
  }

  const outcomeBreakdown = Object.entries(statusCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: OUTCOME_COLORS[name] ?? '#5C6166',
    }));

  const campaignTrend = reports.slice(0, 8).map((report) => ({
    label: truncateLabel(report.campaignName),
    calls: report.summary.completedCalls + report.summary.failedCalls,
  }));

  if (includeLiveCampaign && dashboardStats.totalCandidates > 0) {
    campaignTrend.push({
      label: 'Active',
      calls: dashboardStats.completedCalls + dashboardStats.failedCalls,
    });
  }

  const recentCampaigns = reports.slice(0, 5).map((report) => ({
    id: report.campaignId,
    name: report.campaignName,
    date: report.date,
    candidates: report.summary.totalCandidates,
    completed: report.summary.completedCalls,
    failed: report.summary.failedCalls,
    qualified: report.summary.qualifiedCandidates,
    progress: report.summary.campaignProgress,
  }));

  const hasData =
    reports.length > 0 ||
    includeLiveCampaign ||
    totalCandidates > 0 ||
    outcomeBreakdown.length > 0;

  return {
    totalCampaigns: reports.length + (includeLiveCampaign ? 1 : 0),
    totalCandidates,
    completedCalls,
    failedCalls,
    qualifiedCandidates,
    activeCalls,
    pendingCalls,
    completionRate: pct(completedCalls, totalCandidates),
    qualificationRate: pct(qualifiedCandidates, completedCalls),
    failureRate: pct(failedCalls, totalCandidates),
    campaignTrend,
    outcomeBreakdown,
    recentCampaigns,
    hasData,
  };
}
