import { useEffect, useRef, useState } from 'react';

const prefersReduced =
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// Animates a number from its previous value to the new one (easeOutCubic).
// Respects prefers-reduced-motion (jumps straight to the value).
export function CountUp({ value, duration = 750 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(prefersReduced ? value : 0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{display.toLocaleString('fr-FR')}</>;
}
