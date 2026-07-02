interface ArvindGccBrandProps {
  variant?: 'dark' | 'light';
  showSubtitle?: boolean;
  className?: string;
}

function LogoMark({ variant }: { variant: 'dark' | 'light' }) {
  if (variant === 'dark') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[1.65rem] font-semibold tracking-tight leading-none text-white">
          Arvind
        </span>
        <span className="h-7 w-px shrink-0 rounded-full bg-white/75" />
        <span className="text-lg font-bold tracking-[0.14em] leading-none text-white/90">GCC</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[1.35rem] font-semibold tracking-tight leading-none text-[#991B32]">
        Arvind
      </span>
      <span className="h-6 w-px shrink-0 rounded-full bg-[#9CA3AF]" />
      <span className="text-[0.95rem] font-bold tracking-[0.16em] leading-none text-[#6B7280]">
        GCC
      </span>
    </div>
  );
}

export function ArvindGccBrand({
  variant = 'dark',
  showSubtitle = true,
  className = '',
}: ArvindGccBrandProps) {
  const onDark = variant === 'dark';

  return (
    <div className={className} aria-label="Arvind GCC">
      <LogoMark variant={variant} />
      {showSubtitle && (
        <p
          className={`font-medium tracking-[0.04em] ${
            onDark
              ? 'mt-3 text-lg text-white/90'
              : 'mt-1.5 text-sm text-grey-secondary'
          }`}
        >
          HR Platform
        </p>
      )}
    </div>
  );
}
