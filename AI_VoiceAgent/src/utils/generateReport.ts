import type { Campaign, CampaignReport, Candidate, CandidateResult, DashboardStats } from '../types';
import { normalizePhoneNumber } from './parseCandidateFile';
import { refreshReportPostCallData } from './postCallData';
import { computeReportOutcomeStats, syncReportSummary } from './reportStats';

export { computeReportOutcomeStats, syncReportSummary } from './reportStats';

const REPORTS_STORAGE_KEY = 'arvind_gcc_campaign_reports';

/** Wait after campaign completion before fetching post-call data from OmniDimension. */
export const REPORT_GENERATION_DELAY_MS = 30_000;

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').slice(0, 80);
}

function isCompletedLiveCandidate(candidate: { status: string }): boolean {
  return candidate.status === 'completed';
}

export function buildCampaignReport(
  campaign: Campaign,
  _liveCandidates: Candidate[],
  results: CandidateResult[],
  stats: DashboardStats,
  bulkCallId?: number,
): CampaignReport {
  const completedAt = new Date();

  const candidateRows = _liveCandidates
    .filter((c) => !c.dispatchFailed)
    .map((c) => ({
      name: c.name,
      phone: c.phone,
      phoneNormalized:
        c.phoneNormalized ?? normalizePhoneNumber(c.phone) ?? undefined,
      status: c.status,
      callLogId: c.callLogId,
      duration: c.duration,
      omnidimCallStatus: c.omnidimCallStatus,
    }));

  const draft: CampaignReport = {
    id: `RPT-${campaign.id}-${completedAt.getTime()}`,
    name: `${campaign.name} — Report`,
    campaignId: campaign.id,
    campaignName: campaign.name,
    bulkCallId,
    date: completedAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    completedAt: completedAt.toISOString(),
    candidates: campaign.totalCandidates,
    status: 'ready',
    summary: {
      totalCandidates: stats.totalCandidates,
      completedCalls: stats.completedCalls,
      failedCalls: stats.failedCalls,
      activeCalls: 0,
      pendingCalls: 0,
      qualifiedCandidates: stats.qualifiedCandidates,
      campaignProgress: campaign.progress,
      createdBy: campaign.createdBy,
      startedAt: campaign.startedAt,
    },
    candidateRows,
    results,
  };

  return syncReportSummary(draft);
}

export function reportToCsv(report: CampaignReport): string {
  const synced = syncReportSummary(report);
  const { completedCalls, failedCalls, totalCandidates } =
    computeReportOutcomeStats(synced);
  const lines: string[] = [];

  lines.push('Arvind GCC — Campaign Report');
  lines.push('');
  lines.push(`Campaign Name,${escapeCsv(synced.campaignName)}`);
  lines.push(`Campaign ID,${escapeCsv(synced.campaignId)}`);
  lines.push(`Report Generated,${escapeCsv(synced.date)}`);
  lines.push(`Started At,${escapeCsv(synced.summary.startedAt)}`);
  lines.push(`Created By,${escapeCsv(synced.summary.createdBy)}`);
  lines.push('');
  lines.push('Summary');
  lines.push(`Total Candidates,${totalCandidates}`);
  lines.push(`Completed Calls,${completedCalls}`);
  lines.push(`Failed Calls,${failedCalls}`);
  lines.push(`Campaign Progress,${synced.summary.campaignProgress}%`);
  lines.push('');
  lines.push('Live Candidate Status');
  lines.push('Name,Phone,Status,Duration');
  synced.candidateRows.forEach((row) => {
    lines.push(
      [
        escapeCsv(row.name),
        escapeCsv(row.phone),
        escapeCsv(row.omnidimCallStatus ?? row.status),
        escapeCsv(row.duration ?? '—'),
      ].join(','),
    );
  });
  lines.push('');
  lines.push('Candidate Results (Post-Call Data from OmniDimension)');
  lines.push(
    [
      'Name',
      'Phone',
      'Call Duration',
      'Sentiment',
      'Experience (Years)',
      'Current CTC',
      'Expected CTC',
      'Current Job',
      'Current Job Roles & Responsibilities',
      'Job Change',
      'Job Change Reason',
      'Family Background',
      'Current Location',
      'Willing to Relocate',
      'Preferred Locations',
      'Notice Period',
      'Joining Time',
      'Joining Status',
      'Screening Result',
      'Status',
      'Call Summary',
    ].join(','),
  );
  report.results.filter(isCompletedLiveCandidate).forEach((row) => {
    lines.push(
      [
        escapeCsv(row.name),
        escapeCsv(row.phone ?? ''),
        escapeCsv(row.callDuration ?? ''),
        escapeCsv(row.sentiment ?? ''),
        escapeCsv(row.experienceYears),
        escapeCsv(row.currentCtc),
        escapeCsv(row.expectedCtc),
        escapeCsv(row.currentJob),
        escapeCsv(row.currentJobRolesResponsibility),
        escapeCsv(row.jobChange),
        escapeCsv(row.jobChangeReason),
        escapeCsv(row.familyBackground),
        escapeCsv(row.currentLocation),
        escapeCsv(row.willingToRelocate),
        escapeCsv(row.preferredLocations),
        escapeCsv(row.noticePeriod),
        escapeCsv(row.joiningTime),
        escapeCsv(row.joiningStatus),
        escapeCsv(row.result),
        escapeCsv(row.status),
        escapeCsv(row.callSummary ?? ''),
      ].join(','),
    );
  });

  return lines.join('\n');
}

export function downloadCampaignReportCsv(report: CampaignReport): void {
  const csv = reportToCsv(report);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(report.campaignName)}-report.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadCampaignReport(report: CampaignReport): Promise<CampaignReport> {
  if (report.status !== 'ready') {
    throw new Error('Report is still processing. Please wait until it is ready to download.');
  }

  const refreshed = syncReportSummary(await refreshReportPostCallData(report));

  const stored = loadStoredReports();
  const next = stored.some((item) => item.id === refreshed.id)
    ? stored.map((item) => (item.id === refreshed.id ? refreshed : item))
    : [refreshed, ...stored];
  saveStoredReports(next);

  downloadCampaignReportCsv(refreshed);
  return refreshed;
}

export function loadStoredReports(): CampaignReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CampaignReport[];
  } catch {
    return [];
  }
}

export function saveStoredReports(reports: CampaignReport[]): void {
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error('Failed to save campaign reports to localStorage:', err);
  }
}
