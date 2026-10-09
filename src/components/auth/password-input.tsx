'use client';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/form';
import { IconButton } from '@/components/ui/button';

/** Password field with a show/hide icon button inside it. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <div className="absolute inset-y-0 right-0 flex items-center">
        <IconButton label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </IconButton>
      </div>
    </div>
  );
});
