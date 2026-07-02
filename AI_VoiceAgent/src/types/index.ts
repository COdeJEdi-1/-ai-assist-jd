export type CallStatus = 'calling' | 'completed' | 'queued' | 'retry' | 'failed';

export interface DashboardStats {
  totalCandidates: number;
  completedCalls: number;
  activeCalls: number;
  pendingCalls: number;
  failedCalls: number;
  qualifiedCandidates: number;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string;
  phoneNormalized?: string;
  status: CallStatus;
  duration: string;
  retry: number;
  requestId?: number;
  callLogId?: number;
  /** Raw call_status from OmniDimension (matches Recent Calls). */
  omnidimCallStatus?: string;
  dispatchFailed?: boolean;
}

export interface CandidateResult {
  id: string;
  name: string;
  phone?: string;
  callLogId?: number;
  callDuration?: string;
  sentiment?: string;
  callSummary?: string;
  /** OmniDimension: experience_years */
  experienceYears: string;
  /** OmniDimension: current_ctc */
  currentCtc: string;
  /** OmniDimension: expected_ctc */
  expectedCtc: string;
  /** OmniDimension: current_job */
  currentJob: string;
  /** OmniDimension: current_job_roles_responsibility */
  currentJobRolesResponsibility: string;
  /** OmniDimension: job_change */
  jobChange: string;
  /** OmniDimension: job_change_reason */
  jobChangeReason: string;
  /** OmniDimension: family_background */
  familyBackground: string;
  /** OmniDimension: current_location */
  currentLocation: string;
  /** OmniDimension: willing_to_relocate */
  willingToRelocate: string;
  /** OmniDimension: preferred_locations */
  preferredLocations: string;
  /** OmniDimension: notice_period */
  noticePeriod: string;
  /** OmniDimension: joining_time */
  joiningTime: string;
  /** OmniDimension: joining_status */
  joiningStatus: string;
  result: string;
  status: CallStatus;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused' | 'draft';
  createdBy: string;
  startedAt: string;
  totalCandidates: number;
  completed: number;
  running: number;
  queued: number;
  retries: number;
  failed: number;
  averageDuration: string;
  progress: number;
}

export interface ParsedCandidate {
  id: string;
  name: string;
  phone: string;
  email: string;
  phoneNormalized: string | null;
  raw: Record<string, string>;
}

export interface UploadedFile {
  name: string;
  candidatesFound: number;
  validated: boolean;
  candidates: ParsedCandidate[];
  columns: string[];
  invalidPhoneCount: number;
}

export interface AnalyticsMetrics {
  answered: number;
  busy: number;
  rejected: number;
  voicemail: number;
  qualified: number;
  rejectedCandidates: number;
}

export interface CampaignReportSummary {
  totalCandidates: number;
  completedCalls: number;
  failedCalls: number;
  activeCalls: number;
  pendingCalls: number;
  qualifiedCandidates: number;
  campaignProgress: number;
  createdBy: string;
  startedAt: string;
}

export interface CampaignReportCandidateRow {
  name: string;
  phone: string;
  phoneNormalized?: string;
  status: CallStatus;
  callLogId?: number;
  duration?: string;
  omnidimCallStatus?: string;
}

export interface CampaignReport {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  bulkCallId?: number;
  date: string;
  completedAt: string;
  candidates: number;
  status: 'ready' | 'processing';
  summary: CampaignReportSummary;
  candidateRows: CampaignReportCandidateRow[];
  results: CandidateResult[];
}
