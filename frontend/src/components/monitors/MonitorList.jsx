import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Database, Globe, Mail, ShieldAlert, Sparkles, Trophy, Clock, Pause, Play, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../lib/cn';
import { cronLabel } from '../../lib/schedule';
import { playPing } from '../../lib/sound';
import StatusBadge from '../ui/StatusBadge';
import JobDetailModal from './JobDetailModal';

// Active monitors float to the top; settled ones sink.
const STATUS_RANK = { processing: 0, queued: 1, pending: 2, paused: 3, completed: 4, failed: 5 };

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

function lastRunText(job) {
  if (!job.lastRunAt) return 'Not run yet';
  const d = new Date(job.lastRunAt);
  return 'Last run ' + d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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
  const [flashIds, setFlashIds] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const prevRunRef = useRef(null); // { id: lastRunAt } from the previous fetch

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs');
      const next = data.data;

      // Detect updates: a job's lastRunAt advanced, or a brand-new job appeared.
      const prev = prevRunRef.current;
      if (prev) {
        const changed = next.filter(
          (j) => !(j._id in prev) || prev[j._id] !== (j.lastRunAt || '')
        );
        if (changed.length > 0) {
          playPing();
          const ids = new Set(changed.map((j) => j._id));
          setFlashIds(ids);
          setTimeout(() => setFlashIds(new Set()), 1500);
        }
      }
      prevRunRef.current = Object.fromEntries(next.map((j) => [j._id, j.lastRunAt || '']));

      setJobs(next);
    } catch {
      /* 401 handled globally */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs, refreshKey]);

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

  const sorted = [...jobs].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
  );

  return (
    <>
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {sorted.map((job) => {
          const Icon = jobIcon(job);
          const result = renderResult(job);
          const flashing = flashIds.has(job._id);
          return (
            <motion.div
              key={job._id}
              animate={
                flashing
                  ? { boxShadow: ['0 0 0 0 rgba(139,92,246,0)', '0 0 0 2px rgba(139,92,246,0.65)', '0 0 0 0 rgba(139,92,246,0)'] }
                  : { boxShadow: '0 0 0 0 rgba(139,92,246,0)' }
              }
              transition={{ duration: 1.4 }}
              className="p-4 rounded-xl transition-colors hover:bg-background"
            >
              <div className="flex items-center gap-4">
                <div
                  onClick={() => setDetailId(job._id)}
                  className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{jobTypeLabel(job)}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="text-xs text-textMuted truncate mt-0.5">{jobTarget(job)}</div>
                    <div className="text-xs text-textFaint mt-0.5">
                      {cronLabel(job.cronExpression)} · {lastRunText(job)}
                    </div>
                  </div>
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
              {result && (
                <div onClick={() => setDetailId(job._id)} className="mt-3 cursor-pointer">
                  {result}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <JobDetailModal jobId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
