import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BatchValidatorTab } from './components/BatchValidatorTab';
import { DatabaseManagerTab } from './components/DatabaseManagerTab';
import { SingleTesterTab } from './components/SingleTesterTab';
import { PythonStudioTab } from './components/PythonStudioTab';
import { AccountDetailModal } from './components/AccountDetailModal';
import { ExportModal } from './components/ExportModal';
import { XtreamAccount, DatabaseStats } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'validator' | 'database' | 'single' | 'python'>('validator');
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [inspectAccount, setInspectAccount] = useState<XtreamAccount | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isBatchValidating, setIsBatchValidating] = useState<boolean>(false);

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/db/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch DB stats', e);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, []);

  const handleDeleteAccount = async (id: number) => {
    try {
      const res = await fetch(`/api/db/account/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDbStats();
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleRevalidate = async (acc: XtreamAccount) => {
    try {
      const res = await fetch('/api/validate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: acc.domain,
          username: acc.username,
          password: acc.password,
          saveToDb: true,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInspectAccount(updated);
        fetchDbStats();
      }
    } catch (e) {
      console.error('Re-validation failed', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#D1D1D1] flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Desktop Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onRefreshDb={fetchDbStats}
        isValidatingBatch={isBatchValidating}
      />

      {/* Main Workspace Container - Persistent tabs to preserve batch progress and background state */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className={activeTab === 'validator' ? 'block' : 'hidden'}>
          <BatchValidatorTab
            onAccountValidated={() => fetchDbStats()}
            onRefreshDbStats={fetchDbStats}
            onOpenAccountDetail={(acc) => setInspectAccount(acc)}
            onValidationStateChange={(validating) => setIsBatchValidating(validating)}
          />
        </div>

        <div className={activeTab === 'database' ? 'block' : 'hidden'}>
          <DatabaseManagerTab
            stats={stats}
            onRefreshDb={fetchDbStats}
            onOpenAccountDetail={(acc) => setInspectAccount(acc)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            isActive={activeTab === 'database'}
          />
        </div>

        <div className={activeTab === 'single' ? 'block' : 'hidden'}>
          <SingleTesterTab
            onAccountSaved={() => fetchDbStats()}
          />
        </div>

        <div className={activeTab === 'python' ? 'block' : 'hidden'}>
          <PythonStudioTab
            onRefreshDb={fetchDbStats}
          />
        </div>
      </main>

      {/* Elegant Dark Footer Status Bar */}
      <footer className="h-12 border-t border-[#242428] bg-[#0E0E11] px-6 sm:px-8 flex items-center justify-between text-[11px] text-gray-500 select-none">
        <div className="flex items-center gap-2">
          <span>Connected to Local SQLite DB:</span>
          <span className="text-gray-300 font-mono">xtream_accounts.db</span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-widest text-[10px]">
          <span className="hover:text-gray-300 transition-colors">M3U8 Stream Engine</span>
          <span className="text-gray-600">•</span>
          <span className="hover:text-gray-300 transition-colors">Concurrent Pool</span>
          <span className="text-gray-600">•</span>
          <span className="text-indigo-400 font-semibold">Auto-Sync On</span>
        </div>
      </footer>

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={inspectAccount}
        onClose={() => setInspectAccount(null)}
        onDelete={handleDeleteAccount}
        onRevalidate={handleRevalidate}
      />

      {/* Database Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
