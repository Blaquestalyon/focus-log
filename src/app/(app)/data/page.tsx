import { Suspense } from 'react';
import { DataScreen } from '@/components/data/data-screen';

export default function DataPage() {
  return (
    <Suspense>
      <DataScreen />
    </Suspense>
  );
}
