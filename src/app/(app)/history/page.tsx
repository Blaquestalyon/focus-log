import { Suspense } from 'react';
import { HistoryScreen } from '@/components/history/history-screen';

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryScreen />
    </Suspense>
  );
}
