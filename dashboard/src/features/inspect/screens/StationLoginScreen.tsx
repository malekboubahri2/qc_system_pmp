import { useState, type FormEvent } from 'react';
import { config } from '@/config';
import { useStationSession } from '../station-session';
import { TouchButton } from '../components/TouchButton';

// One-time station sign-in for the tablet. After this, inspectors use the
// operator + PIN flow; the station token persists across reboots.
export function StationLoginScreen() {
  const { login } = useStationSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError('Identifiants invalides');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-brand px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-cream rounded-2xl shadow-elevated p-8 flex flex-col gap-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand tracking-tighter">
            {config.plantName}
          </h1>
          <p className="text-ink-muted mt-1">Configuration du poste</p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-head">
          Compte poste
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white border border-cream-subtle rounded-lg px-3 py-3 text-base
              focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            placeholder="poste@qc.local"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-head">
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white border border-cream-subtle rounded-lg px-3 py-3 text-base
              focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            required
          />
        </label>

        {error && <p className="text-sm text-danger text-center">{error}</p>}

        <TouchButton type="submit" block disabled={busy}>
          {busy ? 'Connexion…' : 'Activer le poste'}
        </TouchButton>
      </form>
    </div>
  );
}
