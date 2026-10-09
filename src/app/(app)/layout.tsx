import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { userClient } from '@/lib/server/supabase';
import { AppProviders } from '@/components/app/providers';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await userClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/sign-in');
  return <AppProviders email={data.user.email ?? ''}>{children}</AppProviders>;
}
