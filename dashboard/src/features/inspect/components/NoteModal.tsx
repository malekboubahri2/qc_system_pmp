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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-cream rounded-2xl shadow-elevated p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-brand">Préciser le défaut</h2>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          rows={3}
          placeholder="Décrivez le défaut…"
          className="bg-white border border-cream-subtle rounded-lg px-3 py-3 text-base resize-none
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
