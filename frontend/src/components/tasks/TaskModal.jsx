import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../lib/cn';
import { toDatetimeLocal } from '../../lib/schedule';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { inputClass, labelClass, hintClass } from '../ui/field';

export default function TaskModal({ open, onClose, onSaved, task }) {
  const editing = !!task;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remindByEmail, setRemindByEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setDueDate(task?.dueDate ? toDatetimeLocal(task.dueDate) : '');
    setRemindByEmail(task?.remindByEmail || false);
  }, [open, task]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const payload = { title, description, dueDate: dueDate || null, remindByEmail };
    try {
      if (editing) await api.put(`/tasks/${task._id}`, payload);
      else await api.post('/tasks', payload);
      toast.success(editing ? 'Task updated' : 'Task added');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit task' : 'New task'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="What needs doing?"
            required
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn(inputClass, 'h-24 resize-none')}
            placeholder="Optional details…"
          />
        </div>
        <div>
          <label className={labelClass}>Due date</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <label
          className={cn(
            'flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
            remindByEmail ? 'border-accent/40 bg-accent/5' : 'border-border hover:bg-elevated'
          )}
        >
          <input
            type="checkbox"
            checked={remindByEmail}
            onChange={(e) => setRemindByEmail(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm">Email me at the due time</span>
        </label>
        {remindByEmail && !dueDate && (
          <p className={hintClass}>Set a due date above — the reminder fires at that time.</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
