import { type LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
}

export function Icon({ icon: LucideComponent, size = 20, className }: IconProps) {
  return <LucideComponent size={size} strokeWidth={1.5} className={className} />;
}
