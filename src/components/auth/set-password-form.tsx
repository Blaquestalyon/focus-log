'use client';
/** Set password from the emailed one-time link (§4 "Screen: Set password"). */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Link2Off } from 'lucide-react';
import { AuthCard } from './auth-card';
import { PasswordInput } from './password-input';
import { Banner } from './sign-in-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/form';
import { api, ApiError, messageOf } from '@/lib/client/api';
import { toastAfterNavigation } from '@/lib/client/toast';

function pwError(p: string): string | null {
  if (p.length < 10) return 'Use at least 10 characters.';
  if (p.length > 72) return 'Use 72 characters or fewer.';
  return null;
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <div className="anim-crossfade flex flex-col items-center text-center">
      <Link2Off className="mb-3 size-10 text-text-muted" strokeWidth={1.5} aria-hidden />
      <h2 className="card-heading text-text-primary">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
      <Link
        href="/sign-in?link=1"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-fast hover:bg-accent-hover active:bg-accent-pressed"
      >
        Send a new link
      </Link>
    </div>
  );
}

export function SetPasswordForm() {
  const sp = useSearchParams();
  const token = sp.get('token_hash');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const cRef = useRef<HTMLInputElement>(null);
  const title = <span className="page-title text-gold block">Set your password</span>;

  if (!token) {
    return (
      <AuthCard title={title}>
        <Dead title="This link is incomplete." body="Open the link from your email again, or send yourself a new one." />
      </AuthCard>
    );
  }
  if (expired) {
    return (
      <AuthCard title={title}>
        <Dead title="This link has expired or was already used." body="Links work once, for 60 minutes. Send yourself a new one." />
      </AuthCard>
    );
  }

  const submit = async () => {
    const e = { pw: pwError(pw), confirm: confirm !== pw ? "The two passwords don't match." : null };
    setErrors(e);
    setBanner(null);
    if (e.pw) return pwRef.current?.focus();
    if (e.confirm) return cRef.current?.focus();
    setBusy(true);
    try {
      await api('/api/auth/set-password', { method: 'POST', body: { token_hash: token, type: 'recovery', password: pw }, noAuthRedirect: true });
      toastAfterNavigation("Password set. You're signed in.");
      window.location.assign('/');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LINK_INVALID') setExpired(true);
      else if (err instanceof ApiError && err.field === 'password') setErrors({ pw: err.message });
      else setBanner(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <AuthCard title={title}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="New password" error={errors.pw} hint="At least 10 characters. A short phrase works well.">
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              ref={pwRef}
              id={id}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onBlur={() => pw && setErrors((x) => ({ ...x, pw: pwError(pw) }))}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              ref={cRef}
              id={id}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => confirm && setErrors((x) => ({ ...x, confirm: confirm !== pw ? "The two passwords don't match." : null }))}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        {banner ? <Banner>{banner}</Banner> : null}
        <Button type="submit" variant="primary" block loading={busy}>
          {busy ? 'Setting password…' : 'Set password'}
        </Button>
      </form>
    </AuthCard>
  );
}
