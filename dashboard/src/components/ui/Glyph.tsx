import { cn } from '@/lib/utils';
import { glyphColor } from '@/lib/glyph-colors';

interface GlyphProps {
  letter: string;
  /** Seed for deterministic color selection — typically the defect label. */
  seed: string;
  /** 'gold' variant for fallback/other defect types. */
  variant?: 'default' | 'gold';
  className?: string;
}

/**
 * 40×40 letter square with deterministic muted background color.
 * Gold variant for fallback (autre) defect types.
 * Matches .glyph from Frame 1.
 */
export function Glyph({ letter, seed, variant = 'default', className }: GlyphProps) {
  const bg = variant === 'gold' ? '#D4B765' : glyphColor(seed);
  const color = variant === 'gold' ? '#4a3a14' : '#ffffff';

  return (
    <div
      className={cn(
        'w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0',
        'font-semibold text-base select-none',
        className,
      )}
      style={{ backgroundColor: bg, color }}
    >
      {letter.slice(0, 1).toUpperCase()}
    </div>
  );
}
