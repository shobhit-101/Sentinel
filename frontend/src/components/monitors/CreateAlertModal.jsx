import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../lib/cn';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import RecurrencePicker from './RecurrencePicker';
import { inputClass, labelClass, hintClass } from '../ui/field';

const TASK_TYPES = [
  { value: 'api_ninja', label: 'Financial Asset Tracker' },
  { value: 'price_scraper', label: 'Website Price Scraper' },
  { value: 'codeforces', label: 'Codeforces Contests' },
  { value: 'send_email', label: 'Automated Email Dispatch' },
];

const CRYPTO = [['BTCUSDT', 'Bitcoin'], ['ETHUSDT', 'Ethereum'], ['SOLUSDT', 'Solana']];
const STOCKS = [['AAPL', 'Apple'], ['NVDA', 'NVIDIA'], ['TSLA', 'Tesla']];
const COOLDOWNS = [[10, '10 minutes'], [30, '30 minutes'], [60, '1 hour'], [360, '6 hours']];

const initialForm = {
  assetType: 'crypto', symbol: 'BTCUSDT',
  url: '', selector: '', label: '',
  aiInstructions: '',
  condition: 'less_than', targetValue: '', cooldownMinutes: 10, alertEmail: '',
  cfEmail: '',
  to: '', subject: '', body: '',
};

function ThresholdBlock({ f, set }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-xs font-semibold text-accent">Alert threshold (optional)</p>
      <div className="grid grid-cols-2 gap-3">
        <select value={f.condition} onChange={(e) => set('condition', e.target.value)} className={inputClass}>
          <option value="less_than">Drops below</option>
          <option value="greater_than">Rises above</option>
        </select>
        <input
          type="number"
          step="any"
          placeholder="Target value"
          value={f.targetValue}
          onChange={(e) => set('targetValue', e.target.value)}
          className={inputClass}
        />
      </div>
      <input
        type="email"
        placeholder="Alert email"
        value={f.alertEmail}
        onChange={(e) => set('alertEmail', e.target.value)}
        className={inputClass}
      />
      <div>
        <label className="text-xs text-textMuted">Re-alert at most every</label>
        <select
          value={f.cooldownMinutes}
          onChange={(e) => set('cooldownMinutes', Number(e.target.value))}
          className={cn(inputClass, 'mt-1')}
        >
          {COOLDOWNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <p className={hintClass}>Leave the target blank to just track the value without emailing.</p>
    </div>
  );
}

export default function CreateAlertModal({ open, onClose, onCreated }) {
  const [jobType, setJobType] = useState('api_ninja');
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState({ cronExpression: '0 * * * *' });
  const [f, setF] = useState(initialForm);
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const body = { timezone, ...schedule };
    try {
      if (jobType === 'api_ninja') {
        const payload = {
          type: f.assetType,
          symbol: f.assetType === 'binance_gold' ? 'PAXGUSDT' : f.symbol,
        };
        if (String(f.targetValue).trim() !== '') {
          payload.guard = {
            metricName: payload.symbol,
            condition: f.condition,
            targetValue: Number(f.targetValue),
            emailTo: f.alertEmail,
            cooldownMinutes: f.cooldownMinutes,
          };
        }
        body.jobType = 'api_ninja';
        body.payload = payload;
      } else if (jobType === 'price_scraper') {
        const payload = { url: f.url, selector: f.selector, label: f.label };
        if (f.aiInstructions.trim()) payload.aiInstructions = f.aiInstructions.trim();
        payload.guard = {
          metricName: f.label,
          emailTo: f.alertEmail,
          cooldownMinutes: f.cooldownMinutes,
        };
        if (String(f.targetValue).trim() !== '') {
          payload.guard.condition = f.condition;
          payload.guard.targetValue = Number(f.targetValue);
        }
        body.jobType = 'price_scraper';
        body.payload = payload;
      } else if (jobType === 'codeforces') {
        body.jobType = 'api_ninja';
        body.payload = { type: 'codeforces', label: 'Codeforces Contests', emailResultsTo: f.cfEmail };
      } else if (jobType === 'send_email') {
        body.jobType = 'send_email';
        body.payload = { to: f.to, subject: f.subject, body: f.body };
      }
      await api.post('/jobs', body);
      toast.success('Alert created');
      setF(initialForm);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create alert');
    } finally {
      setLoading(false);
    }
  };

  const symbolOptions = f.assetType === 'crypto' ? CRYPTO : STOCKS;

  return (
    <Modal open={open} onClose={onClose} title="Create Alert">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className={labelClass}>Task type</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)} className={inputClass}>
            {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {jobType === 'api_ninja' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Asset</label>
                <select
                  value={f.assetType}
                  onChange={(e) => {
                    const t = e.target.value;
                    set('assetType', t);
                    set('symbol', t === 'crypto' ? 'BTCUSDT' : t === 'stock' ? 'AAPL' : 'PAXGUSDT');
                  }}
                  className={inputClass}
                >
                  <option value="crypto">Cryptocurrency</option>
                  <option value="stock">US Stocks</option>
                  <option value="binance_gold">Gold</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Symbol</label>
                {f.assetType === 'binance_gold' ? (
                  <input value="PAXGUSDT" disabled className={cn(inputClass, 'opacity-50')} />
                ) : (
                  <select value={f.symbol} onChange={(e) => set('symbol', e.target.value)} className={inputClass}>
                    {symbolOptions.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}
                  </select>
                )}
              </div>
            </div>
            <ThresholdBlock f={f} set={set} />
          </div>
        )}

        {jobType === 'price_scraper' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Website URL</label>
              <input type="url" placeholder="https://…" value={f.url} onChange={(e) => set('url', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>CSS selector</label>
              <input placeholder=".price" value={f.selector} onChange={(e) => set('selector', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input placeholder="What you're tracking" value={f.label} onChange={(e) => set('label', e.target.value)} className={inputClass} required />
            </div>
            <ThresholdBlock f={f} set={set} />
            <div>
              <label className={labelClass}>AI instructions (optional)</label>
              <textarea
                placeholder="e.g. Summarise the scraped text in one line."
                value={f.aiInstructions}
                onChange={(e) => set('aiInstructions', e.target.value)}
                className={cn(inputClass, 'h-20 resize-none')}
              />
              <p className={hintClass}>If set, the AI processes the page instead of the threshold.</p>
            </div>
          </div>
        )}

        {jobType === 'codeforces' && (
          <div className="space-y-2">
            <p className="text-sm text-textMuted">Fetches the list of upcoming Codeforces contests each run.</p>
            <div>
              <label className={labelClass}>Email the contest list to (optional)</label>
              <input type="email" placeholder="you@example.com" value={f.cfEmail} onChange={(e) => set('cfEmail', e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {jobType === 'send_email' && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Recipient</label>
              <input type="email" placeholder="you@example.com" value={f.to} onChange={(e) => set('to', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input value={f.subject} onChange={(e) => set('subject', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Body</label>
              <textarea value={f.body} onChange={(e) => set('body', e.target.value)} className={cn(inputClass, 'h-24 resize-none')} required />
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Schedule</label>
          <RecurrencePicker onChange={setSchedule} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creating…' : 'Create Alert'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
