'use client';
import { Toaster as Sonner } from 'sonner';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useMediaQuery } from '@/lib/client/hooks';

export function Toaster() {
  const mobile = useMediaQuery('(max-width: 47.99rem)');
  return (
    <>
      <Sonner
        position={mobile ? 'bottom-center' : 'bottom-right'}
        visibleToasts={3}
        duration={5000}
        theme="dark"
        icons={{
          success: <CircleCheck className="size-4 text-success" aria-hidden />,
          info: <Info className="size-4 text-signal" aria-hidden />,
          error: <CircleAlert className="size-4 text-danger-text" aria-hidden />,
        }}
        containerAriaLabel="Notifications"
      />
      <div id="fl-assertive" className="sr-only" aria-live="assertive" role="alert" />
    </>
  );
}
