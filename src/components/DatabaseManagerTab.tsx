import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Search,
  Filter,
  Trash2,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  SlidersHorizontal,
  FileDown,
  Database,
  Calendar,
  Layers,
  Sparkles,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play
} from 'lucide-react';
import { XtreamAccount, DatabaseStats } from '../types';

interface DatabaseManagerTabProps {
  stats: DatabaseStats | null;
  onRefreshDb: () => void;
  onOpenAccountDetail: (account: XtreamAccount) => void;
  onOpenExportModal: () => void;
  onPlayAccount?: (account: XtreamAccount) => void;
  isActive?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  type: 'clear' | 'deleteSelected' | 'deleteOne';
  title: string;
  message: string;
  targetId?: number;
  count?: number;
}

export const DatabaseManagerTab: React.FC<DatabaseManagerTabProps> = ({
  stats,
  onRefreshDb,
  onOpenAccountDetail,
  onOpenExportModal,
  onPlayAccount,
  isActive = true,
}) => {
  const [accounts, setAccounts] = useState<XtreamAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // In-app confirmation dialog state (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    isOpen: false,
    type: 'deleteSelected',
    title: '',
    message: ''
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`/api/db/accounts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (e) {
      console.error('Failed to fetch accounts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchAccounts();
    }
  }, [isActive, statusFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAccounts();
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      // Default order based on column type
      if (column === 'max_connections' || column === 'id' || column === 'last_checked' || column === 'status') {
        setSortOrder('DESC');
      } else {
        setSortOrder('ASC');
      }
    }
  };

  const handleQuickSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    switch (val) {
      case 'domain-asc':
        setSortBy('domain');
        setSortOrder('ASC');
        break;
      case 'domain-desc':
        setSortBy('domain');
        setSortOrder('DESC');
        break;
      case 'maxcon-desc':
        setSortBy('max_connections');
        setSortOrder('DESC');
        break;
      case 'maxcon-asc':
        setSortBy('max_connections');
        setSortOrder('ASC');
        break;
      case 'username-asc':
        setSortBy('username');
        setSortOrder('ASC');
        break;
      case 'username-desc':
        setSortBy('username');
        setSortOrder('DESC');
        break;
      case 'exp-asc':
        setSortBy('exp_date');
        setSortOrder('ASC');
        break;
      case 'exp-desc':
        setSortBy('exp_date');
        setSortOrder('DESC');
        break;
      case 'status-desc':
        setSortBy('status');
        setSortOrder('DESC');
        break;
      case 'newest':
        setSortBy('id');
        setSortOrder('DESC');
        break;
      case 'oldest':
        setSortBy('id');
        setSortOrder('ASC');
        break;
      default:
        break;
    }
  };

  // Helper to get quick sort dropdown current value
  const getQuickSortValue = () => {
    if (sortBy === 'domain') return sortOrder === 'ASC' ? 'domain-asc' : 'domain-desc';
    if (sortBy === 'max_connections') return sortOrder === 'DESC' ? 'maxcon-desc' : 'maxcon-asc';
    if (sortBy === 'username') return sortOrder === 'ASC' ? 'username-asc' : 'username-desc';
    if (sortBy === 'exp_date') return sortOrder === 'ASC' ? 'exp-asc' : 'exp-desc';
    if (sortBy === 'status') return 'status-desc';
    if (sortBy === 'id') return sortOrder === 'DESC' ? 'newest' : 'oldest';
    return 'newest';
  };

  const renderSortIndicator = (column: string) => {
    if (sortBy === column) {
      return sortOrder === 'ASC' ? (
        <ArrowUp className="w-3 h-3 text-indigo-400 shrink-0" />
      ) : (
        <ArrowDown className="w-3 h-3 text-indigo-400 shrink-0" />
      );
    }
    return <ArrowUpDown className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(accounts.map((a) => a.id!).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const triggerDeleteSelected = () => {
    if (!selectedIds.length) return;
    setConfirmDialog({
      isOpen: true,
      type: 'deleteSelected',
      title: 'Delete Selected Accounts',
      message: `Are you sure you want to permanently delete ${selectedIds.length} selected accounts from the SQLite database?`,
      count: selectedIds.length
    });
  };

  const triggerClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'clear',
      title: 'Wipe Entire SQLite Database',
      message: `This will permanently delete ALL accounts stored in xtream_accounts.db (${stats?.total ?? accounts.length} records). This action cannot be undone.`
    });
  };

  const triggerDeleteOne = (acc: XtreamAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!acc.id) return;
    setConfirmDialog({
      isOpen: true,
      type: 'deleteOne',
      title: 'Delete Account Record',
      message: `Permanently remove ${acc.domain} (${acc.username}) from SQLite?`,
      targetId: acc.id
    });
  };

  const executeConfirmedAction = async () => {
    setIsProcessing(true);
    try {
      if (confirmDialog.type === 'deleteSelected') {
        const idsToDelete = [...selectedIds];
        const res = await fetch('/api/db/delete-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete }),
        });

        if (res.ok) {
          setAccounts((prev) => prev.filter((a) => !idsToDelete.includes(a.id!)));
          setSelectedIds([]);
          showToast(`Successfully deleted ${idsToDelete.length} accounts`);
          fetchAccounts();
          onRefreshDb();
        } else {
          showToast('Failed to delete selected accounts', 'error');
        }
      } else if (confirmDialog.type === 'clear') {
        const res = await fetch('/api/db/clear', { method: 'POST' });
        if (res.ok) {
          setAccounts([]);
          setSelectedIds([]);
          showToast('Entire database has been wiped clean');
          fetchAccounts();
          onRefreshDb();
        } else {
          showToast('Failed to wipe database', 'error');
        }
      } else if (confirmDialog.type === 'deleteOne' && confirmDialog.targetId) {
        const id = confirmDialog.targetId;
        const res = await fetch(`/api/db/account/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setAccounts((prev) => prev.filter((a) => a.id !== id));
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          showToast('Account record deleted');
          fetchAccounts();
          onRefreshDb();
        } else {
          showToast('Failed to delete account', 'error');
        }
      }
    } catch (e) {
      console.error('Action error', e);
      showToast('An error occurred during deletion', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const copyM3u = (acc: XtreamAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${acc.domain}/get.php?username=${encodeURIComponent(acc.username)}&password=${encodeURIComponent(acc.password)}&type=m3u_plus&output=ts`;
    navigator.clipboard.writeText(url);
    if (acc.id) {
      setCopiedId(acc.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border backdrop-blur-md transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Controls & Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Total Saved</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">{stats?.total ?? 0}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Valid / Active</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{stats?.valid ?? 0}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Expired</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">{stats?.expired ?? 0}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Max Streams</span>
            <div className="text-2xl font-bold font-mono text-indigo-300 mt-0.5">{stats?.totalMaxConnections ?? 0}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Database Table Container */}
      <div className="bg-[#111114] border border-[#242428] rounded-xl flex flex-col overflow-hidden shadow-sm">
        {/* Table Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:px-6 bg-[#0E0E11] border-b border-[#242428]">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="search-database-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search domain, username, or server..."
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#1C1C21] hover:bg-[#242428] text-gray-200 rounded-lg text-xs font-medium border border-[#34343A] transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Filters & Actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Quick Sort Selector */}
            <div className="flex items-center gap-1.5 bg-[#0A0A0C] border border-[#242428] rounded-lg px-2.5 py-1 text-xs text-gray-300 shadow-sm">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-gray-500 font-medium hidden sm:inline">Sort:</span>
              <select
                id="database-sort-select"
                value={getQuickSortValue()}
                onChange={handleQuickSortChange}
                className="bg-transparent text-gray-200 font-medium text-xs focus:outline-none cursor-pointer pr-1"
                title="Sort database records"
              >
                <option value="domain-asc" className="bg-[#141418] text-gray-200">Domain / Name (A → Z)</option>
                <option value="domain-desc" className="bg-[#141418] text-gray-200">Domain / Name (Z → A)</option>
                <option value="maxcon-desc" className="bg-[#141418] text-gray-200">Max Connections (High → Low)</option>
                <option value="maxcon-asc" className="bg-[#141418] text-gray-200">Max Connections (Low → High)</option>
                <option value="username-asc" className="bg-[#141418] text-gray-200">Username (A → Z)</option>
                <option value="username-desc" className="bg-[#141418] text-gray-200">Username (Z → A)</option>
                <option value="exp-asc" className="bg-[#141418] text-gray-200">Exp Date (Soonest)</option>
                <option value="exp-desc" className="bg-[#141418] text-gray-200">Exp Date (Latest)</option>
                <option value="status-desc" className="bg-[#141418] text-gray-200">Status (Active First)</option>
                <option value="newest" className="bg-[#141418] text-gray-200">Newest Added (ID)</option>
                <option value="oldest" className="bg-[#141418] text-gray-200">Oldest Added (ID)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-[#0A0A0C] rounded-lg p-0.5 border border-[#242428] text-xs">
              {['All', 'Valid', 'Expired', 'Invalid', 'Trial'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === st ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Password toggle */}
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="p-1.5 rounded-lg bg-[#0A0A0C] border border-[#242428] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
              title={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchAccounts();
                onRefreshDb();
              }}
              className="p-1.5 rounded-lg bg-[#0A0A0C] border border-[#242428] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
              title="Refresh database"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Export Modal trigger */}
            <button
              id="export-db-btn"
              onClick={onOpenExportModal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Accounts</span>
            </button>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-indigo-950/30 border-b border-indigo-500/20 flex items-center justify-between text-xs text-indigo-300">
            <span className="font-medium">
              Selected <strong className="text-white">{selectedIds.length}</strong> of {accounts.length} accounts
            </span>
            <div className="flex items-center gap-2">
              <button
                id="delete-selected-records-btn"
                onClick={triggerDeleteSelected}
                disabled={isProcessing}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Accounts Table */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-xs font-mono flex flex-col items-center gap-2 bg-[#0A0A0C]">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading SQLite records...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-xs font-mono space-y-2 bg-[#0A0A0C]">
            <p>No accounts match your current filter or database is empty.</p>
            <span className="text-[11px] text-gray-600">
              Run a batch test in the Validation Console to populate the SQLite database.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto bg-[#0A0A0C]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#1C1C21] text-gray-400 uppercase text-[11px] font-bold tracking-wider border-b border-[#242428]">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedIds.length === accounts.length && accounts.length > 0}
                      className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Status"
                    >
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('domain')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Host / Domain Name"
                    >
                      <span>Host / Domain</span>
                      {renderSortIndicator('domain')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('username')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Username"
                    >
                      <span>Username</span>
                      {renderSortIndicator('username')}
                    </button>
                  </th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('exp_date')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Expiration Date"
                    >
                      <span>Exp Date</span>
                      {renderSortIndicator('exp_date')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('max_connections')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Max Connections"
                    >
                      <span>Max Con</span>
                      {renderSortIndicator('max_connections')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('last_checked')}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer group uppercase text-[11px] font-bold tracking-wider"
                      title="Sort by Last Checked Date"
                    >
                      <span>Checked</span>
                      {renderSortIndicator('last_checked')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] text-gray-300">
                {accounts.map((acc, i) => {
                  const isSelected = selectedIds.includes(acc.id!);
                  const rowBg = isSelected
                    ? 'bg-indigo-950/20'
                    : i % 2 === 0
                    ? 'bg-[#111114]'
                    : 'bg-[#131316]';

                  return (
                    <tr
                      key={acc.id}
                      onClick={() => onOpenAccountDetail(acc)}
                      className={`${rowBg} hover:bg-[#1C1C21] transition-colors cursor-pointer group`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(acc.id!)}
                          className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {acc.is_valid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        ) : acc.status === 'Expired' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {acc.status || 'INVALID'}
                          </span>
                        )}
                      </td>

                      {/* Domain */}
                      <td className="py-3.5 px-4 text-gray-200 font-medium max-w-[200px] truncate" title={acc.domain}>
                        {acc.domain}
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4 text-gray-400">{acc.username}</td>

                      {/* Password */}
                      <td className="py-3.5 px-4 text-gray-500">
                        {showPasswords ? acc.password : '••••••••'}
                      </td>

                      {/* Expiration */}
                      <td className="py-3.5 px-4">
                        <span className={acc.status === 'Expired' ? 'text-amber-400' : 'text-gray-300'}>
                          {acc.exp_date || '-'}
                        </span>
                      </td>

                      {/* Connections */}
                      <td className="py-3.5 px-4 text-gray-400">
                        {acc.max_connections ? `${acc.active_cons || 0}/${acc.max_connections}` : '-'}
                      </td>

                      {/* Last Checked */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {acc.last_checked || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {onPlayAccount && (
                            <button
                              title="Play live channels & VOD movies in Web Player"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayAccount(acc);
                              }}
                              className="p-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-200 transition-colors border border-indigo-500/30 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                            >
                              <Play className="w-3.5 h-3.5 fill-indigo-400" />
                              <span className="hidden sm:inline">Play</span>
                            </button>
                          )}
                          <button
                            title="Copy M3U Playlist Link"
                            onClick={(e) => copyM3u(acc, e)}
                            className="p-1.5 rounded bg-[#1C1C21] hover:bg-[#242428] text-gray-300 transition-colors border border-[#34343A] cursor-pointer"
                          >
                            {copiedId === acc.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            title="Delete this record from database"
                            onClick={(e) => triggerDeleteOne(acc, e)}
                            className="p-1.5 rounded bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Database Footer bar */}
        <div className="flex items-center justify-between p-4 bg-[#0E0E11] border-t border-[#242428] text-xs text-gray-500">
          <span>Showing {accounts.length} records stored in local SQLite</span>
          <button
            id="wipe-database-btn"
            onClick={triggerClearAll}
            className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe Entire Database</span>
          </button>
        </div>
      </div>

      {/* In-App Confirmation Modal (Bypasses iframe alert/confirm limitations) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-[#2B2B32] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-[#1C1C21] hover:bg-[#242428] text-gray-300 text-xs font-medium border border-[#34343A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-action-btn"
                onClick={executeConfirmedAction}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
