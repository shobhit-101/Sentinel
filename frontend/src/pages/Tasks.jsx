import { useEffect, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { cn } from '../lib/cn';
import { inputClass } from '../components/ui/field';
import Button from '../components/ui/Button';

function TaskRow({ task, onToggle, onRemove }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2.5"
    >
      <button
        onClick={() => onToggle(task)}
        className={cn(
          'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
          task.completed ? 'bg-accent border-accent' : 'border-border hover:border-accent'
        )}
      >
        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', task.completed ? 'text-textMuted line-through' : 'text-textMain')}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className="text-xs text-textMuted mt-0.5">
            Due {new Date(task.dueDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(task)}
        className="p-1 rounded-md text-textMuted hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data.data);
    } catch {
      /* 401 handled globally */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.post('/tasks', { title, dueDate: dueDate || undefined });
      setTitle('');
      setDueDate('');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add task');
    }
  };

  const toggle = async (task) => {
    try {
      await api.put(`/tasks/${task._id}`, { completed: !task.completed });
      fetchTasks();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const remove = async (task) => {
    try {
      await api.delete(`/tasks/${task._id}`);
      fetchTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const active = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 shrink-0 border-b border-border flex items-center px-8">
        <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
      </header>

      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <form onSubmit={add} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task…"
              className={inputClass}
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(inputClass, 'w-auto')}
            />
            <Button type="submit">
              <Plus className="w-4 h-4" />
            </Button>
          </form>

          {loading ? (
            <p className="text-sm text-textMuted text-center py-10">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-textMuted text-center py-16 border border-dashed border-border rounded-xl">
              No tasks yet — add one above.
            </p>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {active.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={toggle} onRemove={remove} />
                ))}
              </AnimatePresence>
              {done.length > 0 && (
                <p className="text-xs font-medium text-textMuted pt-4 pb-1">
                  Completed · {done.length}
                </p>
              )}
              <AnimatePresence initial={false}>
                {done.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={toggle} onRemove={remove} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
