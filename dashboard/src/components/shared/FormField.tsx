import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink-heading">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      <input
        ref={ref}
        className={cn(
          'bg-white border rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
          error ? 'border-danger' : 'border-cream-subtle',
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-sm text-ink-muted">{hint}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  ),
);
FormField.displayName = 'FormField';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, required, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink-heading">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      <select
        ref={ref}
        className={cn(
          'bg-white border rounded-lg px-3 py-2.5 text-sm text-ink',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
          error ? 'border-danger' : 'border-cream-subtle',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  ),
);
SelectField.displayName = 'SelectField';
