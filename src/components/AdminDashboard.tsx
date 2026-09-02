import React, { useState, useEffect } from 'react';
import {
  Crown,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Copy,
  Check,
  Search,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  DollarSign,
  Users,
  Activity,
  ArrowLeft,
  XCircle,
  PlusCircle,
  Filter,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Server,
  Database,
  Sliders,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { PaymentOrder, AdminSubscriptionStats, AdminLicenseItem } from '../types';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const [adminKey, setAdminKey] = useState<string>(() => {
    return localStorage.getItem('xval_admin_key') || localStorage.getItem('xval_admin_pin') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Active Tab inside Dashboard
  const [activeTab, setActiveTab] = useState<'orders' | 'licenses' | 'mint' | 'system'>('orders');

  // Data states
  const [stats, setStats] = useState<AdminSubscriptionStats | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [licenses, setLicenses] = useState<AdminLicenseItem[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Filters & Search
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [licenseFilter, setLicenseFilter] = useState<'all' | 'active' | 'banned' | 'standard' | 'pro_vip'>('all');
  const [licenseSearch, setLicenseSearch] = useState<string>('');

  // Expanded license rows
  const [expandedLicenses, setExpandedLicenses] = useState<Record<string, boolean>>({});

  // Mint License Form
  const [mintEmail, setMintEmail] = useState<string>('');
  const [mintTier, setMintTier] = useState<'standard' | 'pro_vip'>('pro_vip');
  const [mintMaxDevices, setMintMaxDevices] = useState<number>(3);
  const [mintNotes, setMintNotes] = useState<string>('');
  const [mintSuccessKey, setMintSuccessKey] = useState<string | null>(null);
  const [mintProcessing, setMintProcessing] = useState<boolean>(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-verify if saved key exists
  useEffect(() => {
    const saved = localStorage.getItem('xval_admin_key') || localStorage.getItem('xval_admin_pin');
    if (saved) {
      verifyKey(saved, true);
    }
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleExpandLicense = (key: string) => {
    setExpandedLicenses(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const verifyKey = async (keyToTest: string, silent: boolean = false) => {
    if (!keyToTest.trim()) return;
    if (!silent) setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': keyToTest.trim()
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('xval_admin_key', keyToTest.trim());
        localStorage.setItem('xval_admin_authenticated', 'true');
        loadAllData(keyToTest.trim());
      } else {
        if (!silent) {
          setAuthError(data.error || 'Invalid Admin Secret Key. Please verify .env ADMIN_SECRET_KEY.');
        }
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      if (!silent) setAuthError(err.message || 'Server connection error');
      setIsAuthenticated(false);
    } finally {
      if (!silent) setAuthLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyKey(adminKey);
  };

  const handleLogout = () => {
    localStorage.removeItem('xval_admin_key');
    localStorage.removeItem('xval_admin_pin');
    localStorage.removeItem('xval_admin_authenticated');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const loadAllData = async (key: string = adminKey) => {
    setLoadingData(true);
    try {
      const headers = { 'x-admin-key': key.trim() };

      const [statsRes, ordersRes, licRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/orders', { headers }),
        fetch('/api/admin/licenses', { headers }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats);
      }

      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setOrders(d.orders || []);
      }

      if (licRes.ok) {
        const d = await licRes.json();
        setLicenses(d.licenses || []);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin/orders/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.license?.key) {
          copyText(data.license.key, `order_lic_${orderId}`);
        }
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Enter rejection reason (or leave empty):', 'Payment reference not found on OKX');
    if (reason === null) return;

    try {
      const res = await fetch('/api/admin/orders/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ orderId, reason })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`Delete order record ${orderId}?`)) return;
    try {
      const res = await fetch('/api/admin/orders/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevokeLicense = async (key: string) => {
    const reason = prompt('Enter reason for revoking license:', 'Abuse or chargeback');
    if (reason === null) return;

    try {
      const res = await fetch('/api/admin/licenses/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ key, reason })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReinstateLicense = async (key: string) => {
    try {
      const res = await fetch('/api/admin/licenses/reinstate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLicense = async (key: string) => {
    if (!confirm(`Permanently delete license ${key} and all bound devices?`)) return;
    try {
      const res = await fetch('/api/admin/licenses/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleForceDisconnectDevice = async (licenseKey: string, hwid: string) => {
    if (!confirm('Force disconnect this device to free up a slot for the user?')) return;
    try {
      const res = await fetch('/api/admin/devices/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({ licenseKey, hwid })
      });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMintLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setMintProcessing(true);
    setMintSuccessKey(null);

    try {
      const res = await fetch('/api/admin/licenses/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey.trim()
        },
        body: JSON.stringify({
          email: mintEmail.trim() || 'direct-client@iptv.com',
          tier: mintTier,
          maxDevices: mintMaxDevices,
          notes: mintNotes.trim() || 'Minted via Owner Admin Dashboard'
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.license) {
        setMintSuccessKey(data.license.key);
        setMintEmail('');
        setMintNotes('');
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMintProcessing(false);
    }
  };

  const exportLicensesCsv = () => {
    if (licenses.length === 0) return;
    const headers = ['Key', 'Tier', 'Email', 'Status', 'Max Devices', 'Used Devices', 'Payment Method', 'Payment Ref', 'Created At', 'Notes'];
    const rows = licenses.map(l => [
      `"${l.key}"`,
      `"${l.tier}"`,
      `"${l.email}"`,
      `"${l.status}"`,
      l.max_devices,
      l.devices_count,
      `"${l.payment_method}"`,
      `"${l.payment_ref}"`,
      `"${l.created_at}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `xvalidator_licenses_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      return (
        o.email.toLowerCase().includes(q) ||
        o.order_id.toLowerCase().includes(q) ||
        (o.tx_hash && o.tx_hash.toLowerCase().includes(q)) ||
        (o.license_key && o.license_key.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredLicenses = licenses.filter(l => {
    if (licenseFilter === 'active' && l.status !== 'active') return false;
    if (licenseFilter === 'banned' && l.status !== 'banned') return false;
    if (licenseFilter === 'standard' && l.tier !== 'standard') return false;
    if (licenseFilter === 'pro_vip' && l.tier !== 'pro_vip') return false;
    if (licenseSearch.trim()) {
      const q = licenseSearch.toLowerCase();
      return (
        l.email.toLowerCase().includes(q) ||
        l.key.toLowerCase().includes(q) ||
        (l.payment_ref && l.payment_ref.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // If not authenticated, render the secure login gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070709] text-gray-200 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-[#101014] border border-[#24242A] rounded-2xl shadow-2xl overflow-hidden p-8 space-y-6">
          
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
              <Crown className="w-8 h-8 text-amber-200" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Executive Admin Dashboard</h1>
              <p className="text-xs text-gray-400 mt-1">
                Manage customer subscriptions, OKX orders, license keys, and device locks.
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Admin Secret Key (.env ADMIN_SECRET_KEY)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter secret passkey..."
                  className="w-full bg-[#08080A] border border-[#27272F] rounded-xl pl-9 pr-10 py-3 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-gray-500 mt-1 block">
                Configured securely in container environment (<code className="text-amber-300 font-mono">ADMIN_SECRET_KEY</code>)
              </span>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:brightness-110 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 fill-black" />
              <span>{authLoading ? 'Verifying Key...' : 'Unlock Admin Dashboard'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-[#1C1C22] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onBackToApp}
              className="text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Validator</span>
            </button>
            <span className="text-[11px] text-gray-500 font-mono">Default key: 90tech</span>
          </div>

        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard View
  return (
    <div className="min-h-screen bg-[#08080B] text-[#D1D1D1] flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* Top Header */}
      <header className="bg-[#0E0E12] border-b border-[#222228] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Crown className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-white tracking-tight">Admin Subscription Dashboard</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  OWNER AUTHENTICATED
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                /dashboard • TRC-20 Network Address: TQEVdoX...panqUHTK3
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadAllData()}
              disabled={loadingData}
              className="p-2 rounded-lg bg-[#18181E] hover:bg-[#22222A] text-gray-300 hover:text-white border border-[#272730] transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 rounded-lg bg-[#18181E] hover:bg-[#22222A] text-gray-300 hover:text-white border border-[#272730] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Main App</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-grow space-y-6">

        {/* 1. Metrics & Financial Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Revenue */}
          <div className="bg-[#101014] border border-[#24242A] rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Gross Sales</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              ${(stats?.totalRevenueUsd || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-500">Approved orders</div>
          </div>

          {/* Active Licenses */}
          <div className="bg-[#101014] border border-[#24242A] rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Active Subscriptions</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              {stats?.activeLicenses ?? 0}
            </div>
            <div className="text-[10px] text-gray-500">
              VIP: {stats?.vipLicenses ?? 0} | Std: {stats?.standardLicenses ?? 0}
            </div>
          </div>

          {/* Pending Queue */}
          <div className={`border rounded-xl p-4 space-y-1 ${
            (stats?.pendingOrders || 0) > 0
              ? 'bg-amber-950/20 border-amber-500/40'
              : 'bg-[#101014] border-[#24242A]'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className={stats?.pendingOrders ? 'text-amber-300 font-bold' : 'text-gray-400'}>
                Pending Review
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-300 font-mono">
              {stats?.pendingOrders ?? 0}
            </div>
            <div className="text-[10px] text-gray-400">Needs owner approval</div>
          </div>

          {/* Devices Locked */}
          <div className="bg-[#101014] border border-[#24242A] rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Locked HWIDs</span>
              <Laptop className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-black text-indigo-300 font-mono">
              {stats?.totalDevices ?? 0}
            </div>
            <div className="text-[10px] text-gray-500">Hardware device slots</div>
          </div>

          {/* Approved Orders */}
          <div className="bg-[#101014] border border-[#24242A] rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Paid Orders</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-gray-200 font-mono">
              {stats?.approvedOrders ?? 0}
            </div>
            <div className="text-[10px] text-gray-500">Keys issued</div>
          </div>

          {/* Banned Keys */}
          <div className="bg-[#101014] border border-[#24242A] rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Revoked Keys</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 font-mono">
              {stats?.bannedLicenses ?? 0}
            </div>
            <div className="text-[10px] text-gray-500">Blacklisted keys</div>
          </div>

        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#24242A] pb-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20'
                  : 'bg-[#121216] text-gray-400 hover:text-white border border-[#222228]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payment Orders</span>
              {stats && stats.pendingOrders > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'orders' ? 'bg-black text-amber-400' : 'bg-amber-500 text-black'
                }`}>
                  {stats.pendingOrders}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('licenses')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'licenses'
                  ? 'bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-600/20'
                  : 'bg-[#121216] text-gray-400 hover:text-white border border-[#222228]'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Subscriptions & HWID Keys ({licenses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mint')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'mint'
                  ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-600/20'
                  : 'bg-[#121216] text-gray-400 hover:text-white border border-[#222228]'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Mint Custom Key</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-600/20'
                  : 'bg-[#121216] text-gray-400 hover:text-white border border-[#222228]'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>System & Env</span>
            </button>
          </div>

          {activeTab === 'licenses' && (
            <button
              onClick={exportLicensesCsv}
              className="px-3 py-1.5 bg-[#18181E] hover:bg-[#24242E] text-gray-300 hover:text-white border border-[#2A2A35] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        {/* TAB 1: PAYMENT ORDERS & VERIFICATION QUEUE */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#101014] border border-[#24242A] rounded-xl p-3.5">
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrderFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    orderFilter === 'all'
                      ? 'bg-[#22222A] text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  onClick={() => setOrderFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    orderFilter === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-amber-400/80 hover:text-amber-300'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending ({orders.filter(o => o.status === 'pending').length})</span>
                </button>
                <button
                  onClick={() => setOrderFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    orderFilter === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Approved ({orders.filter(o => o.status === 'approved').length})
                </button>
                <button
                  onClick={() => setOrderFilter('rejected')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    orderFilter === 'rejected'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Rejected ({orders.filter(o => o.status === 'rejected').length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by email, order ID, TxID..."
                  className="w-full bg-[#08080A] border border-[#27272F] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

            </div>

            {/* Orders Table */}
            <div className="bg-[#101014] border border-[#24242A] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0A0A0D] border-b border-[#24242A] text-gray-400 text-[11px] font-mono uppercase tracking-wider">
                      <th className="py-3 px-4">Order ID & Date</th>
                      <th className="py-3 px-4">Customer Email</th>
                      <th className="py-3 px-4">Tier & Price</th>
                      <th className="py-3 px-4">Payment Method & Proof</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Issued License Key</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C1C22]">
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order) => (
                        <tr key={order.order_id} className="hover:bg-[#14141A] transition-colors">
                          
                          {/* Order ID & Date */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white font-mono">{order.order_id}</div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{order.created_at}</div>
                          </td>

                          {/* Customer Email */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-gray-200">{order.email}</span>
                          </td>

                          {/* Tier & Price */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {order.tier === 'pro_vip' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  VIP Pro ($19.99)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                  Standard ($9.99)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Payment Method & Proof */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1C1C24] text-gray-300 border border-[#2D2D38]">
                                {order.payment_type === 'okx_trc20' ? 'USDT TRC-20' : 'OKX Internal'}
                              </span>
                              <div className="font-mono text-[11px] text-amber-300 font-bold break-all select-all flex items-center gap-1">
                                <span>{order.tx_hash}</span>
                                <button
                                  type="button"
                                  onClick={() => copyText(order.tx_hash, `tx_${order.order_id}`)}
                                  className="text-gray-500 hover:text-white p-0.5"
                                  title="Copy Tx Reference"
                                >
                                  {copiedId === `tx_${order.order_id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {order.status === 'pending' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit animate-pulse">
                                <Clock className="w-3 h-3" /> PENDING REVIEW
                              </span>
                            )}
                            {order.status === 'approved' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" /> APPROVED
                              </span>
                            )}
                            {order.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3" /> REJECTED
                              </span>
                            )}
                          </td>

                          {/* Issued License Key */}
                          <td className="py-3.5 px-4">
                            {order.license_key ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-amber-300 bg-[#0A0A0D] px-2 py-1 rounded border border-[#272730]">
                                  {order.license_key}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyText(order.license_key!, `lic_${order.order_id}`)}
                                  className="p-1 rounded hover:bg-[#22222A] text-gray-400 hover:text-white"
                                  title="Copy License Key"
                                >
                                  {copiedId === `lic_${order.order_id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {order.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveOrder(order.order_id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Verify & Issue Pro Key"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Approve & Key</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectOrder(order.order_id)}
                                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                    title="Reject Order"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteOrder(order.order_id)}
                                className="p-1 text-gray-500 hover:text-rose-400 rounded hover:bg-[#22222A] transition-colors cursor-pointer"
                                title="Delete Order Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 text-xs">
                          No payment orders found matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: LICENSES & HWID DEVICE SLOTS */}
        {activeTab === 'licenses' && (
          <div className="space-y-4">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#101014] border border-[#24242A] rounded-xl p-3.5">
              
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setLicenseFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    licenseFilter === 'all'
                      ? 'bg-[#22222A] text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All ({licenses.length})
                </button>
                <button
                  onClick={() => setLicenseFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    licenseFilter === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Active ({licenses.filter(l => l.status === 'active').length})
                </button>
                <button
                  onClick={() => setLicenseFilter('pro_vip')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    licenseFilter === 'pro_vip'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  VIP Pro ({licenses.filter(l => l.tier === 'pro_vip').length})
                </button>
                <button
                  onClick={() => setLicenseFilter('standard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    licenseFilter === 'standard'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Standard ({licenses.filter(l => l.tier === 'standard').length})
                </button>
                <button
                  onClick={() => setLicenseFilter('banned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    licenseFilter === 'banned'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Revoked ({licenses.filter(l => l.status === 'banned').length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={licenseSearch}
                  onChange={(e) => setLicenseSearch(e.target.value)}
                  placeholder="Search by license key, email, notes..."
                  className="w-full bg-[#08080A] border border-[#27272F] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

            </div>

            {/* Licenses Table with Expandable Devices */}
            <div className="bg-[#101014] border border-[#24242A] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0A0A0D] border-b border-[#24242A] text-gray-400 text-[11px] font-mono uppercase tracking-wider">
                      <th className="py-3 px-4 w-8"></th>
                      <th className="py-3 px-4">License Key</th>
                      <th className="py-3 px-4">Customer Email</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Device Usage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1C1C22]">
                    {filteredLicenses.length > 0 ? (
                      filteredLicenses.map((lic) => {
                        const isExpanded = !!expandedLicenses[lic.key];
                        return (
                          <React.Fragment key={lic.key}>
                            <tr className={`hover:bg-[#14141A] transition-colors ${
                              isExpanded ? 'bg-[#121218]' : ''
                            }`}>
                              
                              {/* Expand Button */}
                              <td className="py-3.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandLicense(lic.key)}
                                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#202028] transition-colors"
                                  title="View Registered Devices"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-amber-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </td>

                              {/* License Key */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-bold text-amber-300 select-all">
                                    {lic.key}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyText(lic.key, `raw_lic_${lic.key}`)}
                                    className="p-1 rounded hover:bg-[#22222A] text-gray-400 hover:text-white"
                                    title="Copy Key"
                                  >
                                    {copiedId === `raw_lic_${lic.key}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                {lic.notes && (
                                  <div className="text-[10px] text-gray-500 mt-0.5 italic">
                                    {lic.notes}
                                  </div>
                                )}
                              </td>

                              {/* Customer Email */}
                              <td className="py-3.5 px-4">
                                <span className="font-semibold text-gray-200">{lic.email}</span>
                              </td>

                              {/* Tier */}
                              <td className="py-3.5 px-4">
                                {lic.tier === 'pro_vip' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                                    <Crown className="w-3 h-3 text-amber-400" /> VIP PRO
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 w-fit block">
                                    STANDARD
                                  </span>
                                )}
                              </td>

                              {/* Device Usage */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="font-mono font-bold text-white">
                                    {lic.devices_count} / {lic.max_devices}
                                  </span>
                                  <span className="text-[10px] text-gray-500">devices</span>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                {lic.status === 'active' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    ACTIVE
                                  </span>
                                )}
                                {lic.status === 'banned' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    REVOKED / BANNED
                                  </span>
                                )}
                                {lic.status === 'expired' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                                    EXPIRED
                                  </span>
                                )}
                              </td>

                              {/* Created Date */}
                              <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400">
                                {lic.created_at}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {lic.status === 'active' ? (
                                    <button
                                      onClick={() => handleRevokeLicense(lic.key)}
                                      className="px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                      title="Revoke / Killswitch License"
                                    >
                                      Revoke
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReinstateLicense(lic.key)}
                                      className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                      title="Reinstate License"
                                    >
                                      Reinstate
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleDeleteLicense(lic.key)}
                                    className="p-1 text-gray-500 hover:text-rose-400 rounded hover:bg-[#22222A] transition-colors cursor-pointer"
                                    title="Delete License"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                            </tr>

                            {/* Expanded Devices Sub-table */}
                            {isExpanded && (
                              <tr className="bg-[#0C0C10]">
                                <td colSpan={8} className="p-4 border-t border-b border-[#24242E]">
                                  <div className="space-y-3 pl-6">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                        <Laptop className="w-4 h-4 text-indigo-400" />
                                        Bound Hardware Devices ({lic.devices?.length || 0} Registered)
                                      </h4>
                                      <span className="text-[11px] text-gray-400">
                                        Capacity: {lic.devices_count} / {lic.max_devices} slots used
                                      </span>
                                    </div>

                                    {lic.devices && lic.devices.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {lic.devices.map((dev) => (
                                          <div
                                            key={dev.device_hwid}
                                            className="p-3 bg-[#111116] border border-[#25252F] rounded-lg flex items-center justify-between text-xs"
                                          >
                                            <div className="space-y-0.5">
                                              <div className="font-semibold text-white flex items-center gap-2">
                                                <span>{dev.device_name || 'Browser / PC'}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                  (IP: {dev.last_ip || '127.0.0.1'})
                                                </span>
                                              </div>
                                              <div className="font-mono text-[10px] text-amber-300/80">
                                                HWID: {dev.device_hwid}
                                              </div>
                                              <div className="text-[9px] text-gray-500">
                                                Last Active: {dev.last_seen_at}
                                              </div>
                                            </div>

                                            <button
                                              onClick={() => handleForceDisconnectDevice(lic.key, dev.device_hwid)}
                                              className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                              title="Disconnect Device and Free Slot"
                                            >
                                              Disconnect Slot
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500 italic">
                                        No devices registered yet. Key has not been activated on client machine.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500 text-xs">
                          No licenses found matching search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: MINT CUSTOM LICENSE KEY */}
        {activeTab === 'mint' && (
          <div className="max-w-2xl mx-auto space-y-6 py-4">
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Mint / Generate New License</h3>
              <p className="text-xs text-gray-400">
                Issue a custom VIP Pro or Standard License directly for direct clients, manual transfers, or promotions.
              </p>
            </div>

            {mintSuccessKey && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  New Pro License Minted Successfully!
                </div>
                <div className="p-3 bg-[#0A0A0D] border border-emerald-500/30 rounded-lg flex items-center justify-between font-mono text-sm text-amber-300 font-bold">
                  <span>{mintSuccessKey}</span>
                  <button
                    type="button"
                    onClick={() => copyText(mintSuccessKey, 'mint_key')}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-sans font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'mint_key' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'mint_key' ? 'Copied!' : 'Copy Key'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Provide this key to your client. They can paste it in the "Enter License Key" tab.
                </p>
              </div>
            )}

            <form onSubmit={handleMintLicense} className="bg-[#101014] border border-[#24242A] rounded-xl p-6 space-y-4 shadow-xl">
              
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Customer Email:
                </label>
                <input
                  type="email"
                  required
                  value={mintEmail}
                  onChange={(e) => setMintEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full bg-[#08080A] border border-[#27272F] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    License Tier:
                  </label>
                  <select
                    value={mintTier}
                    onChange={(e) => {
                      const t = e.target.value as 'standard' | 'pro_vip';
                      setMintTier(t);
                      setMintMaxDevices(t === 'pro_vip' ? 3 : 1);
                    }}
                    className="w-full bg-[#08080A] border border-[#27272F] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="pro_vip">VIP Pro ($19.99 / 3+ Devices)</option>
                    <option value="standard">Standard Pro ($9.99 / 1 Device)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Max Allowed HWID Devices:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={mintMaxDevices}
                    onChange={(e) => setMintMaxDevices(Number(e.target.value))}
                    className="w-full bg-[#08080A] border border-[#27272F] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Custom Internal Notes / Reference:
                </label>
                <input
                  type="text"
                  value={mintNotes}
                  onChange={(e) => setMintNotes(e.target.value)}
                  placeholder="e.g. VIP Telegram client #842, lifetime access"
                  className="w-full bg-[#08080A] border border-[#27272F] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={mintProcessing}
                className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 hover:brightness-110 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 fill-black" />
                <span>{mintProcessing ? 'Minting License in DB...' : 'Mint & Save License Key'}</span>
              </button>

            </form>

          </div>
        )}

        {/* TAB 4: SYSTEM & ENVIRONMENT SECURITY */}
        {activeTab === 'system' && (
          <div className="max-w-3xl mx-auto space-y-6 py-4">
            
            <div className="bg-[#101014] border border-[#24242A] rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Environment & Payment Addresses Configuration
              </h3>

              <div className="space-y-3 text-xs">
                
                <div className="p-3 bg-[#08080A] border border-[#24242A] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-300">Admin Secret Key Status:</div>
                    <div className="text-gray-500 text-[11px]">Defined in container .env (ADMIN_SECRET_KEY)</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-bold border border-emerald-500/30">
                    PROTECTED (Active)
                  </span>
                </div>

                <div className="p-3 bg-[#08080A] border border-[#24242A] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-300">Official TRON USDT (TRC-20) Deposit Wallet:</div>
                    <div className="text-cyan-300 font-mono font-bold text-xs mt-0.5 break-all">
                      TQEVdoX82yQsj5gS9N8p52cH2panqUHTK3
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText('TQEVdoX82yQsj5gS9N8p52cH2panqUHTK3', 'sys_wallet')}
                    className="px-2.5 py-1 bg-[#1C1C24] hover:bg-[#252530] text-gray-300 rounded text-xs ml-2 flex-shrink-0 cursor-pointer"
                  >
                    {copiedId === 'sys_wallet' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="p-3 bg-[#08080A] border border-[#24242A] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-300">SQLite Database Persistence:</div>
                    <div className="text-gray-500 font-mono text-[11px] mt-0.5">xtream_accounts.db (licenses, payment_orders, devices)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                    WAL Mode Online
                  </span>
                </div>

              </div>
            </div>

            <div className="bg-[#101014] border border-amber-500/20 rounded-xl p-5 text-xs text-gray-400 space-y-2">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Owner Security Best Practices
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-400 text-[11px]">
                <li>Keep your <code className="text-amber-300 font-mono">ADMIN_SECRET_KEY</code> safe in your private environment settings.</li>
                <li>When confirming OKX internal transfers, double check that the sender email matches the customer's proof before clicking <strong>Approve & Key</strong>.</li>
                <li>TRON TRC-20 blockchain orders are verified on-chain and auto-activated upon confirmation.</li>
              </ul>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-[#222228] bg-[#0A0A0D] px-6 sm:px-8 flex items-center justify-between text-[11px] text-gray-500 select-none">
        <div className="flex items-center gap-2">
          <span>Xtream Validator Pro Engine</span>
          <span>•</span>
          <span className="text-amber-400 font-mono">/dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToApp}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Exit to Main Validator
          </button>
        </div>
      </footer>

    </div>
  );
};
