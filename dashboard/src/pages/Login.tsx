import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/shared/Button';
import { Icon } from '@/components/Icon';
import { config } from '@/config';
import { rememberUser, getRememberedUser, forgetUser } from '@/lib/remembered-user';
import { appUrl } from '@/lib/basePath';

const schema = z.object({
  // Admins sign in with an e-mail, operators with a username (ADR-018), so the
  // identifier is any non-empty string — not necessarily an e-mail.
  email: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // The last account that signed in (kept across an idle auto-logout): show a
  // "welcome back" card and ask only for the password.
  const [remembered, setRemembered] = useState(() => getRememberedUser());

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: remembered?.identifier ?? '', password: '' },
  });

  function switchAccount() {
    forgetUser();
    setRemembered(null);
    setValue('email', '');
    setTimeout(() => setFocus('email'), 0);
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    try {
      const me = await login(values.email, values.password);
      rememberUser(values.email, me.operator_name ?? values.email);
      if (me.role === 'operator') {
        // Operators belong in the inspection PWA, not the admin dashboard.
        // Record session start so the PWA scopes Taux NC to this login.
        localStorage.setItem('qc_session_start', new Date().toISOString());
        window.location.href = appUrl('inspect.html');
        return;
      }
      navigate('/', { replace: true });
    } catch {
      setApiError('Identifiants incorrects. Veuillez réessayer.');
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 relative overflow-hidden">
      {/* Brand watermark — faded PMP teal circle behind */}
      <div
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full pointer-events-none select-none"
        style={{ background: 'rgba(26, 85, 96, 0.04)' }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full pointer-events-none select-none"
        style={{ background: 'rgba(26, 85, 96, 0.03)' }}
      />

      {/* Login card */}
      <div
        className="w-full max-w-sm rounded-lg overflow-hidden"
        style={{ boxShadow: '0 8px 24px rgba(26, 85, 96, 0.15)' }}
      >
        {/* Teal header strip */}
        <div className="bg-brand px-8 pt-8 pb-6 flex flex-col items-center gap-4">
          <img src={appUrl('logo.png')} alt="PMP" className="h-20 w-auto" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink-inverse leading-tight">
              Contrôle Qualité
            </h1>
            <p className="text-sm text-ink-inverse/70 mt-1">{config.plantName}</p>
          </div>
        </div>

        {/* Form body */}
        <div className="bg-white px-8 py-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            {/* Identifier — a "welcome back" card when a user is remembered
                (quick re-login after idle auto-logout), else the full field. */}
            {remembered ? (
              <div className="flex flex-col gap-2">
                <input type="hidden" {...register('email')} />
                <div className="flex items-center gap-3 rounded-lg bg-cream/60 border border-cream-sub px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Icon icon={UserRound} size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted leading-none">Bon retour</p>
                    <p className="text-sm font-semibold text-ink-head truncate">{remembered.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={switchAccount}
                  className="self-start text-xs text-brand hover:underline"
                >
                  Se connecter avec un autre compte
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-ink-head">
                  Identifiant ou e-mail
                </label>
                <input
                  id="email"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  {...register('email')}
                  className="bg-white border border-cream-sub rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  placeholder="responsable@pmp.tn  ·  ou  ·  prenom.nom"
                />
                {errors.email && (
                  <p className="text-sm text-danger">{errors.email.message}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-ink-head">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus={!!remembered}
                  {...register('password')}
                  className="w-full bg-white border border-cream-sub rounded-lg px-3 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink-head transition-colors"
                  tabIndex={-1}
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size={16} />
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* API error */}
            {apiError && (
              <p className="text-sm text-danger text-center bg-danger/5 rounded px-3 py-2.5">
                {apiError}
              </p>
            )}

            {/* Submit */}
            <Button type="submit" loading={isSubmitting} className="w-full mt-1">
              Se connecter
            </Button>
          </form>

          {/* Gold accent divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-cream-subtle" />
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#D4B765' }}
            />
            <div className="flex-1 h-px bg-cream-subtle" />
          </div>

          <p className="mt-4 text-center text-xs text-ink-muted">
            Peinture et Métallisation sur Plastique
          </p>
        </div>
      </div>
    </div>
  );
}
