import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BatchValidatorTab } from './components/BatchValidatorTab';
import { DatabaseManagerTab } from './components/DatabaseManagerTab';
import { SingleTesterTab } from './components/SingleTesterTab';
import { PythonStudioTab } from './components/PythonStudioTab';
import { AccountDetailModal } from './components/AccountDetailModal';
import { ExportModal } from './components/ExportModal';
import { AdminUnlockModal } from './components/AdminUnlockModal';
import { PricingModal } from './components/PricingModal';
import { AdminDashboard } from './components/AdminDashboard';
import { WebPlayer } from './components/WebPlayer';
import { LicenseProvider, useLicense } from './context/LicenseContext';
import { XtreamAccount, DatabaseStats } from './types';
import { Lock, Crown, KeyRound, Terminal, Sparkles } from 'lucide-react';

function AppContent() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname;
  });
  const [activeTab, setActiveTab] = useState<'validator' | 'database' | 'single' | 'player' | 'python'>('validator');
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [inspectAccount, setInspectAccount] = useState<XtreamAccount | null>(null);
  const [playerAccount, setPlayerAccount] = useState<XtreamAccount | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isBatchValidating, setIsBatchValidating] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('xval_admin_authenticated') === 'true';
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  const { isPro, openUpgradeModal } = useLicense();

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // If user is directly at /dashboard or clicked admin dashboard
  if (currentPath === '/dashboard' || currentPath.startsWith('/dashboard')) {
    return (
      <AdminDashboard
        onBackToApp={() => navigateTo('/')}
      />
    );
  }

  const isPythonAllowed = isPro || isAdminAuthenticated;

  const handlePlayAccount = (acc: XtreamAccount) => {
    setPlayerAccount(acc);
    setActiveTab('player');
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
        isAdminAuthenticated={isAdminAuthenticated}
        onOpenAdminAuth={() => setIsAdminModalOpen(true)}
        onOpenDashboard={() => navigateTo('/dashboard')}
      />

      {/* Main Workspace Container - Persistent tabs to preserve batch progress and background state */}
      <main className={`flex-1 w-full mx-auto ${activeTab === 'player' ? 'p-0' : 'max-w-7xl p-4 sm:p-6 lg:p-8'}`}>
        <div className={activeTab === 'validator' ? 'block' : 'hidden'}>
          <BatchValidatorTab
            onAccountValidated={() => fetchDbStats()}
            onRefreshDbStats={fetchDbStats}
            onOpenAccountDetail={(acc) => setInspectAccount(acc)}
            onPlayAccount={handlePlayAccount}
            onValidationStateChange={(validating) => setIsBatchValidating(validating)}
          />
        </div>

        <div className={activeTab === 'database' ? 'block' : 'hidden'}>
          <DatabaseManagerTab
            stats={stats}
            onRefreshDb={fetchDbStats}
            onOpenAccountDetail={(acc) => setInspectAccount(acc)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onPlayAccount={handlePlayAccount}
            isActive={activeTab === 'database'}
          />
        </div>

        <div className={activeTab === 'single' ? 'block' : 'hidden'}>
          <SingleTesterTab
            onAccountSaved={() => fetchDbStats()}
          />
        </div>

        <div className={activeTab === 'player' ? 'block' : 'hidden'}>
          <WebPlayer
            initialAccount={playerAccount}
            onBackToDatabase={() => setActiveTab('database')}
          />
        </div>

        <div className={activeTab === 'python' ? 'block' : 'hidden'}>
          {isPythonAllowed ? (
            <PythonStudioTab
              onRefreshDb={fetchDbStats}
              onLockAdmin={() => {
                localStorage.removeItem('xval_admin_authenticated');
                setIsAdminAuthenticated(false);
                if (!isPro) {
                  setActiveTab('validator');
                }
              }}
            />
          ) : (
            <div className="bg-[#111114] border border-[#242428] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto my-12 space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Python Desktop Studio & Source</h3>
                <p className="text-xs text-gray-400 leading-relaxed mt-1">
                  The Python Desktop GUI (.py source, executable, and standalone offline suite) is available for <strong>Pro License</strong> holders or the master owner.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => openUpgradeModal('pricing')}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4 fill-black" />
                  <span>Get Pro License ($9.99)</span>
                </button>

                <button
                  onClick={() => openUpgradeModal('activate')}
                  className="py-3 px-4 bg-[#1C1C22] hover:bg-[#26262E] text-indigo-300 font-bold rounded-xl text-xs border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span>Enter Key</span>
                </button>
              </div>

              <div className="pt-3 border-t border-[#1E1E24] flex items-center justify-between">
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Owner login with Admin Passkey
                </button>

                <button
                  onClick={() => navigateTo('/dashboard')}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  Open /dashboard
                </button>
              </div>
            </div>
          )}
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
          <span className="hover:text-gray-300 transition-colors">HWID Shield Active</span>
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
        onPlayAccount={handlePlayAccount}
      />

      {/* Database Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Owner Admin Unlock Modal */}
      <AdminUnlockModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={() => {
          setIsAdminAuthenticated(true);
          setIsAdminModalOpen(false);
          setActiveTab('python');
        }}
      />

      {/* License & Pricing Checkout Modal */}
      <PricingModal />
    </div>
  );
}

export default function App() {
  return (
    <LicenseProvider>
      <AppContent />
    </LicenseProvider>
  );
}

