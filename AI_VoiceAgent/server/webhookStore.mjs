import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'post-call-webhooks.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'registered-campaigns.json');
const INBOUND_CANDIDATES_FILE = path.join(DATA_DIR, 'inbound-candidates.json');

/** @typedef {import('./webhookTypes.mjs').PostCallWebhookEvent} PostCallWebhookEvent */
/** @typedef {import('./webhookTypes.mjs').RegisteredCampaign} RegisteredCampaign */

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** @type {PostCallWebhookEvent[]} */
let events = readJson(EVENTS_FILE, []);

/** @type {RegisteredCampaign[]} */
let campaigns = readJson(CAMPAIGNS_FILE, []);

let inboundCandidates = readJson(INBOUND_CANDIDATES_FILE, []);

function persistEvents() {
  writeJson(EVENTS_FILE, events);
}

function persistCampaigns() {
  writeJson(CAMPAIGNS_FILE, campaigns);
}

function persistInboundCandidates() {
  writeJson(INBOUND_CANDIDATES_FILE, inboundCandidates);
}

/** Normalizes an Indian phone number to dialable +91XXXXXXXXXX form, or null if invalid. */
export function toDialableNumber(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 10 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return null;
}

/**
 * @param {{ candidateId: string, name: string, phone: string, email?: string, score?: number, roleTitle?: string, darwinboxJobId?: string }} input
 */
export function addInboundCandidate(input) {
  const phoneNormalized = toDialableNumber(input.phone);

  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    candidateId: input.candidateId,
    name: input.name,
    phone: input.phone,
    phoneNormalized,
    email: input.email,
    score: input.score,
    roleTitle: input.roleTitle,
    darwinboxJobId: input.darwinboxJobId,
    dispatchStatus: 'pending',
    dispatchRequestId: undefined,
    dispatchError: undefined,
    dryRun: false,
  };

  inboundCandidates = [record, ...inboundCandidates].slice(0, 5000);
  persistInboundCandidates();
  return record;
}

/**
 * @param {string} id
 * @param {Partial<{ dispatchStatus: string, dispatchRequestId: number, dispatchError: string, dryRun: boolean, dialedNumber: string }>} update
 */
export function markCandidateDispatched(id, update) {
  const record = inboundCandidates.find((item) => item.id === id);
  if (!record) return undefined;
  Object.assign(record, update);
  persistInboundCandidates();
  return record;
}

export function listInboundCandidates(limit = 200) {
  return inboundCandidates.slice(0, limit);
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function phonesMatch(a, b) {
  const da = normalizePhone(a);
  const db = normalizePhone(b);
  if (!da || !db) return false;
  return da === db;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function mergeExtractedVariables(root) {
  const merged = {};
  const add = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const str = String(value).trim();
      if (!str) return;
      merged[key] = value;
    });
  };

  add(root.extracted_variables);
  add(root.call_report?.extracted_variables);
  add(root.call_context);
  return merged;
}

/**
 * Normalize OmniDimension standard/custom webhook payloads.
 * @param {unknown} body
 */
export function parseWebhookPayload(body) {
  const root = body && typeof body === 'object' ? body : {};
  const callReport = root.call_report && typeof root.call_report === 'object' ? root.call_report : {};
  const extractedVariables = mergeExtractedVariables(root);

  const campaignName =
    pickString(
      root.campaign_name,
      root.campaignName,
      extractedVariables.campaign_name,
      root.call_context?.campaign_name,
    ) ?? undefined;

  return {
    callLogId: pickNumber(root.call_id, root.call_log_id, root.id),
    bulkCallId: pickNumber(root.bulk_call_id, root.bulkCallId),
    phoneNumber: pickString(
      root.phone_number,
      root.to_number,
      root.customer_number,
      extractedVariables.phone_number,
    ),
    callStatus: pickString(root.call_status, root.status) ?? 'completed',
    callDuration: pickString(root.call_duration, root.duration),
    callDate: pickString(root.call_date, root.time_of_call, root.timestamp),
    botName: pickString(root.bot_name, root.agent_name),
    sentiment: pickString(root.sentiment_score, callReport.sentiment, root.sentiment),
    summary: pickString(
      root.sentiment_analysis_details,
      callReport.summary,
      root.summary,
    ),
    campaignName,
    extractedVariables,
    rawPayload: body,
  };
}

function resolveCampaignForEvent(parsed) {
  if (parsed.bulkCallId) {
    const byBulk = campaigns.find((c) => c.bulkCallId === parsed.bulkCallId);
    if (byBulk) return byBulk;
  }

  if (parsed.campaignName) {
    const byName = campaigns.find(
      (c) => c.campaignName.toLowerCase() === parsed.campaignName.toLowerCase(),
    );
    if (byName) return byName;
  }

  if (parsed.phoneNumber) {
    const matches = campaigns.filter((c) =>
      c.phones.some((phone) => phonesMatch(phone, parsed.phoneNumber)),
    );
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return [...matches].sort((a, b) => b.startedAt - a.startedAt)[0];
    }
  }

  return undefined;
}

/**
 * @param {unknown} body
 */
export function storeWebhookEvent(body) {
  const parsed = parseWebhookPayload(body);
  const campaign = resolveCampaignForEvent(parsed);
  const receivedAt = new Date().toISOString();

  /** @type {PostCallWebhookEvent} */
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    receivedAt,
    callLogId: parsed.callLogId,
    bulkCallId: parsed.bulkCallId ?? campaign?.bulkCallId,
    campaignId: campaign?.campaignId,
    campaignName: parsed.campaignName ?? campaign?.campaignName,
    phoneNumber: parsed.phoneNumber,
    callStatus: parsed.callStatus,
    callDuration: parsed.callDuration,
    callDate: parsed.callDate,
    sentiment: parsed.sentiment,
    summary: parsed.summary,
    extractedVariables: parsed.extractedVariables,
    rawPayload: parsed.rawPayload,
  };

  events = [event, ...events.filter((item) => item.id !== event.id)].slice(0, 5000);
  persistEvents();
  return event;
}

/**
 * @param {RegisteredCampaign} campaign
 */
export function registerCampaign(campaign) {
  campaigns = [
    campaign,
    ...campaigns.filter(
      (item) =>
        item.campaignId !== campaign.campaignId &&
        !(campaign.bulkCallId && item.bulkCallId === campaign.bulkCallId),
    ),
  ].slice(0, 200);
  persistCampaigns();
  return campaign;
}

function eventToCallLog(event) {
  return {
    id: event.callLogId ?? 0,
    to_number: event.phoneNumber,
    time_of_call: event.callDate,
    call_status: event.callStatus,
    call_duration: event.callDuration,
    extracted_variables: event.extractedVariables,
    sentiment_score: event.sentiment,
    sentiment_analysis_details: event.summary,
    call_report: {
      summary: event.summary,
      sentiment: event.sentiment,
      extracted_variables: event.extractedVariables,
    },
  };
}

function isCompletedStatus(status) {
  const value = String(status ?? '').toLowerCase();
  return value === 'completed' || value === 'answered';
}

/**
 * @param {{ bulkCallId?: number, campaignId?: string, campaignName?: string }} filters
 */
export function getCallLogsFromWebhooks(filters = {}) {
  let matched = [...events];

  if (filters.bulkCallId) {
    matched = matched.filter((event) => event.bulkCallId === filters.bulkCallId);
  }

  if (filters.campaignId) {
    matched = matched.filter((event) => event.campaignId === filters.campaignId);
  }

  if (filters.campaignName) {
    const name = filters.campaignName.toLowerCase();
    matched = matched.filter(
      (event) => event.campaignName?.toLowerCase() === name,
    );
  }

  matched = matched.filter((event) => isCompletedStatus(event.callStatus));

  const byPhone = new Map();
  for (const event of matched) {
    const key = normalizePhone(event.phoneNumber);
    if (!key) continue;
    const existing = byPhone.get(key);
    if (!existing || event.receivedAt > existing.receivedAt) {
      byPhone.set(key, event);
    }
  }

  return [...byPhone.values()].map(eventToCallLog);
}

export function getWebhookStats() {
  return {
    totalEvents: events.length,
    totalCampaigns: campaigns.length,
    latestReceivedAt: events[0]?.receivedAt ?? null,
  };
}

export function listRecentEvents(limit = 20) {
  return events.slice(0, limit);
}
