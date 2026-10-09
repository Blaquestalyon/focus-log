'use client';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import * as Sw from '@radix-ui/react-switch';
import * as Cb from '@radix-ui/react-checkbox';
import * as Rg from '@radix-ui/react-radio-group';
import * as Sel from '@radix-ui/react-select';
import { Check, ChevronDown, CircleAlert } from 'lucide-react';
import { cn } from './cn';
import { useDropdownLayer } from './layer';

/** Label (14px secondary, 8px above), the control, then an error linked by aria-describedby. */
export function Field({
  label,
  error,
  hint,
  children,
  id,
  className,
  labelHidden,
}: {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  id?: string;
  className?: string;
  labelHidden?: boolean;
}) {
  const auto = useId();
  const fid = id ?? `f${auto}`;
  const errId = `${fid}-err`;
  const hintId = `${fid}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={fid} className={cn('mb-2 text-sm text-text-secondary', labelHidden && 'sr-only')}>
        {label}
      </label>
      {children({ id: fid, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="mt-2 text-meta text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-meta text-danger-text">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export const inputClass =
  'h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-muted transition-fast hover:border-border-strong aria-[invalid=true]:border-danger-text disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(inputClass, className)} {...rest} />;
});

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  describedBy,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  describedBy?: string;
}) {
  return (
    <Sw.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
      className={cn(
        // A 40px (44px on phones) hit area around the 24px track.
        'group/sw relative inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-sm max-md:h-11',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-6 w-10 items-center rounded-pill bg-border-strong transition-fast',
          'group-hover/sw:brightness-125 group-data-[state=checked]/sw:bg-accent group-data-[state=checked]/sw:group-hover/sw:bg-accent-hover',
        )}
      >
        <Sw.Thumb className="block size-4 translate-x-1 rounded-pill bg-text-primary transition-fast data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-accent" />
      </span>
    </Sw.Root>
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  id,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Cb.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface-raised transition-fast',
        'hover:border-text-muted data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      <Cb.Indicator>
        <Check className="size-3 text-on-accent" strokeWidth={3} aria-hidden />
      </Cb.Indicator>
    </Cb.Root>
  );
}

/** Segmented control: JetBrains Mono uppercase labels; selected = accent-subtle + gold text. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Rg.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={label}
      orientation="horizontal"
      loop
      className={cn('inline-flex items-stretch rounded-sm border border-border bg-surface p-0.5', className)}
    >
      {options.map((o, i) => (
        <Rg.Item
          key={o.value}
          value={o.value}
          className={cn(
            'relative inline-flex h-10 items-center justify-center rounded-sm border border-transparent px-3 font-mono max-md:h-11 text-micro uppercase tracking-[0.08em] text-text-muted transition-fast',
            'hover:text-text-secondary',
            'data-[state=checked]:border-accent-subtle-border data-[state=checked]:bg-accent-subtle data-[state=checked]:text-accent-text',
            i > 0 && 'ml-0.5',
          )}
        >
          {o.label}
        </Rg.Item>
      ))}
    </Rg.Root>
  );
}

export interface SelectOption { value: string; label: string; icon?: ReactNode }

export function Select({
  value,
  onValueChange,
  options,
  id,
  placeholder,
  label,
  describedBy,
  disabled,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  label?: string;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  const layer = useDropdownLayer();
  return (
    <Sel.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Sel.Trigger
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        className={cn(inputClass, 'inline-flex items-center justify-between gap-2 text-left', className)}
      >
        <Sel.Value placeholder={placeholder} />
        <Sel.Icon>
          <ChevronDown className="size-4 text-text-muted" aria-hidden />
        </Sel.Icon>
      </Sel.Trigger>
      <Sel.Portal>
        <Sel.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn('anim-menu max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface-raised shadow-overlay', layer)}
        >
          <Sel.Viewport className="p-1">
            {options.map((o) => (
              <Sel.Item
                key={o.value}
                value={o.value}
                className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm text-text-primary outline-none data-[highlighted]:bg-surface-overlay data-[state=checked]:text-accent-text"
              >
                {o.icon}
                <Sel.ItemText>{o.label}</Sel.ItemText>
                <Sel.ItemIndicator className="ml-auto">
                  <Check className="size-4" aria-hidden />
                </Sel.ItemIndicator>
              </Sel.Item>
            ))}
          </Sel.Viewport>
        </Sel.Content>
      </Sel.Portal>
    </Sel.Root>
  );
}
