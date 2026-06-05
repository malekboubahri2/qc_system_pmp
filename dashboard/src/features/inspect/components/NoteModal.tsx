import { useState, useEffect } from 'react';
import { TouchButton } from './TouchButton';

interface NoteModalProps {
  open: boolean;
  initial: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

// Pops up the instant the operator taps an "Autre — préciser" defect, so they
// type the detail immediately rather than at the summary.
export function NoteModal({ open, initial, onConfirm, onCancel }: NoteModalProps) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fade-in-up"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-cream rounded-3xl shadow-popover p-[clamp(1.25rem,4vw,1.75rem)] flex flex-col gap-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-fluid-lg font-bold text-brand">Préciser le défaut</h2>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          rows={3}
          placeholder="Décrivez le défaut…"
          className="bg-white border-2 border-cream-subtle rounded-xl px-3.5 py-3 text-fluid-base resize-none
            focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <div className="flex gap-3">
          <TouchButton variant="secondary" block onClick={onCancel}>Annuler</TouchButton>
          <TouchButton block onClick={() => onConfirm(text.trim())} disabled={!text.trim()}>
            Confirmer
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
