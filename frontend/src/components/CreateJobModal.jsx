import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function CreateJobModal({ isOpen, onClose, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [jobType, setJobType] = useState('api_ninja');
  
  // Scheduling States
  const [scheduleType, setScheduleType] = useState('cron');
  const [cronExpression, setCronExpression] = useState('* * * * *');
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Payload States
  const [payload, setPayload] = useState({
    type: 'crypto',
    symbol: 'BTCUSDT',
    to: '',
    subject: '',
    body: '',
    url: '',
    selector: '',
    metricName: '',
    condition: 'less_than', 
    targetValue: '',
    emailTo: '',
    textToSummarize: '',
    tone: 'professional',
    taskName: '',
    description: ''
  });

  if (!isOpen) return null;

  const handleAssetCategoryChange = (newType) => {
    let defaultSymbol = '';
    if (newType === 'crypto') defaultSymbol = 'BTCUSDT';
    if (newType === 'stock') defaultSymbol = 'AAPL';
    if (newType === 'binance_gold') defaultSymbol = 'PAXGUSDT';

    setPayload({ ...payload, type: newType, symbol: defaultSymbol });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    let finalPayload = {};
    let finalJobType = jobType; 

    if (jobType === 'api_ninja') {
      finalPayload = {
        type: payload.type,
        symbol: payload.symbol,
        guard: {
          metricName: payload.metricName || payload.symbol,
          condition: payload.condition,
          targetValue: Number(payload.targetValue),
          emailTo: payload.emailTo, // Now safely passes empty strings
          cooldownMinutes: 60
        }
      };
    } else if (jobType === 'send_email') {
      finalPayload = { to: payload.to, subject: payload.subject, body: payload.body };
    } else if (jobType === 'price_scraper') {
      finalPayload = { 
        url: payload.url, 
        selector: payload.selector, 
        label: payload.metricName, 
        aiInstructions: payload.aiInstructions,
        guard: {
          metricName: payload.metricName,
          condition: payload.condition,
          targetValue: Number(payload.targetValue),
          emailTo: payload.emailTo, // Now safely passes empty strings
          cooldownMinutes: 60
        }
      };
    } else if (jobType === 'content_summary') {
      finalPayload = {
        textToSummarize: payload.textToSummarize,
        tone: payload.tone,
        emailTo: payload.emailTo // Now safely passes empty strings
      };
    } else if (jobType === 'codeforces') {
      finalJobType = 'api_ninja';
      finalPayload = {
        type: 'codeforces',
        label: 'Codeforces Contests',
        emailResultsTo: payload.emailTo // optional; blank = dashboard-only
      };
    } else if (jobType === 'reminder') {
      finalJobType = 'send_email';
      finalPayload = { 
        to: payload.emailTo, 
        subject: `🔔 Sentinel Reminder: ${payload.taskName}`, 
        body: `It is time for your scheduled task:\n\nTask: ${payload.taskName}\nDetails: ${payload.description || 'No additional details provided.'}\n\nStay productive!` 
      };
    }

    try {
      await api.post('/jobs', {
        jobType: finalJobType,
        payload: finalPayload,
        cronExpression: scheduleType === 'cron' ? cronExpression : undefined,
        scheduledAt: scheduleType === 'static' ? scheduledAt : undefined,
        timezone
      });

      toast.success('Task deployed successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-bold text-textMain">Deploy New Task</h2>
          <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Task Type</label>
            <select 
              value={jobType} 
              onChange={(e) => setJobType(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-textMain focus:outline-none focus:border-primary"
            >
              <optgroup label="System Monitors">
                <option value="api_ninja">Financial Asset Tracker (Crypto/Stocks)</option>
                <option value="price_scraper">Website Price Scraper</option>
                <option value="codeforces">Codeforces Contests</option>
              </optgroup>
              <optgroup label="AI & Automation">
                <option value="content_summary">AI Market Sentiment Analyst</option>
                <option value="send_email">Automated Email Dispatch</option>
              </optgroup>
              <optgroup label="Personal Tools">
                <option value="reminder">Static Task / Reminder (To-Do)</option>
              </optgroup>
            </select>
          </div>

          <div className="bg-background/50 p-4 rounded-xl border border-border space-y-4">
            <h3 className="text-sm font-medium text-textMain mb-2 border-b border-border pb-2">Configuration</h3>
            
            {jobType === 'api_ninja' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-textMuted mb-1">Asset Category</label>
                    <select value={payload.type} onChange={(e) => handleAssetCategoryChange(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="crypto">Cryptocurrency</option>
                      <option value="stock">US Stocks</option>
                      <option value="binance_gold">Gold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-textMuted mb-1">Ticker Symbol</label>
                    {payload.type === 'binance_gold' ? (
                      <input type="text" value="PAXGUSDT (Binance)" disabled className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed" />
                    ) : (
                      <select value={payload.symbol} onChange={(e) => setPayload({...payload, symbol: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm">
                        {payload.type === 'crypto' && (
                          <>
                            <option value="BTCUSDT">Bitcoin (BTCUSDT)</option>
                            <option value="ETHUSDT">Ethereum (ETHUSDT)</option>
                            <option value="SOLUSDT">Solana (SOLUSDT)</option>
                          </>
                        )}
                        {payload.type === 'stock' && (
                          <>
                            <option value="AAPL">Apple (AAPL)</option>
                            <option value="NVDA">NVIDIA (NVDA)</option>
                            <option value="TSLA">Tesla (TSLA)</option>
                          </>
                        )}
                      </select>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-primary mb-3">Alert Threshold (Auto-Guard)</p>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <select value={payload.condition} onChange={(e) => setPayload({...payload, condition: e.target.value})} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="less_than">Drops Below</option>
                      <option value="greater_than">Spikes Above</option>
                    </select>
                    <input type="number" placeholder="Target Price (e.g. 60000)" value={payload.targetValue} onChange={(e) => setPayload({...payload, targetValue: e.target.value})} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <input type="email" placeholder="Alert Email Address (Optional - Leave blank to just log data)" value={payload.emailTo} onChange={(e) => setPayload({...payload, emailTo: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
              </>
            )}

            {jobType === 'codeforces' && (
              <>
                <p className="text-xs text-textMuted mb-3">
                  Fetches the list of upcoming Codeforces contests (name, start time, duration) each run.
                </p>
                <label className="block text-xs text-textMuted mb-1">Email the contest list to (Optional - leave blank to just show on dashboard)</label>
                <input type="email" placeholder="your-email@gmail.com" value={payload.emailTo} onChange={(e) => setPayload({...payload, emailTo: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
              </>
            )}

            {jobType === 'send_email' && (
              <>
                <input type="email" placeholder="Recipient Email" value={payload.to} onChange={(e) => setPayload({...payload, to: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-3" required />
                <input type="text" placeholder="Subject Line" value={payload.subject} onChange={(e) => setPayload({...payload, subject: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-3" required />
                <textarea placeholder="Email Body" value={payload.body} onChange={(e) => setPayload({...payload, body: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm h-24" required />
              </>
            )}

            {jobType === 'price_scraper' && (
              <>
                <input type="url" placeholder="Website URL" value={payload.url} onChange={(e) => setPayload({...payload, url: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-3" required />
                <input type="text" placeholder="CSS Selector (e.g. [itemprop='price'])" value={payload.selector} onChange={(e) => setPayload({...payload, selector: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-3" required />
                <input type="text" placeholder="Label (e.g. Amazon Laptop)" value={payload.metricName} onChange={(e) => setPayload({...payload, metricName: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" required />
                
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-primary mb-3">Alert Threshold</p>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <select value={payload.condition} onChange={(e) => setPayload({...payload, condition: e.target.value})} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm">
                      <option value="less_than">Drops Below</option>
                      <option value="greater_than">Spikes Above</option>
                    </select>
                    <input type="number" placeholder="Target Price" value={payload.targetValue} onChange={(e) => setPayload({...payload, targetValue: e.target.value})} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm"  />
                  </div>
                  {/* 🌟 REMOVED REQUIRED, CHANGED LABEL TO OPTIONAL */}
                  <input type="email" placeholder="Alert Email Address (Optional)" value={payload.emailTo} onChange={(e) => setPayload({...payload, emailTo: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
                </div>
                          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs font-semibold text-purple-400 mb-3">🧠 AI Pipeline (Optional Override)</p>
            <label className="block text-xs text-textMuted mb-1">Custom AI Instructions</label>
            <textarea 
              placeholder="e.g. 'You are a recruiter. Score this job description...'" 
              value={payload.aiInstructions || ''} 
              onChange={(e) => setPayload({...payload, aiInstructions: e.target.value})} 
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm h-20 mb-3" 
            />
            <p className="text-xs text-textMuted italic">Note: If you use AI, the Guard threshold above will be ignored, and the AI will email you its report directly.</p>
          </div>
              </>
            )}

            {jobType === 'content_summary' && (
              <>
                <label className="block text-xs text-textMuted mb-1">Text to Analyze (News/Tweets/Reports)</label>
                <textarea placeholder="Paste market news or a CEO quote here..." value={payload.textToSummarize} onChange={(e) => setPayload({...payload, textToSummarize: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm h-32 mb-3" required />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-textMuted mb-1">Analysis Type</label>
                    <select value={payload.tone} onChange={(e) => setPayload({...payload, tone: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed" disabled>
                      <option value="professional">Quant Sentiment Score</option>
                    </select>
                  </div>
                  <div>
                    {/* 🌟 REMOVED REQUIRED, CHANGED LABEL TO OPTIONAL */}
                    <label className="block text-xs text-textMuted mb-1">Send Alert To (Optional)</label>
                    <input type="email" placeholder="your-email@gmail.com" value={payload.emailTo} onChange={(e) => setPayload({...payload, emailTo: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            )}

            {jobType === 'reminder' && (
              <>
                <input type="text" placeholder="Task Name (e.g. Submit DSA Assignment)" value={payload.taskName} onChange={(e) => setPayload({...payload, taskName: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-3" required />
                <textarea placeholder="Optional Details or Notes..." value={payload.description} onChange={(e) => setPayload({...payload, description: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm h-20 mb-3" />
                <label className="block text-xs text-textMuted mb-1">Email for Notification</label>
                <input type="email" placeholder="your-email@gmail.com" value={payload.emailTo} onChange={(e) => setPayload({...payload, emailTo: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" required />
              </>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-textMain border-b border-border pb-2">Scheduling Engine</h3>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer">
                <input type="radio" checked={scheduleType === 'cron'} onChange={() => setScheduleType('cron')} className="accent-primary" />
                Recurring (CRON)
              </label>
              <label className="flex items-center gap-2 text-sm text-textMuted cursor-pointer">
                <input type="radio" checked={scheduleType === 'static'} onChange={() => setScheduleType('static')} className="accent-primary" />
                One-Time Execution
              </label>
            </div>

            {scheduleType === 'cron' ? (
              <input type="text" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="* * * * *" className="w-full bg-background border border-border rounded-lg px-4 py-2.5" required />
            ) : (
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2.5" required />
            )}

            <div>
              <label className="block text-xs text-textMuted mb-1">Execution Timezone</label>
              <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm opacity-70" />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-textMain hover:bg-background transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-50">
              {isLoading ? 'Deploying...' : 'Deploy Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}