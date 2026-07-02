import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-maroon text-white hover:bg-maroon-hover border-transparent',
  secondary:
    'bg-white text-gray-800 border-grey-border hover:bg-surface-bg',
  danger:
    'bg-status-error text-white hover:bg-red-700 border-transparent',
  success:
    'bg-status-success text-white hover:bg-green-600 border-transparent',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading, className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          ripple inline-flex items-center justify-center gap-2
          rounded-button border px-5 py-2.5
          font-button text-sm transition-all duration-200
          disabled:cursor-not-allowed disabled:opacity-50
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
