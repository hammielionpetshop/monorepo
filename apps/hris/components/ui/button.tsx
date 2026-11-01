import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  danger: 'bg-danger-fg text-surface hover:opacity-90',
  ghost: 'text-ink-muted hover:bg-canvas',
};
const sizes: Record<Size, string> = { md: 'min-h-11 px-4 text-sm', sm: 'min-h-9 px-3 text-sm' };

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
};

/** Kelas tampilan tombol untuk `<Link>` yang tampil sebagai tombol (tanpa `<button>` di dalam `<a>`). */
export function buttonClass({ variant = 'primary', size = 'md', block = false }: { variant?: Variant; size?: Size; block?: boolean } = {}) {
  return cn('inline-flex items-center justify-center rounded-lg font-medium transition-colors', variants[variant], sizes[size], block && 'w-full');
}

export function Button({
  variant = 'primary', size = 'md', loading = false, block = false, className, children, disabled, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? 'Memproses…' : children}
    </button>
  );
}
