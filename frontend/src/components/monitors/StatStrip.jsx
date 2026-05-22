import { useEffect, useState } from 'react';
import { Radio, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../api/axios';
import { cn } from '../../lib/cn';

export default function StatStrip({ refreshKey }) {
  const [stats, setStats] = useState({ activeMonitors: 0, tasksExecuted: 0, tasksFailed: 0 });

  useEffect(() => {
    api.get('/stats')
      .then(({ data }) => data.success && setStats(data.data))
      .catch(() => {});
  }, [refreshKey]);

  const cards = [
    { label: 'Active monitors', value: stats.activeMonitors, icon: Radio, color: 'text-accent', glow: 'bg-accent/10' },
    { label: 'Executed', value: stats.tasksExecuted, icon: CheckCircle2, color: 'text-cyan-400', glow: 'bg-cyan-400/10' },
    { label: 'Failed', value: stats.tasksFailed, icon: XCircle, color: 'text-red-400', glow: 'bg-red-400/10' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="panel rounded-xl p-4 flex items-center gap-4">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', c.glow)}>
            <c.icon className={cn('w-5 h-5', c.color)} />
          </div>
          <div>
            <div className="text-textMuted text-xs font-medium">{c.label}</div>
            <div className="text-2xl font-bold mt-0.5 tabular-nums">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
