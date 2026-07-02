import type { Candidate, CandidateResult, CampaignReport, ParsedCandidate } from '../types';
import { normalizePhoneNumber } from './parseCandidateFile';
import {
  fetchCallLogDetail,
  fetchCampaignCallLogs,
  buildCampaignLogScope,
  isSuccessfulCompletedCall,
  mergeCallLogs,
  resolveLatestLogForCandidate,
  matchCampaignCandidatesToLogs,
  resolveStatusFromOmnidimLog,
  resolveDurationFromOmnidimLog,
  resolveOmnidimStatusLabel,
  type CampaignLogScope,
  type OmnidimCallLog,
} from '../services/omnidimension';
import { syncReportSummary } from './reportStats';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const str = String(value).trim();
  if (!str) return true;
  const lower = str.toLowerCase();
  return lower === 'not provided' || lower === 'n/a' || lower === 'na' || lower === 'none';
}

function tryParseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Merge extracted variables from all known OmniDimension response shapes. */
export function resolveExtractedVariables(log: OmnidimCallLog): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  const add = (obj?: Record<string, unknown>) => {
    if (!obj) return;
    Object.entries(obj).forEach(([key, value]) => {
      if (!isMissingValue(value)) merged[key] = value;
    });
  };

  add(log.extracted_variables);
  add(log.call_report?.extracted_variables);

  const webhooks = log.post_call_actions?.call_recording_webhook_ids ?? [];
  for (const webhook of webhooks) {
    const payload = tryParseJson(webhook.payload);
    if (!payload) continue;

    const report = payload.call_report as Record<string, unknown> | undefined;
    if (report?.extracted_variables && typeof report.extracted_variables === 'object') {
      add(report.extracted_variables as Record<string, unknown>);
    }

    add(payload.extracted_variables as Record<string, unknown> | undefined);
  }

  return merged;
}

export function pickExtractedValue(
  vars: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  if (!vars) return null;

  const entries = Object.entries(vars).map(([key, value]) => ({
    key: normalizeKey(key),
    value,
  }));

  for (const searchKey of keys) {
    const normalizedSearch = normalizeKey(searchKey);
    const exact = entries.find(({ key }) => key === normalizedSearch);
    if (exact && !isMissingValue(exact.value)) {
      return String(exact.value).trim();
    }
  }

  for (const searchKey of keys) {
    const normalizedSearch = normalizeKey(searchKey);
    const partial = entries.find(({ key }) => key.includes(normalizedSearch));
    if (partial && !isMissingValue(partial.value)) {
      return String(partial.value).trim();
    }
  }

  return null;
}

function pickFromExcel(raw: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const match = Object.entries(raw).find(([k]) =>
      k.toLowerCase().includes(key.toLowerCase()),
    );
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

export function mapQualificationResult(raw: string | null): string {
  if (!raw) return 'Completed';
  const value = raw.toLowerCase();
  if (
    value.includes('qualif') ||
    value.includes('selected') ||
    value.includes('shortlist') ||
    value === 'yes' ||
    value === 'pass' ||
    value === 'passed'
  ) {
    return 'Qualified';
  }
  if (
    value.includes('reject') ||
    value.includes('not suitable') ||
    value === 'no' ||
    value === 'fail' ||
    value === 'failed'
  ) {
    return 'Rejected';
  }
  return raw;
}

function resolveField(
  vars: Record<string, unknown> | undefined,
  raw: Record<string, string>,
  extractedKeys: string[],
  excelKeys: string[] = [],
): string {
  return (
    pickExtractedValue(vars, ...extractedKeys) ??
    pickFromExcel(raw, ...excelKeys) ??
    '—'
  );
}

export function resolveBulkCallId(report: CampaignReport): number | undefined {
  if (report.bulkCallId) return report.bulkCallId;
  const match = report.campaignId.match(/CMP-BULK-(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function hasPostCallValues(result: CandidateResult): boolean {
  return [
    result.experienceYears,
    result.currentCtc,
    result.expectedCtc,
    result.currentJob,
    result.jobChange,
    result.noticePeriod,
    result.callSummary,
  ].some((value) => value && value !== '—');
}

export function buildCandidateResultFromLog(
  log: OmnidimCallLog,
  candidate: Candidate,
  parsed: ParsedCandidate | undefined,
  id: string,
): CandidateResult {
  const vars = resolveExtractedVariables(log);
  const raw = parsed?.raw ?? {};
  const mappedStatus = resolveStatusFromOmnidimLog(log);

  const summary =
    log.sentiment_analysis_details ??
    log.call_report?.summary ??
    (typeof log.call_conversation === 'string' && log.call_conversation.trim()
      ? log.call_conversation.replace(/<br\s*\/?>/gi, ' ').slice(0, 500)
      : undefined);

  return {
    id,
    name: candidate.name,
    phone: candidate.phone,
    callLogId: log.id,
    callDuration: log.call_duration ?? candidate.duration,
    sentiment: log.sentiment_score ?? log.call_report?.sentiment ?? '—',
    callSummary: summary ?? '—',
    experienceYears: resolveField(vars, raw, ['experience_years'], ['experience', 'exp']),
    currentCtc: resolveField(vars, raw, ['current_ctc'], ['current ctc', 'ctc']),
    expectedCtc: resolveField(vars, raw, ['expected_ctc'], ['expected ctc']),
    currentJob: resolveField(vars, raw, ['current_job'], ['current job', 'job profile']),
    currentJobRolesResponsibility: resolveField(
      vars,
      raw,
      ['current_job_roles_responsibility'],
      ['roles', 'responsibilities'],
    ),
    jobChange: resolveField(vars, raw, ['job_change'], ['job change']),
    jobChangeReason: resolveField(vars, raw, ['job_change_reason'], ['reason for change']),
    familyBackground: resolveField(vars, raw, ['family_background'], ['family']),
    currentLocation: resolveField(vars, raw, ['current_location'], ['location', 'city']),
    willingToRelocate: resolveField(vars, raw, ['willing_to_relocate'], ['relocate']),
    preferredLocations: resolveField(
      vars,
      raw,
      ['preferred_locations'],
      ['preferred location', 'preferred'],
    ),
    noticePeriod: resolveField(vars, raw, ['notice_period'], ['notice period', 'notice']),
    joiningTime: resolveField(vars, raw, ['joining_time'], ['joining time']),
    joiningStatus: resolveField(vars, raw, ['joining_status'], ['joining status']),
    result: mapQualificationResult(
      pickExtractedValue(
        vars,
        'result',
        'screening_result',
        'qualified',
        'recommendation',
        'outcome',
        'final_result',
        'hr_decision',
      ),
    ),
    status: mappedStatus,
  };
}

export async function buildCampaignResultsFromLogs(
  candidates: Candidate[],
  logs: OmnidimCallLog[],
  candidateMeta: Map<string, ParsedCandidate>,
  logScope: CampaignLogScope,
): Promise<CandidateResult[]> {
  const results: CandidateResult[] = [];
  const logsByPhone = matchCampaignCandidatesToLogs(candidates, logs, logScope);

  for (const candidate of candidates) {
    if (candidate.dispatchFailed) continue;

    const normalizedCandidate = {
      ...candidate,
      phoneNormalized:
        candidate.phoneNormalized ??
        normalizePhoneNumber(candidate.phone) ??
        undefined,
    };

    const log = resolveLatestLogForCandidate(normalizedCandidate, logsByPhone);
    if (!log || !isSuccessfulCompletedCall(log)) continue;

    const enrichedLog = await enrichCallLog(log);
    results.push(
      buildCandidateResultFromLog(
        enrichedLog,
        normalizedCandidate,
        candidateMeta.get(candidate.id),
        String(results.length + 1),
      ),
    );
  }

  return results;
}

async function enrichCallLog(log: OmnidimCallLog): Promise<OmnidimCallLog> {
  const detail = await fetchCallLogDetail(log.id);
  return detail ? mergeCallLogs(log, detail) : log;
}

export async function buildCampaignResultsWithRetry(
  candidates: Candidate[],
  logScope: CampaignLogScope,
  candidateMeta: Map<string, ParsedCandidate>,
  maxAttempts = 5,
  delayMs = 4000,
): Promise<CandidateResult[]> {
  let lastResults: CandidateResult[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    const logs = await fetchCampaignCallLogs(logScope);
    lastResults = await buildCampaignResultsFromLogs(
      candidates,
      logs,
      candidateMeta,
      logScope,
    );

    const filledCount = lastResults.filter(hasPostCallValues).length;
    const completedCount = lastResults.length;

    if (filledCount >= completedCount || (filledCount > 0 && attempt >= 2)) {
      break;
    }
  }

  return lastResults;
}

export function candidatesFromReportRows(report: CampaignReport): Candidate[] {
  return report.candidateRows.map((row, index) => ({
    id: `report-row-${index}`,
    name: row.name,
    phone: row.phone,
    phoneNormalized: row.phoneNormalized ?? normalizePhoneNumber(row.phone) ?? undefined,
    callLogId: row.callLogId,
    status: row.status,
    duration: row.duration ?? '—',
    omnidimCallStatus: row.omnidimCallStatus,
    retry: 0,
  }));
}

export async function refreshReportPostCallData(report: CampaignReport): Promise<CampaignReport> {
  const bulkCallId = resolveBulkCallId(report);
  const candidates = candidatesFromReportRows(report);
  const candidateMeta = new Map<string, ParsedCandidate>();
  const logScope = buildCampaignLogScope({
    bulkCallId,
    candidatePhones: candidates.map((c) => c.phoneNormalized ?? c.phone),
  });

  const logs = await fetchCampaignCallLogs(logScope);
  const logsByPhone = matchCampaignCandidatesToLogs(candidates, logs, logScope);

  const candidateRows = report.candidateRows.map((row, index) => {
    const candidate = candidates[index];
    const log = candidate ? resolveLatestLogForCandidate(candidate, logsByPhone) : undefined;

    if (!log) return row;

    return {
      ...row,
      status: resolveStatusFromOmnidimLog(log),
      omnidimCallStatus: resolveOmnidimStatusLabel(log),
      duration: resolveDurationFromOmnidimLog(log),
      callLogId: log.id,
    };
  });

  const results = await buildCampaignResultsWithRetry(candidates, logScope, candidateMeta);
  const qualifiedCandidates = results.filter((row) => row.result === 'Qualified').length;

  const updated: CampaignReport = {
    ...report,
    bulkCallId: bulkCallId ?? report.bulkCallId,
    candidateRows,
    summary: {
      ...report.summary,
      qualifiedCandidates,
    },
    results,
  };

  return syncReportSummary(updated);
}
