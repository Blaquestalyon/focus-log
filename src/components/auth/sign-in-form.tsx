'use client';
/** Sign in (§4 "Screen: Sign in", F1, F2). */
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { CircleAlert, Info, MailCheck } from 'lucide-react';
import { AuthCard } from './auth-card';
import { PasswordInput } from './password-input';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError, messageOf } from '@/lib/client/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(v: string): string | null {
  if (!v.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(v.trim())) return "That doesn't look like an email address.";
  return null;
}

function safeNext(n: string | null): string {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export function SignInForm() {
  const sp = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'link' | 'sent'>(sp.get('link') === '1' ? 'link' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; link?: string | null }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const signIn = async () => {
    const e = { email: emailError(email), password: password ? null : 'Enter your password.' };
    setErrors(e);
    setBanner(null);
    if (e.email) return emailRef.current?.focus();
    if (e.password) return passwordRef.current?.focus();
    setBusy(true);
    try {
      await api('/api/auth/sign-in', { method: 'POST', body: { email: email.trim(), password }, noAuthRedirect: true });
      window.location.assign(safeNext(sp.get('next')));
    } catch (err) {
      setBanner(messageOf(err));
      setBusy(false);
    }
  };

  const sendLink = async () => {
    const err = emailError(email);
    setErrors({ link: err });
    setBanner(null);
    if (err) return linkRef.current?.focus();
    setBusy(true);
    try {
      await api('/api/auth/password-link', { method: 'POST', body: { email: email.trim() }, noAuthRedirect: true });
      setMode('sent');
    } catch (e) {
      if (e instanceof ApiError && e.field === 'email') setErrors({ link: e.message });
      else setBanner(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const title = <span className="lettering text-gold block text-h1">Focus Log</span>;

  if (mode === 'sent') {
    return (
      <AuthCard title={title}>
        <div key="sent" className="anim-crossfade flex flex-col items-center text-center">
          <MailCheck className="mb-3 size-8 text-accent-text" aria-hidden />
          <h2 className="card-heading text-text-primary">Check your inbox.</h2>
          <p className="mt-2 text-sm text-text-secondary">
            If that address has a Focus Log account, a link to set your password is on its way. It works once, for 60 minutes.
          </p>
          <Button variant="ghost" className="mt-6" onClick={() => setMode('signin')}>
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (mode === 'link') {
    return (
      <AuthCard title={title}>
        <form
          key="link"
          noValidate
          className="anim-crossfade flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendLink();
          }}
        >
          <h2 className="card-heading text-center text-text-primary">Get a link to set your password</h2>
          <Field label="Email" error={errors.link}>
            {({ id, describedBy, invalid }) => (
              <Input
                ref={linkRef}
                id={id}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email && setErrors({ link: emailError(email) })}
                invalid={invalid}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          {banner ? <Banner>{banner}</Banner> : null}
          <Button type="submit" variant="primary" block loading={busy}>
            Send me a link
          </Button>
          <Button variant="ghost" block onClick={() => { setBanner(null); setMode('signin'); }}>
            Back to sign in
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={title} subtitle="Sign in to your timer.">
      <form
        key="signin"
        noValidate
        className="anim-crossfade flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        {sp.get('expired') === '1' ? (
          <p className="flex items-start gap-2 text-meta text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            You were signed out. Sign in to pick up where you left off — your timer kept running.
          </p>
        ) : null}
        <Field label="Email" error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={emailRef}
              id={id}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => email && setErrors((x) => ({ ...x, email: emailError(email) }))}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              ref={passwordRef}
              id={id}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        {banner ? <Banner>{banner}</Banner> : null}
        <Button type="submit" variant="primary" block loading={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="flex flex-col items-center gap-2 pt-2 text-sm">
          <button type="button" className="text-accent-text underline-offset-2 hover:underline" onClick={() => { setBanner(null); setMode('link'); }}>
            Forgot your password?
          </button>
          <button type="button" className="text-accent-text underline-offset-2 hover:underline" onClick={() => { setBanner(null); setMode('link'); }}>
            First time here? Set your password
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-sm border border-danger-text bg-surface-raised p-3 text-sm text-text-primary">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger-text" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
