import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import { cronLabel } from '../../lib/schedule';

function fmt(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-textMuted">{label}</span>
      <span className="text-textMain text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-accent mb-1.5">{title}</p>
      <pre className="text-xs text-textMain bg-background border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
        {children}
      </pre>
    </div>
  );
}

export default function JobDetailModal({ jobId, open, onClose }) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!open || !jobId) {
      setJob(null);
      return;
    }
    api.get(`/jobs/${jobId}`)
      .then(({ data }) => setJob(data.data))
      .catch(() => {});
  }, [open, jobId]);

  return (
    <Modal open={open} onClose={onClose} title="Monitor detail">
      {!job ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{job.jobType}</span>
            <StatusBadge status={job.status} />
          </div>

          <div>
            <Row label="Schedule" value={cronLabel(job.cronExpression)} />
            <Row label="Timezone" value={job.timezone || 'UTC'} />
            <Row label="Created" value={fmt(job.createdAt)} />
            <Row label="Last run" value={fmt(job.lastRunAt)} />
            <Row label="Next run" value={fmt(job.scheduledAt)} />
            {job.completedAt && <Row label="Completed" value={fmt(job.completedAt)} />}
            <Row label="Retries" value={`${job.retryCount ?? 0} / ${job.maxRetries ?? 3}`} />
          </div>

          {job.errorLog && (
            <div className="text-xs text-red-300 bg-red-400/5 border border-red-400/20 rounded-lg p-3">
              <span className="font-semibold text-red-400">Error: </span>{job.errorLog}
            </div>
          )}

          <Section title="Configuration">
            {JSON.stringify(job.payload, null, 2)}
          </Section>

          <Section title="Latest result">
            {job.lastResult ? JSON.stringify(job.lastResult, null, 2) : 'Not run yet'}
          </Section>
        </div>
      )}
    </Modal>
  );
}
