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
