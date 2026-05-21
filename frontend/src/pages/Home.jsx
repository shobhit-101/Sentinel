import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Radio, ListChecks, LogOut, ArrowRight } from 'lucide-react';

const choices = [
  {
    to: '/monitors',
    icon: Radio,
    title: 'Monitors',
    desc: 'Automated trackers, scrapers and alerts running on a schedule.',
  },
  {
    to: '/tasks',
    icon: ListChecks,
    title: 'Tasks',
    desc: 'Your personal to-do list with optional email reminders.',
  },
];

export default function Home() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('sentinel_token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-textMain">
      <button
        onClick={logout}
        className="absolute top-5 right-6 flex items-center gap-2 text-sm text-textMuted hover:text-red-400 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log out
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Sentinel</span>
        </div>
        <p className="text-textMuted text-sm">Where would you like to go?</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8 w-full max-w-2xl">
        {choices.map((c, i) => (
          <motion.button
            key={c.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 + i * 0.08 }}
            whileHover={{ y: -3 }}
            onClick={() => navigate(c.to)}
            className="group text-left bg-surface border border-border rounded-2xl p-6 hover:border-accent/50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mb-4">
              <c.icon className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{c.title}</h3>
            <p className="text-sm text-textMuted mt-1.5 leading-relaxed">{c.desc}</p>
            <span className="inline-flex items-center gap-1.5 text-sm text-accent mt-4 group-hover:gap-2.5 transition-all">
              Open
              <ArrowRight className="w-4 h-4" />
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
