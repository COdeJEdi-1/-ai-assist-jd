import type { CampaignReport } from '../types';

/** Count completed vs failed/no-answer from OmniDimension candidate rows. */
export function computeReportOutcomeStats(report: CampaignReport): {
  completedCalls: number;
  failedCalls: number;
  totalCandidates: number;
} {
  let completedCalls = 0;
  let failedCalls = 0;

  for (const row of report.candidateRows) {
    if (row.status === 'completed') {
      completedCalls += 1;
    } else if (row.status === 'failed' || row.status === 'retry') {
      failedCalls += 1;
    } else if (row.status === 'calling' || row.status === 'queued') {
      failedCalls += 1;
    }
  }

  const accounted = completedCalls + failedCalls;
  const totalCandidates = report.candidates || report.candidateRows.length;
  if (accounted < totalCandidates) {
    failedCalls += totalCandidates - accounted;
  }

  return { completedCalls, failedCalls, totalCandidates };
}

export function syncReportSummary(report: CampaignReport): CampaignReport {
  const { completedCalls, failedCalls, totalCandidates } = computeReportOutcomeStats(report);

  return {
    ...report,
    candidates: totalCandidates,
    summary: {
      ...report.summary,
      totalCandidates,
      completedCalls,
      failedCalls,
    },
  };
}
