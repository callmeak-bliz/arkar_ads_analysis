import React, { useState, useEffect } from 'react';
import { ClientProfile, ThresholdSettings } from './types';
import { Storage } from './utils/storage';
import { ClientsTab } from './components/ClientsTab';
import { AnalyzeTab } from './components/AnalyzeTab';
import { LessonsTab } from './components/LessonsTab';
import { BackupModal } from './components/BackupModal';
import { ThresholdSettingsModal } from './components/ThresholdSettingsModal';
import { BarChart3, Users, FileText, Bookmark, SlidersHorizontal, Database, ChevronDown } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState<ClientProfile[]>(() => Storage.getClients());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    const saved = Storage.getSelectedClientId();
    if (saved) return saved;
    const initialClients = Storage.getClients();
    return initialClients[0]?.id || null;
  });

  const [activeTab, setActiveTab] = useState<'clients' | 'analyze' | 'lessons'>('analyze');
  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => Storage.getThresholds());

  // Modals
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync selected client
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    Storage.setSelectedClientId(id);
  };

  const handleSaveClient = (client: ClientProfile) => {
    Storage.upsertClient(client);
    const updated = Storage.getClients();
    setClients(updated);
    setSelectedClientId(client.id);
    Storage.setSelectedClientId(client.id);
  };

  const handleDeleteClient = (id: string) => {
    Storage.deleteClient(id);
    const updated = Storage.getClients();
    setClients(updated);
    if (selectedClientId === id) {
      setSelectedClientId(updated[0]?.id || null);
    }
  };

  const handleSaveThresholds = (newThresholds: ThresholdSettings) => {
    Storage.saveThresholds(newThresholds);
    setThresholds(newThresholds);
  };

  const reloadData = () => {
    const updatedClients = Storage.getClients();
    setClients(updatedClients);
    const savedSelected = Storage.getSelectedClientId();
    setSelectedClientId(savedSelected || updatedClients[0]?.id || null);
    setThresholds(Storage.getThresholds());
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
      {/* Top Bar Contract (1 row, 3 zones, zero-pill discipline) */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
          {/* Zone 1: Brand title */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-base font-bold tracking-tight text-neutral-900 whitespace-nowrap">
              Ads Analyst
            </span>
          </div>

          {/* Zone 2: Navigation Links (single line, whitespace-nowrap) */}
          <nav className="flex items-center gap-1 sm:gap-6 text-xs font-medium">
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'clients'
                  ? 'border-neutral-900 text-neutral-900 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Clients ({clients.length})
            </button>
            <button
              onClick={() => setActiveTab('analyze')}
              className={`px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'analyze'
                  ? 'border-neutral-900 text-neutral-900 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Analyze
            </button>
            <button
              onClick={() => setActiveTab('lessons')}
              className={`px-2.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'lessons'
                  ? 'border-neutral-900 text-neutral-900 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Lessons
            </button>
          </nav>

          {/* Zone 3: Actions & Client Selector */}
          <div className="flex items-center gap-2 shrink-0">
            {clients.length > 0 && (
              <div className="relative hidden sm:block">
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white py-1.5 pl-2.5 pr-8 text-xs font-semibold text-neutral-800 focus:border-neutral-900 focus:outline-hidden appearance-none cursor-pointer max-w-[180px] truncate"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-400 pointer-events-none" />
              </div>
            )}

            <button
              onClick={() => setIsBackupOpen(true)}
              title="Backup & Restore"
              className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
            >
              <Database className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Detection Thresholds"
              className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'clients' && (
          <ClientsTab
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={handleSelectClient}
            onSaveClient={handleSaveClient}
            onDeleteClient={handleDeleteClient}
            onNavigateToAnalyze={() => setActiveTab('analyze')}
          />
        )}

        {activeTab === 'analyze' && (
          <AnalyzeTab
            selectedClient={selectedClient}
            thresholds={thresholds}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        )}

        {activeTab === 'lessons' && (
          <LessonsTab
            selectedClient={selectedClient}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        )}
      </main>

      {/* Settings Modal */}
      <ThresholdSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        thresholds={thresholds}
        onSave={handleSaveThresholds}
      />

      {/* Backup Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataChanged={reloadData}
      />
    </div>
  );
}
