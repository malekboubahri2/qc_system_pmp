import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-ink-inverse hover:bg-brand-dark active:bg-brand-deep shadow-card',
  secondary: 'bg-white text-brand border-2 border-cream-subtle hover:border-accent',
  ghost: 'bg-transparent text-ink-muted hover:text-brand',
  danger: 'bg-danger text-white hover:opacity-90 shadow-card',
};

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}

// Large, comfortable touch target that scales with the screen (kiosk → phone).
export function TouchButton({
  variant = 'primary', block = false, className = '', children, ...rest
}: TouchButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'min-h-[clamp(56px,8.5vh,72px)] px-[clamp(1.5rem,4vw,2.5rem)] rounded-2xl',
        'text-fluid-lg font-semibold tracking-tight',
        'transition-all duration-150 active:scale-[0.97]',
        'disabled:opacity-40 disabled:pointer-events-none',
        'flex items-center justify-center gap-2.5 select-none',
        VARIANTS[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
