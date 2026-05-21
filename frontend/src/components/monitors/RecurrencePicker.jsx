import { useState, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { nowLocalDatetime, buildCron } from '../../lib/schedule';
import { inputClass } from '../ui/field';

const FREQS = [
  { value: 'minute', label: 'Every minute' },
  { value: 'hour', label: 'Every hour' },
  { value: 'day', label: 'Every day' },
  { value: 'week', label: 'Every week' },
];

const WEEKDAYS = [
  ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'],
  ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday'],
];

// Calls onChange with either { scheduledAt } or { cronExpression }.
export default function RecurrencePicker({ onChange }) {
  const [mode, setMode] = useState('recurring');
  const [onceAt, setOnceAt] = useState(nowLocalDatetime());
  const [freq, setFreq] = useState('hour');
  const [time, setTime] = useState('09:00');
  const [weekday, setWeekday] = useState('1');

  useEffect(() => {
    if (mode === 'once') {
      onChange({ scheduledAt: onceAt });
    } else {
      onChange({ cronExpression: buildCron(freq, time, weekday) });
    }
    // onChange intentionally omitted — parent passes a stable setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onceAt, freq, time, weekday]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-background border border-border rounded-lg">
        {[['recurring', 'Recurring'], ['once', 'One-time']].map(([m, label]) => (
          <button
            type="button"
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 text-sm py-1.5 rounded-md transition-colors',
              mode === m ? 'bg-accent text-white' : 'text-textMuted hover:text-textMain'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'once' ? (
        <input
          type="datetime-local"
          value={onceAt}
          onChange={(e) => setOnceAt(e.target.value)}
          className={inputClass}
        />
      ) : (
        <div className="space-y-3">
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className={inputClass}>
            {FREQS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {(freq === 'day' || freq === 'week') && (
            <div className="flex gap-3">
              {freq === 'week' && (
                <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className={inputClass}>
                  {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
