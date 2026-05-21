import { useEffect, useState, useCallback } from 'react';
import { Database, Globe, Mail, ShieldAlert, Sparkles, Trophy, Clock, Pause, Play, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../lib/cn';
import { cronLabel } from '../../lib/schedule';
import StatusBadge from '../ui/StatusBadge';

function jobIcon(job) {
  const t = job.jobType;
  if (t === 'api_ninja') return job.payload?.type === 'codeforces' ? Trophy : Database;
  if (t === 'price_scraper' || t === 'keyword_alert') return Globe;
  if (t === 'send_email') return Mail;
  if (t === 'condition_guard') return ShieldAlert;
  if (t === 'content_summary') return Sparkles;
  return Clock;
}

function jobTypeLabel(job) {
  const t = job.jobType;
  if (t === 'api_ninja') return job.payload?.type === 'codeforces' ? 'Codeforces' : 'Asset Tracker';
  if (t === 'price_scraper') return 'Web Scraper';
  if (t === 'keyword_alert') return 'Keyword Alert';
  if (t === 'send_email') return 'Email';
  if (t === 'condition_guard') return 'Guard';
  if (t === 'content_summary') return 'AI Analysis';
  return t;
}

function jobTarget(job) {
  const p = job.payload || {};
  return p.symbol || p.url || p.to || p.label || p.metricName || '—';
}

function renderResult(job) {
  if (job.status === 'failed' && job.errorLog) {
    return (
      <div className="text-xs text-red-300 bg-red-400/5 border border-red-400/20 rounded-lg p-3">
        <span className="font-semibold text-red-400">Error: </span>{job.errorLog}
      </div>
    );
  }
  const r = job.lastResult;
  if (!r) return null;
  if (job.jobType === 'content_summary') {
    return (
      <p className="text-xs text-textMain whitespace-pre-wrap leading-relaxed bg-background border border-border rounded-lg p-3">
        {r.response || '(no response)'}
      </p>
    );
  }
  if (job.jobType === 'send_email') {
    return <p className="text-xs text-cyan-400">Email dispatched.</p>;
  }
  if (r.value !== undefined && r.value !== null) {
    const isNum = typeof r.value === 'number';
    return (
      <div className={cn(
        'text-xs bg-background border border-border rounded-lg p-3',
        isNum ? 'font-semibold text-accent' : 'text-textMain whitespace-pre-wrap leading-relaxed'
      )}>
        {isNum ? `$${r.value}` : r.value}
      </div>
    );
  }
  if (r.action) return <p className="text-xs text-textMuted">Guard verdict: {r.action}</p>;
  return <p className="text-xs text-textMuted">Completed.</p>;
}

export default function MonitorList({ refreshKey }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data.data);
    } catch {
      /* 401 handled globally */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs, refreshKey]);

  // Poll while anything is still in flight; stop when everything settles.
  useEffect(() => {
    const inFlight = jobs.some((j) => ['pending', 'queued', 'processing'].includes(j.status));
    if (!inFlight) return;
    const id = setInterval(fetchJobs, 5000);
    return () => clearInterval(id);
  }, [jobs, fetchJobs]);

  const toggle = async (job) => {
    if (!['pending', 'paused'].includes(job.status)) return;
    try {
      await api.put(`/jobs/${job._id}`);
      fetchJobs();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update');
    }
  };

  const remove = async (job) => {
    if (!window.confirm('Delete this monitor?')) return;
    try {
      await api.delete(`/jobs/${job._id}`);
      fetchJobs();
      toast.success('Monitor deleted');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="text-sm text-textMuted py-10 text-center">Loading monitors…</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 text-center">
        <p className="text-sm text-textMuted">No monitors yet — create your first alert.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl divide-y divide-border">
      {jobs.map((job) => {
        const Icon = jobIcon(job);
        const result = renderResult(job);
        return (
          <div key={job._id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{jobTypeLabel(job)}</span>
                  <StatusBadge status={job.status} />
                </div>
                <div className="text-xs text-textMuted truncate mt-0.5">{jobTarget(job)}</div>
              </div>
              <div className="text-xs text-textMuted shrink-0 hidden sm:block">
                {cronLabel(job.cronExpression)}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {['pending', 'paused'].includes(job.status) && (
                  <button
                    onClick={() => toggle(job)}
                    className="p-1.5 rounded-md text-textMuted hover:text-accent hover:bg-elevated transition-colors"
                    title={job.status === 'pending' ? 'Pause' : 'Resume'}
                  >
                    {job.status === 'pending' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => remove(job)}
                  className="p-1.5 rounded-md text-textMuted hover:text-red-400 hover:bg-elevated transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {result && <div className="mt-3">{result}</div>}
          </div>
        );
      })}
    </div>
  );
}
