import { cn } from '@/lib/utils';

interface AvatarProps {
  initial: string;
  className?: string;
}

/**
 * 40×40 brand-teal circle avatar showing 1–2 initials.
 * Matches .avatar from Frame 1.
 */
export function Avatar({ initial, className }: AvatarProps) {
  return (
    <div
      className={cn(
        'w-10 h-10 rounded-full bg-brand text-white font-semibold text-base',
        'flex items-center justify-center flex-shrink-0 select-none',
        className,
      )}
    >
      {initial.slice(0, 2).toUpperCase()}
    </div>
  );
}
