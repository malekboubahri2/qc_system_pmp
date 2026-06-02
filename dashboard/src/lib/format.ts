import { config } from '@/config';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(config.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(config.locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(config.locale).format(n);
}

/** Time of day (HH:MM) in the browser's local timezone. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(config.locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** French "il y a …" relative label from an ISO instant to now. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `il y a ${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}
