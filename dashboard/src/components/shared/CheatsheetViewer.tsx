import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchCheatsheetBlob } from '@/api/products';

interface Props {
  productId: number;
  productName?: string;
  onClose: () => void;
}

/**
 * Full-screen in-app overlay for a product's cheatsheet (PDF or image). Works in
 * a locked kiosk (no popups/new tabs). The file is auth-gated, so we fetch it as
 * a blob and render an object URL. The document fills the whole screen to be as
 * large as possible; a floating close button clears the device notch.
 */
export function CheatsheetViewer({ productId, productName, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchCheatsheetBlob(productId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setMime(blob.type);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId]);

  const isImage = mime.startsWith('image/');
  // PDFs: fit-to-width so a portrait page fills the screen instead of sitting
  // small in the middle (Chrome/Edge PDF viewer reads the URL fragment).
  const src = url ? (isImage ? url : `${url}#view=FitH`) : null;
  const safeTop = 'calc(env(safe-area-inset-top) + 0.5rem)';

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-900">
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
        style={{ top: safeTop, right: 'calc(env(safe-area-inset-right) + 0.5rem)' }}
      >
        <X size={24} />
      </button>
      {productName && (
        <div
          className="pointer-events-none absolute z-10 max-w-[58%] truncate text-sm font-medium text-white/90"
          style={{ top: 'calc(env(safe-area-inset-top) + 0.95rem)', left: 'calc(env(safe-area-inset-left) + 1rem)' }}
        >
          {productName}
        </div>
      )}
      <div className="flex h-full w-full items-center justify-center">
        {failed ? (
          <p className="px-6 text-center text-white/80">Document indisponible — vérifiez la connexion.</p>
        ) : !src ? (
          <p className="text-white/60">Chargement…</p>
        ) : isImage ? (
          <img src={src} alt="Fiche défauts" className="h-full w-full object-contain" />
        ) : (
          <iframe src={src} title="Fiche défauts" className="h-full w-full border-0 bg-white" />
        )}
      </div>
    </div>
  );
}
