import { LucideIcon } from 'lucide-react';
import { CSSProperties, ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  delay?: number;
}

export function StatCard({ title, value, icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className="group animate-slide-up rounded-card bg-surface-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-heading text-gray-900">{value}</p>
          <p className="mt-2 text-sm text-grey-secondary">{title}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/8 text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: CSSProperties;
}

export function Card({ children, className = '', hover = false, style }: CardProps) {
  return (
    <div
      style={style}
      className={`
        rounded-card bg-surface-card p-6 shadow-card
        ${hover ? 'transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
