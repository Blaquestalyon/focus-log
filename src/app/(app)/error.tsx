'use client';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SparkleOutline } from '@/components/ui/brand';

/** Crash fallback (§4 App shell). */
export default function ScreenError() {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-20 text-center">
      <SparkleOutline size={40} className="mb-4" />
      <h2 className="card-heading text-text-primary">Something went wrong on this screen.</h2>
      <p className="mt-2 max-w-md text-sm text-text-secondary">Your timer is safe — it runs on the server. Reload to try again.</p>
      <Button variant="primary" className="mt-6" icon={<RotateCw className="size-4" aria-hidden />} onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
