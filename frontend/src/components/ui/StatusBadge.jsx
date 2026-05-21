import { cn } from '../../lib/cn';

const styles = {
  pending: 'bg-accent/15 text-accent border-accent/30',
  queued: 'bg-accent/15 text-accent border-accent/30',
  processing: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  completed: 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30',
  failed: 'bg-red-400/15 text-red-400 border-red-400/30',
  paused: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
        styles[status] || styles.pending
      )}
    >
      {status}
    </span>
  );
}
