import Link from 'next/link';
import { redirect } from 'next/navigation';
import { userClient } from '@/lib/server/supabase';
import { AppProviders } from '@/components/app/providers';
import { EmptyState } from '@/components/ui/feedback';

/**
 * Unknown paths (§4 App shell "Not found"): signed in, the message shows inside the shell;
 * signed out, the visitor goes to Sign in.
 */
export default async function NotFound() {
  const supabase = await userClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/sign-in');
  return (
    <AppProviders email={data.user.email ?? ''}>
      <EmptyState
        className="py-20"
        title="This page doesn't exist."
        body="It may have moved, or the link was mistyped."
        actions={
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-sm bg-accent px-4 text-sm font-semibold text-on-accent transition-fast hover:bg-accent-hover active:bg-accent-pressed"
          >
            Go to Timer
          </Link>
        }
      />
    </AppProviders>
  );
}
