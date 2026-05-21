import { useState } from 'react';
import { Database, Globe, Trophy, Mail, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../lib/cn';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import InfoHint from '../ui/InfoHint';
import RecurrencePicker from './RecurrencePicker';
import { inputClass, labelClass, hintClass } from '../ui/field';

const TASK_TYPES = [
  { value: 'api_ninja', label: 'Financial Tracker', desc: 'Crypto, stocks & gold', icon: Database },
  { value: 'price_scraper', label: 'Custom Web Scraper', desc: 'Track any value on any page', icon: Globe, ai: true },
  { value: 'codeforces', label: 'Codeforces Contests', desc: 'Upcoming contest list', icon: Trophy },
  { value: 'send_email', label: 'Automated Email', desc: 'Send a scheduled email', icon: Mail },
];

const CRYPTO = [['BTCUSDT', 'Bitcoin'], ['ETHUSDT', 'Ethereum'], ['SOLUSDT', 'Solana']];
const STOCKS = [['AAPL', 'Apple'], ['NVDA', 'NVIDIA'], ['TSLA', 'Tesla']];
const COOLDOWNS = [[10, '10 minutes'], [30, '30 minutes'], [60, '1 hour'], [360, '6 hours']];

const SELECTOR_HELP =
  'A CSS selector points at the element to read. In Chrome: right-click the value on the page → Inspect → right-click the highlighted HTML → Copy → Copy selector.';
const THRESHOLD_HELP =
  'You get an email when the tracked value crosses this. Leave it blank to just record the value without alerting.';
const AI_HELP =
  'Describe what the AI should do with the scraped text. Whatever you ask for is emailed back verbatim — the numeric threshold is ignored when this is set.';

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
      <p className="text-xs font-semibold text-textMain flex items-center gap-1.5">
        Alert threshold <span className="text-textFaint font-normal">(optional)</span>
        <InfoHint text={THRESHOLD_HELP} />
      </p>
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
          <div className="grid grid-cols-2 gap-2">
            {TASK_TYPES.map((t) => {
              const active = jobType === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setJobType(t.value)}
                  className={cn(
                    'relative text-left rounded-xl border p-3 transition-colors',
                    active ? 'border-accent bg-accent/10' : 'border-border hover:bg-elevated'
                  )}
                >
                  {t.ai && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-accent text-white">
                      AI
                    </span>
                  )}
                  <t.icon className={cn('w-4 h-4', active ? 'text-accent' : 'text-textMuted')} />
                  <p className="text-sm font-medium mt-2">{t.label}</p>
                  <p className="text-xs text-textMuted mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
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
              <label className={cn(labelClass, 'flex items-center gap-1.5')}>
                CSS selector <InfoHint text={SELECTOR_HELP} />
              </label>
              <input placeholder=".price" value={f.selector} onChange={(e) => set('selector', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input placeholder="What you're tracking" value={f.label} onChange={(e) => set('label', e.target.value)} className={inputClass} required />
            </div>
            <ThresholdBlock f={f} set={set} />
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-accent flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Pipeline
                <span className="text-accent/60 font-normal">(optional)</span>
                <InfoHint text={AI_HELP} />
              </p>
              <textarea
                placeholder="e.g. Summarise the scraped text in one line."
                value={f.aiInstructions}
                onChange={(e) => set('aiInstructions', e.target.value)}
                className={cn(inputClass, 'h-20 resize-none')}
              />
              <p className={hintClass}>When set, the AI handles the page and emails you its full reply — the threshold above is skipped.</p>
            </div>
          </div>
        )}

        {jobType === 'codeforces' && (
          <div className="space-y-2">
            <p className="text-sm text-textMuted">Fetches the list of upcoming Codeforces contests on each run.</p>
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
