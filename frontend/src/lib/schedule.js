// Format any date as a local YYYY-MM-DDTHH:MM string for datetime-local inputs.
export function toDatetimeLocal(d) {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nowLocalDatetime() {
  return toDatetimeLocal(new Date());
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Friendly recurrence choice -> cron string. The frontend never shows raw cron.
export function buildCron(freq, time, weekday) {
  const [h, m] = (time || '09:00').split(':').map(Number);
  switch (freq) {
    case 'minute': return '* * * * *';
    case 'hour': return '0 * * * *';
    case 'day': return `${m} ${h} * * *`;
    case 'week': return `${m} ${h} * * ${weekday}`;
    default: return '0 * * * *';
  }
}

// cron string -> human label, for displaying a monitor's schedule.
export function cronLabel(cron) {
  if (!cron) return 'One-time';
  if (cron === '* * * * *') return 'Every minute';
  if (cron === '0 * * * *') return 'Every hour';
  const parts = cron.trim().split(/\s+/);
  if (parts.length === 5) {
    const [m, h, , , dow] = parts;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (dow === '*') return `Daily at ${time}`;
    const day = DAYS[Number(dow)];
    return day ? `${day}s at ${time}` : cron;
  }
  return cron;
}
