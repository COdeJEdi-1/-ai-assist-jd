import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getCandidatesForBatch, markBatchReported, markCandidateDispatched } from './webhookStore.mjs';
import { classifyCallStatus, dispatchToPhone, fetchCallLogForPhone, sleep } from './omnidimClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'data', 'reports');

const MAX_CALL_ATTEMPTS = 2;
const POLL_ATTEMPTS = 4;
const POLL_DELAY_MS = 6000;

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCallContext(candidate) {
  return {
    candidate_name: candidate.name,
    candidate_email: candidate.email ?? '',
    role_title: candidate.roleTitle ?? '',
    match_score: candidate.score != null ? String(candidate.score) : '',
    source: 'darwin_auto_screening',
  };
}

/**
 * Polls for a candidate's call outcome, retrying the call itself (up to MAX_CALL_ATTEMPTS)
 * if it comes back busy/no-answer, until a terminal status is reached or attempts run out.
 */
async function resolveCallOutcome(candidate) {
  let dialedNumber = candidate.dialedNumber ?? candidate.phoneNormalized;
  let attempts = 1;
  let log = null;

  for (;;) {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      if (i > 0) await sleep(POLL_DELAY_MS);
      try {
        log = await fetchCallLogForPhone(dialedNumber);
      } catch (err) {
        console.warn(`[BatchReport] call log lookup failed for ${candidate.name}:`, err);
      }
      const status = classifyCallStatus(log?.call_status);
      if (status === 'completed' || status === 'failed') {
        return { log, attempts };
      }
      if (status === 'retry') break; // stop polling this attempt, decide whether to redial below
      // status === 'pending' — call hasn't resolved yet, keep polling
    }

    const status = classifyCallStatus(log?.call_status);
    if (status !== 'retry' || attempts >= MAX_CALL_ATTEMPTS) {
      return { log, attempts };
    }

    console.log(`[BatchReport] ${candidate.name} call was ${log?.call_status} — redialing (attempt ${attempts + 1})`);
    const redial = await dispatchToPhone(candidate.phoneNormalized, buildCallContext(candidate));
    attempts += 1;

    if (redial.skipped || !redial.success) {
      return { log, attempts };
    }

    dialedNumber = redial.dialedNumber;
    markCandidateDispatched(candidate.id, {
      dispatchRequestId: redial.requestId,
      dialedNumber: redial.dialedNumber,
    });
    log = null;
  }
}

const HEADERS = [
  'Name',
  'Phone',
  'Email',
  'Score',
  'Role',
  'Dispatch Status',
  'Call Status',
  'Attempts',
  'Call Duration',
  'Sentiment',
  'Summary',
];

/** Builds a CSV report for a closed batch and writes it to server/data/reports/<batchId>.csv. */
export async function buildBatchReport(batchId) {
  ensureReportsDir();

  const candidates = getCandidatesForBatch(batchId);

  const rows = await Promise.all(
    candidates.map(async (candidate) => {
      let log = null;
      let attempts = candidate.dispatchStatus === 'dispatched' ? 1 : 0;

      if (candidate.dispatchStatus === 'dispatched' && candidate.phoneNormalized) {
        const outcome = await resolveCallOutcome(candidate);
        log = outcome.log;
        attempts = outcome.attempts;
      }

      const callStatusLabel = candidate.dispatchStatus === 'dispatched'
        ? (log?.call_status ?? 'unknown')
        : '';

      return [
        escapeCsv(candidate.name),
        escapeCsv(candidate.phoneNormalized ?? candidate.phone),
        escapeCsv(candidate.email ?? ''),
        escapeCsv(candidate.score ?? ''),
        escapeCsv(candidate.roleTitle ?? ''),
        escapeCsv(candidate.dispatchStatus),
        escapeCsv(callStatusLabel),
        escapeCsv(attempts || ''),
        escapeCsv(log?.call_duration ?? ''),
        escapeCsv(log?.sentiment_score ?? ''),
        escapeCsv(log?.sentiment_analysis_details ?? log?.call_report?.summary ?? ''),
      ].join(',');
    }),
  );

  const lines = ['Arvind GCC — Auto-Screening Batch Report', '', HEADERS.join(','), ...rows];
  const csv = lines.join('\n');

  const filePath = path.join(REPORTS_DIR, `${batchId}.csv`);
  fs.writeFileSync(filePath, csv, 'utf8');

  markBatchReported(batchId, filePath);
  return filePath;
}
