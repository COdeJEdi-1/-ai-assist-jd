import { X, CheckCircle2 } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | ReactNode;
  children?: ReactNode;
  showSuccessIcon?: boolean;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  showSuccessIcon = false,
  primaryAction,
  secondaryAction,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-md animate-slide-up rounded-popup bg-surface-card p-8 shadow-card-hover"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-grey-secondary transition-colors hover:bg-surface-bg hover:text-gray-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {showSuccessIcon && (
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-9 w-9 text-status-success" strokeWidth={1.75} />
            </div>
          </div>
        )}

        <h2 className="text-center text-xl font-heading text-gray-900">{title}</h2>

        {description && (
          <div className="mt-4 text-center text-sm leading-relaxed text-grey-secondary">
            {description}
          </div>
        )}

        {children}

        {(primaryAction || secondaryAction) && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {secondaryAction && (
              <Button variant="secondary" onClick={secondaryAction.onClick} className="flex-1 sm:flex-none">
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button onClick={primaryAction.onClick} className="flex-1 sm:flex-none">
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
