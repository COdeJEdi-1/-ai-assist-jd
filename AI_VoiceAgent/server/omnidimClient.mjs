const API_BASE = 'https://backend.omnidim.io/api/v1';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDryRun() {
  return String(process.env.VOICE_AGENT_DRY_RUN || '').toLowerCase() === 'true';
}

function getTestPhone() {
  return process.env.VOICE_AGENT_TEST_PHONE || '';
}

/** Resolves the number that should actually be dialed, respecting the dry-run safety switch. */
export function resolveDialNumber(candidatePhone) {
  const dryRun = isDryRun();
  const testPhone = getTestPhone();

  if (dryRun) {
    return testPhone
      ? { dialNumber: testPhone, dryRun: true, skipped: false }
      : { dialNumber: null, dryRun: true, skipped: true };
  }

  return { dialNumber: candidatePhone, dryRun: false, skipped: false };
}

function normalizeCallStatus(status) {
  return (status ?? '').toLowerCase().replace(/[_\s-]+/g, '');
}

/** Categorizes a raw OmniDimension call_status into pending | retry | completed | failed. */
export function classifyCallStatus(status) {
  const s = normalizeCallStatus(status);
  if (!s) return 'pending';
  if (s === 'failed' || s === 'rejected' || s === 'declined' || s === 'cancelled') return 'failed';
  if (s === 'busy' || s === 'noanswer') return 'retry';
  if (
    s === 'inprogress' ||
    s === 'ringing' ||
    s === 'dispatched' ||
    s === 'ongoing' ||
    s === 'queued' ||
    s === 'pending'
  ) {
    return 'pending';
  }
  return 'completed';
}

function getConfig() {
  const agentId = process.env.VITE_OMNIDIM_AGENT_ID;
  const apiKey = process.env.VITE_OMNIDIM_API_KEY;

  if (!agentId || !apiKey) {
    throw new Error(
      'OmniDimension credentials missing. Set VITE_OMNIDIM_AGENT_ID and VITE_OMNIDIM_API_KEY in .env',
    );
  }

  return { agentId: Number(agentId), apiKey };
}

function authHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function extractApiError(data, status) {
  if (!data || typeof data !== 'object') return `API error ${status}`;

  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map(String).join(', ');
  if (data.errors && typeof data.errors === 'object') return JSON.stringify(data.errors);

  return `API error ${status}`;
}

async function getPhoneNumberId(apiKey) {
  const fromEnv = process.env.VITE_OMNIDIM_PHONE_NUMBER_ID;
  if (fromEnv) return String(fromEnv);

  const response = await fetch(`${API_BASE}/phone_number/list`, {
    headers: authHeaders(apiKey),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(extractApiError(data, response.status));
  }

  const list = data.phone_numbers ?? data.data ?? [];
  const first = list[0]?.id;
  if (!first) {
    throw new Error(
      'No outbound phone number found in OmniDimension. Set VITE_OMNIDIM_PHONE_NUMBER_ID in .env',
    );
  }

  return String(first);
}

export async function dispatchOmnidimCall(toNumber, callContext) {
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

/** Ensures OmniDimension has a phone number configured; throws if the account has none. */
export async function ensurePhoneNumberConfigured() {
  const { apiKey } = getConfig();
  await getPhoneNumberId(apiKey);
}

/**
 * Dispatches a call to a candidate's number, respecting the dry-run safety switch.
 * Returns { success, requestId, error, dialedNumber, dryRun, skipped }.
 */
export async function dispatchToPhone(candidatePhone, callContext) {
  const { dialNumber, dryRun, skipped } = resolveDialNumber(candidatePhone);

  if (skipped) {
    return { success: false, skipped: true, dryRun, error: 'Dry run with no VOICE_AGENT_TEST_PHONE configured' };
  }

  const result = await dispatchOmnidimCall(dialNumber, callContext);
  return { ...result, dialedNumber: dialNumber, dryRun, skipped: false };
}

function parseCallLogsPayload(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.call_log_data)) return data.call_log_data;
  if (Array.isArray(data.log_data)) return data.log_data;
  if (Array.isArray(data.data)) return data.data;
  if (typeof data.id === 'number') return [data];
  return [];
}

function getPhoneLast10(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Fetches recent call logs for this agent (no bulk-campaign scoping — used for single-candidate lookups). */
export async function fetchRecentCallLogs() {
  const { agentId, apiKey } = getConfig();

  const params = new URLSearchParams({
    pagesize: '150',
    pageno: '1',
    agentid: String(agentId),
  });

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

/** Finds the most recent call log matching a given phone number (either party), or null. */
export async function fetchCallLogForPhone(phone) {
  const targetKey = getPhoneLast10(phone);
  if (!targetKey) return null;

  const logs = await fetchRecentCallLogs();
  const matching = logs.filter((log) => {
    const toKey = getPhoneLast10(log.to_number);
    const fromKey = getPhoneLast10(log.from_number);
    return toKey === targetKey || fromKey === targetKey;
  });

  if (matching.length === 0) return null;
  return matching.reduce((latest, log) => (log.id > latest.id ? log : latest));
}
