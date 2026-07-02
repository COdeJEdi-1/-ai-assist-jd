import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import {
  addInboundCandidate,
  assignToBatch,
  closeBatch,
  findExpiredOpenBatches,
  getBatch,
  getCallLogsFromWebhooks,
  getOrOpenBatch,
  getWebhookStats,
  listBatches,
  listInboundCandidates,
  listRecentEvents,
  markCandidateDispatched,
  registerCampaign,
  storeWebhookEvent,
} from './webhookStore.mjs';
import { dispatchToPhone, isDryRun } from './omnidimClient.mjs';
import { buildBatchReport } from './batchReport.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const PORT = Number(process.env.WEBHOOK_PORT || 3001);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.VITE_WEBHOOK_SECRET || '';
const PUBLIC_BASE_URL =
  process.env.WEBHOOK_PUBLIC_URL ||
  process.env.VITE_WEBHOOK_PUBLIC_URL ||
  'http://localhost:5173';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isAuthorized(req, url) {
  if (!WEBHOOK_SECRET) return true;

  const queryToken = url.searchParams.get('token');
  const headerToken = req.headers['x-webhook-secret'];
  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

  return [queryToken, headerToken, bearer].some((value) => value === WEBHOOK_SECRET);
}

function buildWebhookUrl() {
  const base = PUBLIC_BASE_URL.replace(/\/$/, '');
  const path = '/api/webhook/post-call';
  if (!WEBHOOK_SECRET) return `${base}${path}`;
  return `${base}${path}?token=${encodeURIComponent(WEBHOOK_SECRET)}`;
}

function buildCallContext(record) {
  return {
    candidate_name: record.name,
    candidate_email: record.email ?? '',
    role_title: record.roleTitle ?? '',
    match_score: record.score != null ? String(record.score) : '',
    source: 'darwin_auto_screening',
  };
}

async function dispatchInboundCandidate(record) {
  const batch = getOrOpenBatch();
  assignToBatch(batch.id, record.id);

  if (!record.phoneNormalized) {
    markCandidateDispatched(record.id, {
      dispatchStatus: 'failed',
      dispatchError: 'Invalid or missing phone number',
    });
    return;
  }

  const result = await dispatchToPhone(record.phoneNormalized, buildCallContext(record));

  if (result.skipped) {
    markCandidateDispatched(record.id, { dispatchStatus: 'skipped_dry_run', dryRun: true });
    console.log(`[Candidates] DRY RUN (no VOICE_AGENT_TEST_PHONE set) — skipped dispatch for ${record.name}`);
    return;
  }

  markCandidateDispatched(record.id, {
    dispatchStatus: result.success ? 'dispatched' : 'failed',
    dispatchRequestId: result.requestId,
    dispatchError: result.error,
    dryRun: result.dryRun,
    dialedNumber: result.dialedNumber,
  });

  const label = result.dryRun ? 'DRY RUN dispatch' : 'Dispatched call';
  console.log(
    `[Candidates] ${label} for ${record.name} → ${result.dialedNumber} (result: ${result.success ? 'ok' : result.error})`,
  );
}

function checkExpiredBatches() {
  for (const batch of findExpiredOpenBatches()) {
    closeBatch(batch.id);
    console.log(`[Batches] Closed batch ${batch.id} (${batch.candidateIds.length} candidates) — building report`);
    buildBatchReport(batch.id)
      .then((filePath) => console.log(`[Batches] Report ready for ${batch.id}: ${filePath}`))
      .catch((err) => console.error(`[Batches] Report generation failed for ${batch.id}:`, err));
  }
}

setInterval(checkExpiredBatches, 15_000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (pathname === '/api/webhook/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, service: 'post-call-webhook' });
      return;
    }

    if (pathname === '/api/webhook/info' && req.method === 'GET') {
      sendJson(res, 200, {
        webhookUrl: buildWebhookUrl(),
        publicBaseUrl: PUBLIC_BASE_URL,
        secured: Boolean(WEBHOOK_SECRET),
        instructions:
          'Paste this URL in OmniDimension → Agent → Post Call → Webhook delivery method. Use Standard JSON format.',
        ...getWebhookStats(),
      });
      return;
    }

    if (pathname === '/api/webhook/post-call/logs' && req.method === 'GET') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const bulkCallId = url.searchParams.get('bulkCallId');
      const campaignId = url.searchParams.get('campaignId');
      const campaignName = url.searchParams.get('campaignName');

      const logs = getCallLogsFromWebhooks({
        bulkCallId: bulkCallId ? Number(bulkCallId) : undefined,
        campaignId: campaignId ?? undefined,
        campaignName: campaignName ?? undefined,
      });

      sendJson(res, 200, { call_log_data: logs, count: logs.length });
      return;
    }

    if (pathname === '/api/webhook/post-call/events' && req.method === 'GET') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const limit = Number(url.searchParams.get('limit') || 20);
      sendJson(res, 200, { events: listRecentEvents(limit) });
      return;
    }

    if (pathname === '/api/webhook/campaigns' && req.method === 'POST') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const body = await readBody(req);
      const campaign = registerCampaign({
        campaignId: String(body.campaignId ?? ''),
        campaignName: String(body.campaignName ?? ''),
        bulkCallId: body.bulkCallId ? Number(body.bulkCallId) : undefined,
        startedAt: Date.now(),
        phones: Array.isArray(body.phones) ? body.phones.map(String) : [],
      });

      sendJson(res, 201, { success: true, campaign });
      return;
    }

    if (pathname === '/api/webhook/post-call' && req.method === 'POST') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const body = await readBody(req);
      const event = storeWebhookEvent(body);

      console.log(
        `[Webhook] Post-call received call_id=${event.callLogId ?? 'n/a'} phone=${event.phoneNumber ?? 'n/a'} campaign=${event.campaignName ?? event.campaignId ?? 'n/a'}`,
      );

      sendJson(res, 200, {
        success: true,
        id: event.id,
        receivedAt: event.receivedAt,
        message: 'Post-call webhook stored successfully',
      });
      return;
    }

    if (pathname === '/api/candidates/inbound' && req.method === 'POST') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const body = await readBody(req);
      if (!body.candidateId || !body.name || !body.phone) {
        sendJson(res, 400, { error: 'candidateId, name and phone are required' });
        return;
      }

      const record = addInboundCandidate({
        candidateId: String(body.candidateId),
        name: String(body.name),
        phone: String(body.phone),
        email: body.email ? String(body.email) : undefined,
        score: typeof body.score === 'number' ? body.score : Number(body.score) || undefined,
        roleTitle: body.roleTitle ? String(body.roleTitle) : undefined,
        darwinboxJobId: body.darwinboxJobId ? String(body.darwinboxJobId) : undefined,
      });

      console.log(
        `[Candidates] Inbound: ${record.name} (score=${record.score ?? 'n/a'}) phone=${record.phoneNormalized ?? 'invalid'}`,
      );

      sendJson(res, 201, { success: true, id: record.id, dispatchStatus: record.dispatchStatus });

      dispatchInboundCandidate(record).catch((err) => {
        console.error('[Candidates] Dispatch error:', err);
      });

      return;
    }

    if (pathname === '/api/candidates/inbound' && req.method === 'GET') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const limit = Number(url.searchParams.get('limit') || 200);
      sendJson(res, 200, {
        candidates: listInboundCandidates(limit),
        dryRun: isDryRun(),
      });
      return;
    }

    if (pathname === '/api/candidates/batches' && req.method === 'GET') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const limit = Number(url.searchParams.get('limit') || 100);
      sendJson(res, 200, {
        batches: listBatches(limit).map((b) => ({
          id: b.id,
          openedAt: b.openedAt,
          closesAt: b.closesAt,
          status: b.status,
          candidateCount: b.candidateIds.length,
        })),
      });
      return;
    }

    const batchReportMatch = pathname.match(/^\/api\/candidates\/batches\/([^/]+)\/report$/);
    if (batchReportMatch && req.method === 'GET') {
      if (!isAuthorized(req, url)) {
        sendJson(res, 401, { error: 'Unauthorized webhook request' });
        return;
      }

      const batch = getBatch(batchReportMatch[1]);
      if (!batch) {
        sendJson(res, 404, { error: 'Batch not found' });
        return;
      }

      if (batch.status !== 'reported' || !batch.reportPath || !fs.existsSync(batch.reportPath)) {
        sendJson(res, 202, {
          status: batch.status,
          message: 'Report not ready yet — batch window may still be open or report is still generating.',
        });
        return;
      }

      const csv = fs.readFileSync(batch.reportPath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${batch.id}-report.csv"`,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(csv);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Webhook] Post-call server listening on http://0.0.0.0:${PORT}`);
  console.log(`[Webhook] Paste in OmniDimension: ${buildWebhookUrl()}`);
});
