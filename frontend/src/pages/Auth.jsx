import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const inputClass =
  'w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm ' +
  'placeholder:text-textFaint focus:outline-none focus:border-accent ' +
  'focus:ring-1 focus:ring-accent/40 transition-colors';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const { data } = await api.post(endpoint, { email, password });
      if (isLogin) {
        localStorage.setItem('sentinel_token', data.token);
        toast.success('Welcome back');
        navigate('/monitors');
      } else {
        toast.success('Account created — log in');
        setIsLogin(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-textMain">
      {/* soft violet glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-accent/10 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mb-4">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sentinel</h1>
          <p className="text-sm text-textMuted mt-1">Distributed task orchestration</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-textMuted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-textMuted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 mt-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing…' : isLogin ? 'Log in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-textMuted hover:text-textMain transition-colors"
            >
              {isLogin ? "No account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
