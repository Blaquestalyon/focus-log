import { Suspense } from 'react';
import { ReportsScreen } from '@/components/reports/reports-screen';

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
