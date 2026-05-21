import { useEffect, useState } from 'react';
import { Plus, Trash2, Check, Bell, CalendarClock, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { cn } from '../lib/cn';
import Button from '../components/ui/Button';
import TaskModal from '../components/tasks/TaskModal';

function dueInfo(task) {
  if (!task.dueDate) return null;
  const d = new Date(task.dueDate);
  const overdue = !task.completed && d.getTime() < Date.now();
  const text = d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  return { text, overdue };
}

function TaskCard({ task, onToggle, onEdit, onRemove }) {
  const due = dueInfo(task);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="group flex gap-3 bg-surface border border-border rounded-lg px-3.5 py-3"
    >
      <button
        onClick={() => onToggle(task)}
        className={cn(
          'w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
          task.completed ? 'bg-accent border-accent' : 'border-border hover:border-accent'
        )}
      >
        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      <div onClick={() => onEdit(task)} className="min-w-0 flex-1 cursor-pointer">
        <p className={cn('text-sm', task.completed ? 'text-textMuted line-through' : 'text-textMain')}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-textMuted mt-0.5 line-clamp-2">{task.description}</p>
        )}
        {due && (
          <div className="flex items-center gap-3 mt-1.5 text-xs">
            <span className={cn('flex items-center gap-1', due.overdue ? 'text-red-400' : 'text-textFaint')}>
              <CalendarClock className="w-3 h-3" />
              {due.overdue ? 'Overdue · ' : ''}{due.text}
            </span>
            {task.remindByEmail && (
              <span className="flex items-center gap-1 text-accent">
                <Bell className="w-3 h-3" /> Reminder
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onRemove(task)}
        className="p-1 h-fit rounded-md text-textMuted hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);

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

  const openNew = () => { setEditTask(null); setModalOpen(true); };
  const openEdit = (t) => { setEditTask(t); setModalOpen(true); };

  const toggle = async (t) => {
    try {
      await api.put(`/tasks/${t._id}`, { completed: !t.completed });
      fetchTasks();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const remove = async (t) => {
    try {
      await api.delete(`/tasks/${t._id}`);
      fetchTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const active = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 shrink-0 border-b border-border flex items-center justify-between px-8">
        <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" />
          Add task
        </Button>
      </header>

      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <p className="text-sm text-textMuted text-center py-10">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl py-16 flex flex-col items-center">
              <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mb-3">
                <ListChecks className="w-5 h-5 text-accent" />
              </div>
              <p className="text-sm text-textMuted">No tasks yet.</p>
              <button onClick={openNew} className="text-sm text-accent hover:underline mt-1">
                Add your first task
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {active.map((t) => (
                  <TaskCard key={t._id} task={t} onToggle={toggle} onEdit={openEdit} onRemove={remove} />
                ))}
              </AnimatePresence>
              {done.length > 0 && (
                <p className="text-xs font-medium text-textMuted pt-5 pb-1">
                  Completed · {done.length}
                </p>
              )}
              <AnimatePresence initial={false}>
                {done.map((t) => (
                  <TaskCard key={t._id} task={t} onToggle={toggle} onEdit={openEdit} onRemove={remove} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchTasks}
        task={editTask}
      />
    </div>
  );
}
