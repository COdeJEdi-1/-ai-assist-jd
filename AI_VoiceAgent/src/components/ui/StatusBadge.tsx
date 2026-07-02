import { CallStatus } from '../../types';

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  calling: { label: 'Calling', className: 'status-calling' },
  completed: { label: 'Completed', className: 'status-completed' },
  queued: { label: 'Not Initiated', className: 'status-queued' },
  retry: { label: 'No Answer', className: 'status-retry' },
  failed: { label: 'Failed', className: 'status-failed' },
};

interface StatusBadgeProps {
  status: CallStatus;
  /** Override label — use raw OmniDimension status when provided. */
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-button ${config.className}`}
    >
      {label ?? config.label}
    </span>
  );
}

interface ProgressBarProps {
  value: number;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({ value, animated = true, className = '' }: ProgressBarProps) {
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-grey-border ${className}`}>
      <div
        className={`h-full rounded-full bg-maroon transition-all duration-700 ease-out ${
          animated ? 'bg-gradient-to-r from-maroon via-maroon-hover to-maroon bg-[length:200%_100%] animate-progress' : ''
        }`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card bg-surface-card p-6 shadow-card">
      <Skeleton className="mb-4 h-8 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
