import { cn } from '../../lib/cn';

const variants = {
  primary: 'bg-accent hover:bg-accent-hover text-white btn-glow',
  ghost: 'border border-border text-textMain hover:bg-elevated hover:border-[#322f3d]',
  subtle: 'text-textMuted hover:text-textMain hover:bg-elevated',
  danger: 'text-textMuted hover:text-red-400 hover:bg-red-400/10',
};

export default function Button({ variant = 'primary', className, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg',
        'px-4 py-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
