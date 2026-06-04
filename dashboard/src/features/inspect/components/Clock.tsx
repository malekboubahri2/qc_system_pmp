import { useEffect, useState } from 'react';
import { config } from '@/config';

const TZ = 'Africa/Tunis';

function format(now: Date) {
  const date = new Intl.DateTimeFormat(config.locale, {
    weekday: 'short', day: '2-digit', month: 'short', timeZone: TZ,
  }).format(now);
  const time = new Intl.DateTimeFormat(config.locale, {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  }).format(now);
  return { date, time };
}

// Live plant-local date + time, always visible on the kiosk.
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);
  const { date, time } = format(now);
  return (
    <div className="text-right leading-tight">
      <div className="text-lg font-mono font-semibold text-brand tabular-nums">{time}</div>
      <div className="text-xs text-ink-muted capitalize">{date}</div>
    </div>
  );
}
