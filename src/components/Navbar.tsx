import React from 'react';
import { Database, Zap, HardDrive, Terminal, Search, ShieldCheck, Download, Lock, Crown, Laptop, Tv } from 'lucide-react';
import { DatabaseStats } from '../types';
import { useLicense } from '../context/LicenseContext';

interface NavbarProps {
  activeTab: 'validator' | 'database' | 'single' | 'player' | 'python';
  setActiveTab: (tab: 'validator' | 'database' | 'single' | 'player' | 'python') => void;
  stats: DatabaseStats | null;
  onRefreshDb: () => void;
  isValidatingBatch?: boolean;
  isAdminAuthenticated?: boolean;
  onOpenAdminAuth?: () => void;
  onOpenDashboard?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onRefreshDb,
  isValidatingBatch = false,
  isAdminAuthenticated = false,
  onOpenAdminAuth,
  onOpenDashboard,
}) => {
  const { tier, isPro, licenseInfo, openUpgradeModal } = useLicense();

  const isPythonAllowed = isPro || isAdminAuthenticated;

  return (
    <header className="bg-[#111114] border-b border-[#242428] text-[#D1D1D1] select-none sticky top-0 z-40 shadow-sm">
      {/* Top micro-bar for desktop feel */}
      <div className="px-4 sm:px-8 py-1.5 bg-[#0E0E11] border-b border-[#242428] flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-gray-300 font-mono text-[11px]">SQLite: xtream_accounts.db</span>
          </div>
          <span className="text-[#242428]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-mono text-[11px]">License Tier:</span>
            {isPro ? (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                {tier === 'pro_vip' ? 'Pro VIP (3 Devices)' : 'Standard Pro (1 Device)'}
              </span>
            ) : (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                Free Tier (5 Lines Scan)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">DB Records:</span>
            <span className="font-semibold text-white font-mono">{stats?.total ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Active Valid:</span>
            <span className="font-semibold text-emerald-400 font-mono">{stats?.valid ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Expired:</span>
            <span className="font-semibold text-amber-400 font-mono">{stats?.expired ?? 0}</span>
          </div>

          {/* Quick License & Upgrade Button */}
          {isPro ? (
            <button
              onClick={() => openUpgradeModal('devices')}
              className="px-2.5 py-0.5 rounded bg-[#1A1A22] hover:bg-[#252530] text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Manage Registered Devices"
            >
              <Laptop className="w-3 h-3 text-emerald-400" />
              <span>Devices ({licenseInfo ? `${licenseInfo.devicesCount}/${licenseInfo.maxDevices}` : '1'})</span>
            </button>
          ) : (
            <button
              onClick={() => openUpgradeModal('pricing')}
              className="px-2.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[10px] font-extrabold shadow-sm hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Crown className="w-3 h-3 fill-black" />
              <span>Upgrade to Pro</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-white tracking-tight">X-VALIDATOR</h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {isPro ? 'PRO UNLOCKED' : 'PRO DESKTOP'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Batch .TXT Parser, API Verification & SQLite Suite</p>
          </div>
        </div>

        {/* Tab Controls */}
        <nav className="flex items-center p-1 bg-[#0A0A0C] rounded-lg border border-[#242428]">
          <button
            id="tab-validator-btn"
            onClick={() => setActiveTab('validator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'validator'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <div className="relative">
              <Zap className="w-3.5 h-3.5" />
              {isValidatingBatch && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <span>Validation Console</span>
            {isValidatingBatch && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 animate-pulse">
                Running
              </span>
            )}
          </button>

          <button
            id="tab-database-btn"
            onClick={() => {
              setActiveTab('database');
              onRefreshDb();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === 'database'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Database Records</span>
            {stats && stats.total > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded text-[10px] bg-[#1C1C21] text-gray-300 font-mono border border-[#34343A]">
                {stats.total}
              </span>
            )}
          </button>

          <button
            id="tab-single-btn"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === 'single'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Single Inspector</span>
          </button>

          <button
            id="tab-player-btn"
            onClick={() => setActiveTab('player')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'player'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-indigo-400" />
            <span>Web Player</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Live/VOD
            </span>
          </button>

          <button
            id="tab-python-btn"
            onClick={() => {
              if (isPythonAllowed) {
                setActiveTab('python');
              } else if (onOpenAdminAuth) {
                onOpenAdminAuth();
              } else {
                openUpgradeModal('pricing');
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'python'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            {isPythonAllowed ? (
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Python Desktop App</span>
            {!isPythonAllowed && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/25">
                Pro
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
