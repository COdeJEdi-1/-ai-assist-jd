import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getCandidatesForBatch, markBatchReported } from './webhookStore.mjs';
import { fetchCallLogForPhone } from './omnidimClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'data', 'reports');

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

const HEADERS = [
  'Name',
  'Phone',
  'Email',
  'Score',
  'Role',
  'Dispatch Status',
  'Call Status',
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
      if (candidate.dispatchStatus === 'dispatched' && candidate.phoneNormalized) {
        try {
          log = await fetchCallLogForPhone(candidate.dialedNumber ?? candidate.phoneNormalized);
        } catch (err) {
          console.warn(`[BatchReport] call log lookup failed for ${candidate.name}:`, err);
        }
      }

      return [
        escapeCsv(candidate.name),
        escapeCsv(candidate.phoneNormalized ?? candidate.phone),
        escapeCsv(candidate.email ?? ''),
        escapeCsv(candidate.score ?? ''),
        escapeCsv(candidate.roleTitle ?? ''),
        escapeCsv(candidate.dispatchStatus),
        escapeCsv(log?.call_status ?? 'unknown'),
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
