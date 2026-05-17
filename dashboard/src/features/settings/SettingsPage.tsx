import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';
import { useFlags, useUpdateFlag } from '@/hooks/useFlags';
import { config } from '@/config';
import type { FeatureFlag } from '@/types';

function FlagRow({ flag, pending }: { flag: FeatureFlag; pending: boolean }) {
  const updateFlag = useUpdateFlag();

  function handleToggle() {
    updateFlag.mutate(
      { name: flag.name, enabled: !flag.enabled, description: flag.description ?? null },
      {
        onSuccess: () =>
          toast.success(`"${flag.name}" ${!flag.enabled ? 'activé' : 'désactivé'}`),
        onError: () => toast.error("Impossible de modifier l'indicateur"),
      },
    );
  }

  return (
    <li className="flex items-center justify-between py-3 border-b border-cream/60 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-mono text-ink">{flag.name}</p>
        {flag.description && (
          <p className="text-xs text-ink-muted mt-0.5">{flag.description}</p>
        )}
      </div>
      <Switch.Root
        checked={flag.enabled}
        onCheckedChange={handleToggle}
        disabled={pending || updateFlag.isPending}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-ink-muted/30"
      >
        <Switch.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      </Switch.Root>
    </li>
  );
}

export function SettingsPage() {
  const { data: flags = [], isPending } = useFlags();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-ink-heading">Paramètres</h1>
        <p className="text-sm text-ink-muted mt-1">Configuration du système</p>
      </div>

      {/* Deployment info */}
      <div className="bg-white rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        <h2 className="text-sm font-semibold text-ink-heading uppercase tracking-wide mb-4">
          Informations de déploiement
        </h2>
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
      <div className="bg-white rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        <h2 className="text-sm font-semibold text-ink-heading uppercase tracking-wide mb-4">
          Indicateurs de fonctionnalité
        </h2>

        {!isPending && flags.length === 0 ? (
          <div className="text-sm text-ink-muted">
            <p className="mb-3">Aucun feature flag configuré. Créez-en un via l'API :</p>
            <pre className="font-mono text-xs bg-cream/40 rounded p-3 overflow-x-auto">{`curl -X PUT ${config.apiBaseUrl}/flags/my_flag \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"enabled": true, "description": "Ma fonctionnalité"}'`}</pre>
          </div>
        ) : (
          <ul>
            {flags.map((flag) => (
              <FlagRow key={flag.name} flag={flag} pending={isPending} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
