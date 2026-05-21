import React, { useEffect, useState } from 'react';
import { Play, Pause, Trash2, Clock, Globe, Mail, Brain, Database, Activity, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  // Auto-poll while any job is still in flight. Stops on its own once
  // everything is completed / failed / paused so the dashboard doesn't
  // hammer the API for no reason.
  useEffect(() => {
    const hasInFlight = jobs.some(j => ['pending', 'queued', 'processing'].includes(j.status));
    if (!hasInFlight) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load active monitors');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    if (currentStatus !== 'pending' && currentStatus !== 'paused') return;

    try {
      await api.put(`/jobs/${id}`);
      fetchJobs();
      toast.success(currentStatus === 'pending' ? 'Monitor paused' : 'Monitor resumed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  // 🌟 THE NEW FUNCTION: Completely separate from toggleStatus
  const completeJob = async (id) => {
    try {
      await api.put(`/jobs/${id}/complete`);
      fetchJobs();
      toast.success('Task status updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) return;

    try {
      await api.delete(`/jobs/${id}`);
      fetchJobs();
      toast.success('Monitor deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete monitor');
    }
  };

  const getJobIcon = (type) => {
    switch(type) {
      case 'api_ninja': return <Database className="w-5 h-5 text-blue-400" />;
      case 'price_scraper': return <Globe className="w-5 h-5 text-emerald-400" />;
      case 'keyword_alert': return <Globe className="w-5 h-5 text-emerald-400" />;
      case 'send_email': return <Mail className="w-5 h-5 text-amber-400" />;
      case 'content_summary': return <Brain className="w-5 h-5 text-purple-400" />;
      case 'condition_guard': return <Activity className="w-5 h-5 text-rose-400" />;
      default: return <Clock className="w-5 h-5 text-textMuted" />;
    }
  };

  const renderLastResult = (job) => {
    if (job.status === 'failed' && job.errorLog) {
      return (
        <div className="text-sm bg-red-500/5 p-3 rounded-lg border border-red-500/20 text-red-300">
          <span className="font-semibold text-red-400">Error:</span> {job.errorLog}
        </div>
      );
    }
    if (!job.lastResult) return <span className="text-xs text-textMuted italic">Pending execution...</span>;

    if (job.jobType === 'content_summary') {
      return (
        <div className="text-sm bg-background p-3 rounded-lg border border-border">
          <p className="text-textMain text-xs whitespace-pre-wrap leading-relaxed">
            {job.lastResult.response || '(no response)'}
          </p>
        </div>
      );
    }
    
    if (job.jobType === 'api_ninja' || job.jobType === 'price_scraper') {
      const v = job.lastResult.value;
      const isNum = typeof v === 'number';
      return (
        <div className="text-sm">
          <div className={isNum ? 'font-bold text-primary' : 'text-textMain text-xs whitespace-pre-wrap leading-relaxed'}>
            {isNum ? `$${v}` : v}
          </div>
          <div className="text-xs text-textMuted mt-1">
            Last checked: {new Date(job.lastRunAt).toLocaleString()}
          </div>
        </div>
      );
    }

    if (job.jobType === 'send_email') {
      return <span className="text-xs text-green-400 font-medium">Email dispatched successfully.</span>;
    }

    return <span className="text-xs text-textMuted">Task completed.</span>;
  };
    
  if (isLoading) return <div className="text-textMuted text-center py-10">Loading monitors...</div>;

  if (jobs.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-12 text-center border-dashed">
        <p className="text-textMuted">No active monitors found. Create an alert to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-background/50 border-b border-border text-sm text-textMuted">
            <th className="p-4 font-medium">Type</th>
            <th className="p-4 font-medium">Target</th>
            <th className="p-4 font-medium">Schedule</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <React.Fragment key={job._id}>
              <tr className="border-b border-border/50 hover:bg-background/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-lg border border-border">
                      {getJobIcon(job.jobType)}
                    </div>
                    <span className="font-medium capitalize text-textMain">
                      {job.jobType.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-textMuted text-sm">
                  {job.payload.symbol || job.payload.url || job.payload.to || job.payload.metricName || job.payload.label || 'System Task'}
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-textMain">
                      {job.cronExpression || 'One-time Task'}
                    </span>
                    <span className="text-xs text-textMuted">{job.timezone || 'UTC'}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border
                    ${job.status === 'pending' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                      job.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                      job.status === 'completed' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}
                  >
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* 🌟 THE NEW BUTTON IN THE ACTION CLUSTER */}
                    <button 
                      onClick={() => completeJob(job._id)}
                      className="p-2 text-textMuted hover:text-green-400 transition-colors"
                      title={job.status === 'completed' ? 'Mark as Pending' : 'Mark as Completed'}
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={() => toggleStatus(job._id, job.status)}
                      disabled={job.status === 'completed' || job.status === 'failed'}
                      className="p-2 text-textMuted hover:text-primary transition-colors disabled:opacity-30 disabled:hover:text-textMuted"
                      title={job.status === 'pending' ? 'Pause Monitor' : 'Resume Monitor'}
                    >
                      {job.status === 'pending' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button 
                      onClick={() => deleteJob(job._id)}
                      className="p-2 text-textMuted hover:text-red-400 transition-colors"
                      title="Delete Monitor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              
              {(job.lastResult || (job.status === 'failed' && job.errorLog)) && (
                <tr className="bg-surface/50 border-b border-border">
                  <td colSpan="5" className="px-14 py-3">
                    <div className="flex gap-4 items-start">
                      <span className="text-xs font-semibold text-textMuted uppercase tracking-wider mt-1">
                        {job.status === 'failed' ? 'Error:' : 'Output:'}
                      </span>
                      <div className="flex-1">
                        {renderLastResult(job)}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}