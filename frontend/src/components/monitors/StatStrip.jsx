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
    { label: 'Active monitors', value: stats.activeMonitors, icon: Radio, color: 'text-accent' },
    { label: 'Executed', value: stats.tasksExecuted, icon: CheckCircle2, color: 'text-cyan-400' },
    { label: 'Failed', value: stats.tasksFailed, icon: XCircle, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-background border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-textMuted text-xs font-medium">
            <c.icon className={cn('w-4 h-4', c.color)} />
            {c.label}
          </div>
          <div className="text-2xl font-bold mt-2">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
