import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Radio, ListChecks, LogOut } from 'lucide-react';
import { cn } from '../lib/cn';

const navItems = [
  { to: '/monitors', label: 'Monitors', icon: Radio },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('sentinel_token');
    navigate('/login');
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shadow-[0_0_16px_-4px_rgba(124,58,237,0.6)]">
          <Activity className="w-4 h-4 text-accent" />
        </div>
        <span className="font-bold tracking-tight text-[15px]">Sentinel</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-textMuted hover:text-textMain hover:bg-elevated'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent" />
                )}
                <Icon className="w-4 h-4" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-textMuted hover:text-red-400 hover:bg-elevated transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
