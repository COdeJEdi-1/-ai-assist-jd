import type { CallStatus, ParsedCandidate } from '../types';

const API_BASE = '/api/omnidim';
const CALL_DELAY_MS = 5000;
const DISPATCH_RETRY_ATTEMPTS = 3;
const DISPATCH_RETRY_DELAY_MS = 4000;
const DEFAULT_CONCURRENT_CALLS = 4;

export function getConcurrentCallLimit(): number {
  const raw = import.meta.env.VITE_OMNIDIM_CONCURRENT_CALLS;
  const parsed = raw ? Number(raw) : DEFAULT_CONCURRENT_CALLS;
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONCURRENT_CALLS;
  return Math.min(Math.floor(parsed), 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConfig() {
  const agentId = import.meta.env.VITE_OMNIDIM_AGENT_ID;
  const apiKey = import.meta.env.VITE_OMNIDIM_API_KEY;

  if (!agentId || !apiKey) {
    throw new Error(
      'OmniDimension credentials missing. Set VITE_OMNIDIM_AGENT_ID and VITE_OMNIDIM_API_KEY in .env',
    );
  }

  return {
    agentId: Number(agentId),
    apiKey,
  };
}

function authHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function sanitizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

export function phonesMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) {
    return da.slice(-10) === db.slice(-10);
  }
  return false;
}

function buildContactRow(candidate: ParsedCandidate, campaignName: string) {
  const row: Record<string, string> = {
    phone_number: candidate.phoneNormalized!,
    candidate_name: candidate.name,
    campaign_name: campaignName,
  };

  if (candidate.email) row.candidate_email = candidate.email;

  Object.entries(candidate.raw).forEach(([key, value]) => {
    if (!value) return;
    const safeKey = sanitizeKey(key);
    if (safeKey && !row[safeKey]) {
      row[safeKey] = String(value).slice(0, 300);
    }
  });

  return row;
}

function buildCallContext(candidate: ParsedCandidate, campaignName: string): Record<string, string> {
  const row = buildContactRow(candidate, campaignName);
  const { phone_number: _p, ...context } = row;
  return context;
}

function extractApiError(data: unknown, status: number): string {
  if (!data || typeof data !== 'object') return `API error ${status}`;

  const obj = data as Record<string, unknown>;

  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (typeof obj.detail === 'string') return obj.detail;

  if (Array.isArray(obj.detail)) {
    return obj.detail.map((d) => String(d)).join(', ');
  }

  if (obj.errors && typeof obj.errors === 'object') {
    return JSON.stringify(obj.errors);
  }

  return `API error ${status}`;
}

export interface DispatchCallResult {
  success: boolean;
  candidateId: string;
  candidateName: string;
  phone: string;
  requestId?: number;
  error?: string;
}

export interface BulkCampaignResult {
  success: boolean;
  bulkCallId?: number;
  error?: string;
}

export interface OmnidimCallLog {
  id: number;
  to_number?: string;
  from_number?: string;
  time_of_call?: string;
  call_status?: string;
  call_duration?: string;
  call_request_id?: number | { id?: number | boolean; type_of_request?: string };
  extracted_variables?: Record<string, unknown>;
  sentiment_score?: string;
  sentiment_analysis_details?: string;
  call_conversation?: string;
  call_report?: {
    summary?: string;
    sentiment?: string;
    extracted_variables?: Record<string, unknown>;
    full_conversation?: string;
  };
  post_call_actions?: {
    call_recording_webhook_ids?: Array<{
      payload?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface FindLatestCallLogOptions {
  /** Prefer the newest completed/answered call (for reports). */
  preferCompleted?: boolean;
  /** Log IDs already assigned to another candidate in this campaign. */
  excludeLogIds?: Set<number>;
}

/** Limits call logs to the current Excel upload / bulk campaign. */
export interface CampaignLogScope {
  bulkCallId?: number;
  allowedPhoneKeys?: Set<string>;
  startedAfterMs?: number;
}

export function buildCampaignLogScope(options: {
  bulkCallId?: number;
  candidatePhones?: Array<string | null | undefined>;
  startedAfterMs?: number;
}): CampaignLogScope {
  const allowedPhoneKeys = new Set<string>();
  for (const phone of options.candidatePhones ?? []) {
    const key = getPhoneLast10(phone ?? undefined);
    if (key) allowedPhoneKeys.add(key);
  }

  return {
    bulkCallId: options.bulkCallId,
    allowedPhoneKeys,
    startedAfterMs: options.startedAfterMs,
  };
}

export function getCallRequestId(log: OmnidimCallLog): number | undefined {
  const value = log.call_request_id;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id;
  return undefined;
}

function parseCallLogsPayload(data: unknown): OmnidimCallLog[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.call_log_data)) return obj.call_log_data as OmnidimCallLog[];
  if (Array.isArray(obj.log_data)) return obj.log_data as OmnidimCallLog[];
  if (Array.isArray(obj.data)) return obj.data as OmnidimCallLog[];
  if (typeof obj.id === 'number') return [obj as OmnidimCallLog];
  return [];
}

export function mergeCallLogs(base: OmnidimCallLog, detail: OmnidimCallLog): OmnidimCallLog {
  return {
    ...base,
    ...detail,
    extracted_variables: {
      ...(base.extracted_variables ?? {}),
      ...(detail.extracted_variables ?? {}),
      ...(detail.call_report?.extracted_variables ?? {}),
      ...(base.call_report?.extracted_variables ?? {}),
    },
    call_report: {
      ...(base.call_report ?? {}),
      ...(detail.call_report ?? {}),
      extracted_variables: {
        ...(base.call_report?.extracted_variables ?? {}),
        ...(detail.call_report?.extracted_variables ?? {}),
        ...(detail.extracted_variables ?? {}),
      },
    },
  };
}

async function getPhoneNumberId(apiKey: string): Promise<string> {
  const fromEnv = import.meta.env.VITE_OMNIDIM_PHONE_NUMBER_ID;
  if (fromEnv) return String(fromEnv);

  const response = await fetch(`${API_BASE}/phone_number/list`, {
    headers: authHeaders(apiKey),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(extractApiError(data, response.status));
  }

  const list =
    (data as { phone_numbers?: { id: number | string }[] }).phone_numbers ??
    (data as { data?: { id: number | string }[] }).data ??
    [];

  const first = list[0]?.id;
  if (!first) {
    throw new Error(
      'No outbound phone number found in OmniDimension. Set VITE_OMNIDIM_PHONE_NUMBER_ID in .env',
    );
  }

  return String(first);
}

export async function createBulkCampaign(
  campaignName: string,
  candidates: ParsedCandidate[],
): Promise<BulkCampaignResult> {
  const { apiKey } = getConfig();

  try {
    const phoneNumberId = await getPhoneNumberId(apiKey);
    const contactList = candidates
      .filter((c) => c.phoneNormalized)
      .map((c) => buildContactRow(c, campaignName));

    const response = await fetch(`${API_BASE}/calls/bulk_call/create`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        name: campaignName,
        phone_number_id: phoneNumberId,
        contact_list: contactList,
        concurrent_call_limit: getConcurrentCallLimit(),
        enabled_reschedule_call: true,
        retry_config: {
          auto_retry: true,
          auto_retry_schedule: 'immediately',
          retry_limit: 2,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, error: extractApiError(data, response.status) };
    }

    const bulkCallId = (data as { id?: number }).id;
    if (!bulkCallId) {
      return { success: false, error: 'Bulk campaign created but no campaign ID returned.' };
    }

    return { success: true, bulkCallId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create bulk campaign',
    };
  }
}

export async function dispatchOmnidimCall(
  toNumber: string,
  callContext: Record<string, string>,
): Promise<{ success: boolean; requestId?: number; error?: string }> {
  const { agentId, apiKey } = getConfig();

  const response = await fetch(`${API_BASE}/calls/dispatch`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      agent_id: agentId,
      to_number: toNumber,
      call_context: callContext,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { success: false, error: extractApiError(data, response.status) };
  }

  const success =
    data.success !== false &&
    (data.status === 'dispatched' || data.success === true || Boolean(data.requestId));

  return {
    success,
    requestId: data.requestId,
    error: success ? undefined : extractApiError(data, response.status),
  };
}

async function dispatchWithRetry(
  candidate: ParsedCandidate,
  campaignName: string,
): Promise<DispatchCallResult> {
  let lastError = 'Unknown error';

  for (let attempt = 0; attempt < DISPATCH_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(DISPATCH_RETRY_DELAY_MS);
    }

    try {
      const callContext = buildCallContext(candidate, campaignName);
      const result = await dispatchOmnidimCall(candidate.phoneNormalized!, callContext);

      if (result.success) {
        return {
          success: true,
          candidateId: candidate.id,
          candidateName: candidate.name,
          phone: candidate.phoneNormalized!,
          requestId: result.requestId,
        };
      }

      lastError = result.error ?? lastError;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  return {
    success: false,
    candidateId: candidate.id,
    candidateName: candidate.name,
    phone: candidate.phoneNormalized!,
    error: lastError,
  };
}

export type DispatchProgressCallback = (
  current: number,
  total: number,
  candidateName: string,
  message?: string,
) => void;

export async function dispatchCampaignCalls(
  candidates: ParsedCandidate[],
  campaignName: string,
  onProgress?: DispatchProgressCallback,
): Promise<{
  results: DispatchCallResult[];
  dispatched: number;
  failed: number;
  bulkCallId?: number;
  usedBulkCall: boolean;
}> {
  const callable = candidates.filter((c) => c.phoneNormalized);

  onProgress?.(0, callable.length, '', 'Creating bulk call campaign...');
  const bulk = await createBulkCampaign(campaignName, callable);

  if (bulk.success && bulk.bulkCallId) {
    const results: DispatchCallResult[] = callable.map((c) => ({
      success: true,
      candidateId: c.id,
      candidateName: c.name,
      phone: c.phoneNormalized!,
    }));

    return {
      results,
      dispatched: callable.length,
      failed: 0,
      bulkCallId: bulk.bulkCallId,
      usedBulkCall: true,
    };
  }

  onProgress?.(0, callable.length, '', `Bulk call unavailable (${bulk.error}). Dispatching in batches of ${getConcurrentCallLimit()}...`);

  const results: DispatchCallResult[] = [];
  const batchSize = getConcurrentCallLimit();

  for (let i = 0; i < callable.length; i += batchSize) {
    const batch = callable.slice(i, i + batchSize);

    if (i > 0) {
      await sleep(CALL_DELAY_MS);
    }

    onProgress?.(
      Math.min(i + batchSize, callable.length),
      callable.length,
      '',
      `Dispatching batch ${Math.floor(i / batchSize) + 1} (${batch.length} calls in parallel)`,
    );

    const batchResults = await Promise.all(
      batch.map((candidate) => dispatchWithRetry(candidate, campaignName)),
    );
    results.push(...batchResults);
  }

  const dispatched = results.filter((r) => r.success).length;

  return {
    results,
    dispatched,
    failed: results.length - dispatched,
    usedBulkCall: false,
  };
}

export async function fetchRecentCallLogs(
  bulkCallId?: number,
  options?: { includeAgentFilter?: boolean },
): Promise<OmnidimCallLog[]> {
  const { agentId, apiKey } = getConfig();

  const params = new URLSearchParams({
    pagesize: '150',
    pageno: '1',
  });

  if (bulkCallId) {
    params.set('bulk_call_id', String(bulkCallId));
  } else if (options?.includeAgentFilter !== false) {
    params.set('agentid', String(agentId));
  }

  try {
    const response = await fetch(`${API_BASE}/calls/logs?${params.toString()}`, {
      headers: authHeaders(apiKey),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[OmniDimension] call logs fetch failed:', extractApiError(data, response.status));
      return [];
    }

    return parseCallLogsPayload(data);
  } catch (err) {
    console.warn('[OmniDimension] call logs network error:', err);
    return [];
  }
}

/** Bulk campaign logs — list then fresh detail per log (authoritative call_status). */
export async function fetchBulkCampaignCallLogs(bulkCallId: number): Promise<OmnidimCallLog[]> {
  const list = await fetchRecentCallLogs(bulkCallId, { includeAgentFilter: false });
  if (list.length === 0) return [];

  const uniqueIds = [...new Set(list.map((log) => log.id))];
  const details = await Promise.all(uniqueIds.map((id) => fetchCallLogDetail(id)));

  return details.filter((log): log is OmnidimCallLog => log != null);
}

/** Fetch logs for the active bulk campaign (raw API response, no cross-campaign filtering). */
export async function fetchCampaignCallLogs(scope: CampaignLogScope): Promise<OmnidimCallLog[]> {
  if (scope.bulkCallId) {
    const logs = await fetchBulkCampaignCallLogs(scope.bulkCallId);
    return filterLogsForCampaign(logs, scope);
  }

  if (!scope.allowedPhoneKeys?.size) {
    return [];
  }

  const logs = await fetchRecentCallLogs(undefined, { includeAgentFilter: true });
  return filterLogsForCampaign(logs, scope);
}

export async function fetchCallLogDetail(callLogId: number): Promise<OmnidimCallLog | null> {
  const { apiKey } = getConfig();

  try {
    const response = await fetch(`${API_BASE}/calls/logs/${callLogId}`, {
      headers: authHeaders(apiKey),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(
        `[OmniDimension] call log ${callLogId} detail failed:`,
        extractApiError(data, response.status),
      );
      return null;
    }

    const logs = parseCallLogsPayload(data);
    return logs[0] ?? null;
  } catch (err) {
    console.warn(`[OmniDimension] call log ${callLogId} network error:`, err);
    return null;
  }
}

function normalizeCallStatus(status?: string): string {
  return (status ?? '').toLowerCase().replace(/[_\s-]+/g, '');
}

export function getPhoneLast10(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function isCompletedCallStatus(status?: string): boolean {
  const s = normalizeCallStatus(status);
  return s === 'completed' || s === 'answered';
}

/** True when OmniDimension reports a successfully answered screening call. */
export function isSuccessfulCompletedCall(log: OmnidimCallLog): boolean {
  if (!isCompletedCallStatus(log.call_status)) return false;
  if (log.is_voicemail === true) return false;
  return true;
}

function filterLogsForCampaign(
  logs: OmnidimCallLog[],
  scope?: CampaignLogScope,
): OmnidimCallLog[] {
  if (!scope?.bulkCallId && !scope?.allowedPhoneKeys?.size) {
    return logs;
  }

  return logs.filter((log) => {
    const phoneKey = getPhoneLast10(getLogCalleePhone(log));
    if (!phoneKey) return false;

    if (scope.allowedPhoneKeys?.size && !scope.allowedPhoneKeys.has(phoneKey)) {
      return false;
    }

    if (scope.bulkCallId) {
      const logBulk = log.bulk_call_id ?? log.bulkCallId;
      if (logBulk != null && logBulk !== '') {
        return Number(logBulk) === scope.bulkCallId;
      }
      // Bulk API query but log has no bulk_call_id — use campaign start window only.
      if (scope.startedAfterMs) {
        return parseLogTimestamp(log) >= scope.startedAfterMs - 120_000;
      }
      return true;
    }

    return true;
  });
}

function readPhoneField(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/** Customer phone on the call log (outbound → to_number). Never use the agent line. */
function getLogCalleePhone(log: OmnidimCallLog): string | undefined {
  const direction = String(log.call_direction ?? 'outbound').toLowerCase();
  const fromNumber = readPhoneField(log.from_number);

  const customerFields = [
    log.to_number,
    log.to,
    log.contact_number,
    log.customer_number,
    log.recipient_number,
    log.callee_number,
  ];

  for (const field of customerFields) {
    const phone = readPhoneField(field);
    if (!phone) continue;
    if (direction === 'outbound' && fromNumber && phonesMatch(phone, fromNumber)) continue;
    return phone;
  }

  if (direction === 'inbound') {
    return fromNumber;
  }

  return undefined;
}

function parseLogTimestamp(log: OmnidimCallLog): number {
  if (log.time_of_call) {
    const parts = log.time_of_call.match(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/,
    );
    if (parts) {
      const [, month, day, year, hour, minute, second] = parts;
      const parsed = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      );
      if (!Number.isNaN(parsed)) return parsed;
    }

    const parsed = Date.parse(log.time_of_call);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return log.id;
}

function compareLogRecency(a: OmnidimCallLog, b: OmnidimCallLog): number {
  return b.id - a.id;
}

export function findLogForCandidate(
  candidate: { phoneNormalized?: string; phone?: string },
  logs: OmnidimCallLog[],
): OmnidimCallLog | undefined {
  const targets = [candidate.phoneNormalized, candidate.phone].filter(Boolean) as string[];
  if (targets.length === 0) return undefined;

  const matching = logs.filter((log) => {
    const callee = getLogCalleePhone(log);
    if (!callee) return false;
    return targets.some((target) => phonesMatch(callee, target));
  });

  if (matching.length === 0) return undefined;
  matching.sort((a, b) => b.id - a.id);
  return matching[0];
}

/**
 * Assign OmniDimension bulk-call logs to Excel candidates by phone.
 * Uses phonesMatch + highest call log ID per candidate.
 */
export function assignBulkLogsToCandidates<
  T extends { phoneNormalized?: string; phone?: string },
>(candidates: T[], logs: OmnidimCallLog[]): Map<string, OmnidimCallLog> {
  const assigned = new Map<string, OmnidimCallLog>();

  for (const candidate of candidates) {
    const key = getCandidatePhoneKey(candidate);
    if (!key) continue;
    const log = findLogForCandidate(candidate, logs);
    if (log) assigned.set(key, log);
  }

  return assigned;
}

export function getCandidatePhoneKey(candidate: {
  phoneNormalized?: string;
  phone?: string;
}): string | null {
  return getPhoneLast10(candidate.phoneNormalized ?? candidate.phone);
}

/** Latest call log per phone number for a campaign (newest attempt wins). */
export function buildLatestLogsByPhone(
  logs: OmnidimCallLog[],
  scope?: CampaignLogScope,
): Map<string, OmnidimCallLog> {
  const filtered = filterLogsForCampaign(logs, scope);
  const sorted = [...filtered].sort(compareLogRecency);
  const latestByPhone = new Map<string, OmnidimCallLog>();

  for (const log of sorted) {
    const key = getPhoneLast10(getLogCalleePhone(log));
    if (!key || latestByPhone.has(key)) continue;
    latestByPhone.set(key, log);
  }

  return latestByPhone;
}

export function resolveLatestLogForCandidate(
  candidate: { phoneNormalized?: string; phone?: string },
  latestByPhone: Map<string, OmnidimCallLog>,
): OmnidimCallLog | undefined {
  const key = getCandidatePhoneKey(candidate);
  if (!key) return undefined;
  return latestByPhone.get(key);
}

/**
 * Match each uploaded Excel candidate to their latest OmniDimension log
 * for this bulk campaign only (candidate-first, not log-first).
 */
export function matchCampaignCandidatesToLogs(
  candidates: Array<{ phoneNormalized?: string; phone?: string }>,
  logs: OmnidimCallLog[],
  scope: CampaignLogScope,
): Map<string, OmnidimCallLog> {
  if (scope.bulkCallId) {
    return assignBulkLogsToCandidates(candidates, logs);
  }

  const scopedLogs = filterLogsForCampaign(logs, scope);
  return assignBulkLogsToCandidates(candidates, scopedLogs);
}

export function findLatestCallLog(
  logs: OmnidimCallLog[],
  candidate: { phoneNormalized?: string; phone?: string; requestId?: number; callLogId?: number },
  options: FindLatestCallLogOptions & { scope?: CampaignLogScope } = {},
): OmnidimCallLog | undefined {
  const { preferCompleted = false, excludeLogIds, scope } = options;
  const latestByPhone = buildLatestLogsByPhone(logs, scope);
  const log = resolveLatestLogForCandidate(candidate, latestByPhone);

  if (!log || excludeLogIds?.has(log.id)) return undefined;

  if (preferCompleted) {
    const key = getCandidatePhoneKey(candidate);
    if (!key) return undefined;

    const filtered = filterLogsForCampaign(logs, scope)
      .filter((entry) => {
        if (excludeLogIds?.has(entry.id)) return false;
        return getPhoneLast10(getLogCalleePhone(entry)) === key;
      })
      .sort(compareLogRecency);

    const completed = filtered.filter((entry) => isCompletedCallStatus(entry.call_status));
    if (completed.length > 0) return completed[0];
  }

  return log;
}

export function mapOmnidimCallStatus(apiStatus?: string): import('../types').CallStatus | null {
  if (!apiStatus) return null;

  const s = normalizeCallStatus(apiStatus);

  if (s === 'completed' || s === 'answered') return 'completed';
  if (s === 'failed' || s === 'rejected' || s === 'declined' || s === 'cancelled') {
    return 'failed';
  }
  if (s === 'busy' || s === 'noanswer') return 'retry';
  if (
    s === 'inprogress' ||
    s === 'ringing' ||
    s === 'dispatched' ||
    s === 'ongoing'
  ) {
    return 'calling';
  }
  if (s === 'queued' || s === 'pending') return 'queued';

  return null;
}

/** Single source of truth: map OmniDimension call log → UI status. */
export function resolveStatusFromOmnidimLog(log: OmnidimCallLog): CallStatus {
  const mapped = mapOmnidimCallStatus(log.call_status);
  if (mapped) return mapped;

  console.warn(
    '[OmniDimension] Unknown call_status — defaulting to queued:',
    log.call_status,
    'log id:',
    log.id,
  );
  return 'queued';
}

/** Raw OmniDimension status label for display (matches Recent Calls). */
export function resolveOmnidimStatusLabel(log: OmnidimCallLog): string {
  const raw = (log.call_status ?? '').trim();
  if (!raw) return 'Not Initiated';

  const normalized = normalizeCallStatus(raw);

  if (
    normalized === 'inprogress' ||
    normalized === 'ringing' ||
    normalized === 'dispatched' ||
    normalized === 'ongoing'
  ) {
    return 'Calling';
  }

  if (normalized === 'queued' || normalized === 'pending') {
    return 'Not Initiated';
  }

  if (raw.toLowerCase() === 'no-answer') return 'No Answer';
  if (raw.toLowerCase() === 'completed') return 'Completed';
  if (raw.toLowerCase() === 'failed') return 'Failed';
  if (raw.toLowerCase() === 'busy') return 'Busy';

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function resolveDurationFromOmnidimLog(log: OmnidimCallLog): string {
  if (!log.call_duration || log.call_duration === '0:0' || log.call_duration === '0:00') {
    return '00:00';
  }
  const parts = log.call_duration.split(':');
  if (parts.length === 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return log.call_duration;
}
