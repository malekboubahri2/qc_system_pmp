import { useEffect, useState } from 'react';
import { fetchCheatsheetBlob } from '@/api/products';

interface Props {
  productId: number;
  productName?: string;
  onClose: () => void;
}

/**
 * Full-screen overlay that shows a product's uploaded cheatsheet (PDF or image).
 * The file is auth-gated, so we pull it through the API client as a blob and
 * render an object URL (a bare <img>/<iframe> src carries no auth header).
 * Shared by the admin product page and the inspection PWA.
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <header className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-semibold truncate">
          Fiche défauts{productName ? ` — ${productName}` : ''}
        </span>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg bg-white/15 px-4 py-2 text-lg leading-none hover:bg-white/25"
        >
          ✕
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-auto p-2">
        {failed ? (
          <p className="px-6 text-center text-white/80">
            Document indisponible — vérifiez la connexion.
          </p>
        ) : !url ? (
          <p className="text-white/60">Chargement…</p>
        ) : mime.startsWith('image/') ? (
          <img src={url} alt="Fiche défauts" className="max-h-full max-w-full object-contain" />
        ) : (
          <iframe src={url} title="Fiche défauts" className="h-full w-full rounded bg-white" />
        )}
      </div>
    </div>
  );
}
