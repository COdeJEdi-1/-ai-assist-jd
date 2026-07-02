const API_BASE = 'https://backend.omnidim.io/api/v1';
const DISPATCH_RETRY_ATTEMPTS = 3;
const DISPATCH_RETRY_DELAY_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function dispatchWithRetry(candidate, callContext) {
  let lastError = 'Unknown error';

  for (let attempt = 0; attempt < DISPATCH_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(DISPATCH_RETRY_DELAY_MS);
    }

    try {
      const result = await dispatchOmnidimCall(candidate.phoneNormalized, callContext);

      if (result.success) {
        return { success: true, requestId: result.requestId };
      }

      lastError = result.error ?? lastError;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  return { success: false, error: lastError };
}
