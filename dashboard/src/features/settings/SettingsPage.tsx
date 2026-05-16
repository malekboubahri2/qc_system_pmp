import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { config } from '@/config';
import type { FeatureFlag } from '@/types';

async function listFlags(): Promise<FeatureFlag[]> {
  const { data } = await client.get<FeatureFlag[]>('/feature-flags');
  return data;
}

export function SettingsPage() {
  const { data: flags = [] } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: listFlags,
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-ink-heading">Paramètres</h1>
        <p className="text-sm text-ink-muted mt-1">Configuration du système</p>
      </div>

      {/* Deployment info */}
      <div className="bg-white rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        <h2 className="text-sm font-semibold text-ink-heading uppercase tracking-wide mb-4">Informations de déploiement</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-32 text-ink-muted flex-shrink-0">Installation</dt>
            <dd className="text-ink font-medium">{config.plantName}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 text-ink-muted flex-shrink-0">Locale</dt>
            <dd className="font-mono text-xs text-ink pt-0.5">{config.locale}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 text-ink-muted flex-shrink-0">API</dt>
            <dd className="font-mono text-xs text-ink pt-0.5">{config.apiBaseUrl}</dd>
          </div>
        </dl>
      </div>

      {/* Feature flags */}
      {flags.length > 0 && (
        <div className="bg-white rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
          <h2 className="text-sm font-semibold text-ink-heading uppercase tracking-wide mb-4">Indicateurs de fonctionnalité</h2>
          <ul className="flex flex-col gap-2">
            {flags.map((flag) => (
              <li key={flag.name} className="flex items-center justify-between py-2 border-b border-cream/60 last:border-0">
                <div>
                  <p className="text-sm font-mono text-ink">{flag.name}</p>
                  {flag.description && (
                    <p className="text-xs text-ink-muted mt-0.5">{flag.description}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    flag.enabled
                      ? 'bg-success/10 text-success'
                      : 'bg-ink-muted/10 text-ink-muted'
                  }`}
                >
                  {flag.enabled ? 'Activé' : 'Désactivé'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
