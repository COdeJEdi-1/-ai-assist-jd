import { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'running';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-status-success',
  warning: 'bg-orange-50 text-status-warning',
  error: 'bg-red-50 text-status-error',
  info: 'bg-blue-50 text-status-info',
  running: 'bg-maroon/10 text-maroon',
  default: 'bg-gray-100 text-grey-secondary',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-3 py-1
        text-xs font-button uppercase tracking-wide
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
