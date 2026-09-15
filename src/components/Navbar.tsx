import React from 'react';
import { Database, Zap, HardDrive, Terminal, Search, ShieldCheck, Download, Lock, Crown, Laptop, Tv, FileAudio } from 'lucide-react';
import { DatabaseStats } from '../types';
import { useLicense } from '../context/LicenseContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

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
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const isPythonAllowed = isPro || isAdminAuthenticated;

  return (
    <header className={`border-b select-none sticky top-0 z-40 shadow-xs transition-colors duration-200 ${
      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#111114] border-[#242428] text-[#D1D1D1]'
    }`}>
      {/* Top micro-bar for desktop & tablet */}
      <div className={`px-3 sm:px-8 py-1.5 border-b flex flex-wrap items-center justify-between text-xs gap-y-1 transition-colors duration-200 ${
        isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#0E0E11] border-[#242428] text-gray-400'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5" title={`Unique Isolated User Database: ${stats?.dbFilename || 'user_db.sqlite'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className={`font-mono text-[10px] sm:text-[11px] truncate max-w-[150px] sm:max-w-none flex items-center gap-1 ${
              isLight ? 'text-slate-700' : 'text-gray-300'
            }`}>
              <Database className="w-3 h-3 text-indigo-500" />
              <span>{stats?.dbFilename || 'user_db.sqlite'}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded border ${
                isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}>Private</span>
            </span>
          </div>
          <span className={`${isLight ? 'text-slate-300' : 'text-[#242428]'} hidden sm:inline`}>|</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className={`font-mono text-[11px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>License:</span>
            {isPro ? (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500" />
                {tier === 'pro_vip' ? 'Pro VIP' : 'Standard Pro'}
              </span>
            ) : (
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}>
                Free (5 Lines)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-1">
            <span className={isLight ? 'text-slate-500' : 'text-gray-500'}>DB:</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats?.total ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={isLight ? 'text-slate-500' : 'text-gray-500'}>Valid:</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>{stats?.valid ?? 0}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <span className={isLight ? 'text-slate-500' : 'text-gray-500'}>Exp:</span>
            <span className={`font-semibold font-mono ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>{stats?.expired ?? 0}</span>
          </div>

          {/* Quick License & Upgrade Button */}
          {isPro ? (
            <button
              onClick={() => openUpgradeModal('devices')}
              className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-emerald-700 border-emerald-300'
                  : 'bg-[#1A1A22] hover:bg-[#252530] text-emerald-300 border-emerald-500/30'
              }`}
              title="Manage Registered Devices"
            >
              <Laptop className="w-3 h-3 text-emerald-500" />
              <span className="hidden sm:inline">Devices</span> ({licenseInfo ? `${licenseInfo.devicesCount}/${licenseInfo.maxDevices}` : '1'})
            </button>
          ) : (
            <button
              onClick={() => openUpgradeModal('pricing')}
              className="px-2 sm:px-2.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[10px] font-extrabold shadow-sm hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Crown className="w-3 h-3 fill-black" />
              <span>Pro</span>
            </button>
          )}

          {/* Theme Selector: Dark, Light, System */}
          <span className={`${isLight ? 'text-slate-300' : 'text-[#242428]'} hidden sm:inline`}>|</span>
          <ThemeToggle variant="dropdown" />
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-3 sm:px-8 py-2.5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className={`font-bold text-sm sm:text-base tracking-tight ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>X-VALIDATOR</h1>
              <span className={`text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {isPro ? 'PRO UNLOCKED' : 'PRO DESKTOP'}
              </span>
            </div>
            <p className={`text-[10px] sm:text-xs truncate max-w-[220px] sm:max-w-none ${
              isLight ? 'text-slate-500' : 'text-gray-500'
            }`}>Batch .TXT Parser & IPTV Suite</p>
          </div>
        </div>

        {/* Tab Controls - Horizontal Scroll on Small Screens */}
        <nav className={`flex items-center p-1 rounded-lg border overflow-x-auto no-scrollbar max-w-full gap-1 transition-colors duration-200 ${
          isLight ? 'bg-slate-100 border-slate-200 shadow-inner' : 'bg-[#0A0A0C] border-[#242428]'
        }`}>
          <button
            id="tab-validator-btn"
            onClick={() => setActiveTab('validator')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'validator'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <div className="relative">
              <Zap className="w-3.5 h-3.5" />
              {isValidatingBatch && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <span className="whitespace-nowrap">Validator</span>
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
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'database'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Database</span>
            {stats && stats.total > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                isLight ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-[#1C1C21] text-gray-300 border-[#34343A]'
              }`}>
                {stats.total}
              </span>
            )}
          </button>

          <button
            id="tab-single-btn"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'single'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Single Tester</span>
          </button>

          <button
            id="tab-m3u-btn"
            onClick={() => setActiveTab('m3u')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'm3u'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <FileAudio className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span className="whitespace-nowrap">M3U Generator</span>
          </button>
          <button
            id="tab-player-btn"
            onClick={() => setActiveTab('player')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'player'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <Tv className={`w-3.5 h-3.5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
            <span className="whitespace-nowrap">Web Player</span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${
              isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
            }`}>
              Live
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
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'python'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90 font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            {isPythonAllowed ? (
              <Terminal className={`w-3.5 h-3.5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
            ) : (
              <Lock className={`w-3.5 h-3.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
            )}
            <span className="whitespace-nowrap">Python App</span>
            {!isPythonAllowed && (
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${
                isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              }`}>
                Pro
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
