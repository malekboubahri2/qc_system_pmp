import { Delete } from 'lucide-react';

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Big numeric keypad for entering an operator PIN on a touchscreen.
export function PinPad({ value, onChange, maxLength = 8, disabled = false }: PinPadProps) {
  function press(d: string) {
    if (disabled || value.length >= maxLength) return;
    onChange(value + d);
  }
  function backspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  const key =
    'h-16 rounded-lg text-2xl font-semibold bg-white text-brand border border-cream-subtle ' +
    'hover:bg-cream active:bg-cream-subtle transition-colors disabled:opacity-40 select-none';

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {KEYS.map((d) => (
        <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>
          {d}
        </button>
      ))}
      <span aria-hidden />
      <button type="button" className={key} onClick={() => press('0')} disabled={disabled}>
        0
      </button>
      <button
        type="button"
        className={key + ' flex items-center justify-center'}
        onClick={backspace}
        disabled={disabled}
        aria-label="Effacer"
      >
        <Delete size={24} />
      </button>
    </div>
  );
}

// Masked dots showing how many digits have been entered.
export function PinDots({ length, max = 6 }: { length: number; max?: number }) {
  return (
    <div className="flex items-center justify-center gap-3 h-8">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={[
            'w-3.5 h-3.5 rounded-full transition-colors',
            i < length ? 'bg-brand' : 'bg-cream-subtle',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
