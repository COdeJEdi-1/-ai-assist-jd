import * as XLSX from 'xlsx';
import type { ParsedCandidate } from '../types';

const NAME_KEYS = ['name', 'candidate', 'candidate name', 'full name', 'employee name', 'applicant'];
const PHONE_KEYS = ['phone', 'mobile', 'phone number', 'contact', 'contact number', 'mobile number', 'tel'];
const EMAIL_KEYS = ['email', 'e-mail', 'email address', 'mail'];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return String(Math.round(value));
    return String(value);
  }
  return String(value).trim();
}

function findColumnKey(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const key of candidates) {
    const match = normalized.find((h) => h.norm === key || h.norm.includes(key));
    if (match) return match.raw;
  }
  return null;
}

export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10) return `+${digits}`;
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length > 10) return `+${digits}`;

  return null;
}

export interface ParseFileResult {
  candidates: ParsedCandidate[];
  columns: string[];
  invalidPhoneCount: number;
}

export async function parseCandidateFile(file: File): Promise<ParseFileResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('The file contains no worksheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error('The file has no data rows.');
  }

  const headers = Object.keys(rows[0]);
  const nameKey = findColumnKey(headers, NAME_KEYS);
  const phoneKey = findColumnKey(headers, PHONE_KEYS);
  const emailKey = findColumnKey(headers, EMAIL_KEYS);

  if (!phoneKey) {
    throw new Error(
      'Could not find a phone column. Expected headers like: Phone, Mobile, Contact Number.',
    );
  }

  let invalidPhoneCount = 0;
  const candidates: ParsedCandidate[] = [];

  rows.forEach((row, index) => {
    const raw: Record<string, string> = {};
    headers.forEach((h) => {
      raw[h] = cellToString(row[h]);
    });

    const name = nameKey ? cellToString(row[nameKey]) : '';
    const phone = cellToString(row[phoneKey]);
    const email = emailKey ? cellToString(row[emailKey]) : '';

    if (!phone && !name) return;

    const phoneNormalized = normalizePhoneNumber(phone);
    if (!phoneNormalized) invalidPhoneCount += 1;

    candidates.push({
      id: `row-${index + 1}`,
      name: name || `Candidate ${index + 1}`,
      phone,
      email,
      phoneNormalized,
      raw,
    });
  });

  return {
    candidates,
    columns: headers,
    invalidPhoneCount,
  };
}
