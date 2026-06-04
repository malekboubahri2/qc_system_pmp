import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-ink-inverse hover:bg-brand-dark active:bg-brand-deep',
  secondary: 'bg-white text-brand border border-cream-subtle hover:bg-cream',
  ghost: 'bg-transparent text-ink-muted hover:text-brand',
  danger: 'bg-danger text-white hover:opacity-90',
};

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}

// Large touch target (min 56px tall) for tablet/kiosk use.
export function TouchButton({
  variant = 'primary', block = false, className = '', children, ...rest
}: TouchButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'min-h-[56px] px-6 rounded-lg text-lg font-semibold',
        'transition-colors disabled:opacity-40 disabled:pointer-events-none',
        'flex items-center justify-center gap-2 select-none',
        VARIANTS[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
