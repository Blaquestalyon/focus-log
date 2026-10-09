import { Suspense } from 'react';
import { TimerScreen } from '@/components/timer/timer-screen';

export default function TimerPage() {
  return (
    <Suspense>
      <TimerScreen />
    </Suspense>
  );
}
