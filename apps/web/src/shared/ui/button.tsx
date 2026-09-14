import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

const styles: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-400',
  secondary:
    'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 disabled:text-zinc-400',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded px-3 py-2 text-sm font-medium transition ${styles[variant]} ${className}`}
    />
  );
}
