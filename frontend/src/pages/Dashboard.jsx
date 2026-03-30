import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, XCircle, LayoutDashboard, LogOut, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import JobList from '../components/JobList';
import CreateJobModal from '../components/CreateJobModal';

export default function Dashboard() {
  const [stats, setStats] = useState({ tasksExecuted: 0, tasksFailed: 0, activeMonitors: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  // Fetch telemetry as soon as the dashboard loads
  useEffect(() => {
    fetchTelemetry();
  }, []);

  const fetchTelemetry = async () => {
    try {
      const { data } = await api.get('/stats');
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      toast.error('Failed to load system telemetry');
      // If the token expired or is invalid, kick them back to login
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sentinel_token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-textMain flex">
      {/* 🧭 Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-surface p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
            <Activity className="text-primary w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold">Sentinel</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button className="w-full flex items-center gap-3 bg-primary/10 text-primary px-4 py-3 rounded-lg font-medium transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-textMuted hover:text-red-400 px-4 py-3 rounded-lg transition-colors mt-auto"
        >
          <LogOut className="w-5 h-5" />
          Disconnect
        </button>
      </aside>

      {/* 🖥️ Main Workspace */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold">System Overview</h2>
            <p className="text-textMuted mt-1">Real-time telemetry and active monitors</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Create Alert
          </button>
        </header>

        {/* 📈 Telemetry Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-textMuted text-sm font-medium">Active Monitors</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? '-' : stats.activeMonitors}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 text-green-500 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-textMuted text-sm font-medium">Successful Executions</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? '-' : stats.tasksExecuted}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-textMuted text-sm font-medium">Failed Tasks</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? '-' : stats.tasksFailed}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Monitors Table */}
        <div className="mb-6 flex justify-between items-end">
          <h3 className="text-lg font-semibold text-textMain">Active Monitors</h3>
        </div>
        
        {/* The key prop forces the table to re-render when refreshTrigger changes */}
        <JobList key={refreshTrigger} />
      </main>

      {/* 🌟 The New Modal */}
      <CreateJobModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setRefreshTrigger(prev => prev + 1); // Refresh the table
          fetchTelemetry(); // Refresh the active monitors count instantly
        }} 
      />
    </div>
  );
}