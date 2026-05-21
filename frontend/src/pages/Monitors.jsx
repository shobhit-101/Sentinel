import { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import StatStrip from '../components/monitors/StatStrip';
import MonitorList from '../components/monitors/MonitorList';
import CreateAlertModal from '../components/monitors/CreateAlertModal';

export default function Monitors() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 shrink-0 border-b border-border flex items-center justify-between px-8">
        <h1 className="text-lg font-semibold tracking-tight">Monitors</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Create Alert
        </Button>
      </header>

      <div className="flex-1 p-8 space-y-6">
        <StatStrip refreshKey={refreshKey} />
        <MonitorList refreshKey={refreshKey} />
      </div>

      <CreateAlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
