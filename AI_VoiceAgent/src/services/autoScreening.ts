const WEBHOOK_SERVER_URL = import.meta.env.VITE_WEBHOOK_SERVER_URL || 'http://localhost:3001';

function authHeaders(): Record<string, string> {
  const secret = import.meta.env.VITE_WEBHOOK_SECRET;
  return secret ? { 'X-Webhook-Secret': secret } : {};
}

export async function getAutoCallEnabled(): Promise<boolean> {
  const response = await fetch(`${WEBHOOK_SERVER_URL}/api/settings/auto-call`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load auto-call status');
  const data = await response.json();
  return data.enabled !== false;
}

export async function setAutoCallEnabled(enabled: boolean): Promise<boolean> {
  const response = await fetch(`${WEBHOOK_SERVER_URL}/api/settings/auto-call`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) throw new Error('Failed to update auto-call status');
  const data = await response.json();
  return data.enabled;
}

export interface BulkUploadResult {
  count: number;
  candidates: Array<{ id: string; name: string }>;
}

/** Uploads a Qualified-for-AI-Call Excel export and dispatches calls for every row, bypassing the pause switch. */
export async function uploadQualifiedExcel(file: File): Promise<BulkUploadResult> {
  const buffer = await file.arrayBuffer();

  const response = await fetch(`${WEBHOOK_SERVER_URL}/api/candidates/bulk-upload`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? 'Upload failed');
  }

  return data;
}
