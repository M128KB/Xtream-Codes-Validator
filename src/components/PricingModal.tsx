import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  Crown,
  ShieldCheck,
  Laptop,
  Smartphone,
  Copy,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Trash2,
  ExternalLink,
  QrCode,
  CreditCard,
  Layers,
  Sparkles,
  Lock,
  Clock,
  RefreshCw,
  Search,
  PlusCircle,
  XCircle,
  Sliders
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { PaymentOrder } from '../types';

export const PricingModal: React.FC = () => {
  const {
    tier,
    isPro,
    licenseKey,
    licenseInfo,
    hwid,
    isUpgradeModalOpen,
    activeModalTab,
    openUpgradeModal,
    closeUpgradeModal,
    activateLicense,
    deactivateLicense,
    disconnectDevice,
  } = useLicense();

  const [currentTab, setCurrentTab] = useState<'pricing' | 'activate' | 'devices' | 'admin'>(activeModalTab || 'pricing');
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro_vip'>('pro_vip');
  const [okxTransferType, setOkxTransferType] = useState<'internal' | 'trc20'>('internal');
  
  // Checkout & Order State
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [txRef, setTxRef] = useState<string>('');
  const [orderProcessing, setOrderProcessing] = useState<boolean>(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [orderRecord, setOrderRecord] = useState<PaymentOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);

  // Activation Tab State
  const [inputKey, setInputKey] = useState<string>('');
  const [activateLoading, setActivateLoading] = useState<boolean>(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<boolean>(false);

  // Admin Tab State
  const [adminPin, setAdminPin] = useState<string>('');
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminOrders, setAdminOrders] = useState<PaymentOrder[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminFilter, setAdminFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [manualEmail, setManualEmail] = useState<string>('');
  const [manualTier, setManualTier] = useState<'standard' | 'pro_vip'>('pro_vip');
  const [manualCreatedKey, setManualCreatedKey] = useState<string | null>(null);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (activeModalTab) {
      setCurrentTab(activeModalTab);
    }
  }, [activeModalTab]);

  if (!isUpgradeModalOpen) return null;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivateError(null);
    setActivateSuccess(false);

    if (!inputKey.trim()) {
      setActivateError('Please enter your license key.');
      return;
    }

    setActivateLoading(true);
    const res = await activateLicense(inputKey.trim());
    setActivateLoading(false);

    if (res.success) {
      setActivateSuccess(true);
      setTimeout(() => {
        closeUpgradeModal();
      }, 1500);
    } else {
      setActivateError(res.error || 'Failed to activate. Check key or device limits.');
    }
  };

  const handleGenerateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setOrderError('Please provide a valid email address.');
      return;
    }

    if (!txRef.trim()) {
      setOrderError(
        okxTransferType === 'internal'
          ? 'Please enter your OKX account email or Internal Transfer ID.'
          : 'Please enter the TRON USDT (TRC-20) Transaction Hash (TxID).'
      );
      return;
    }

    setOrderProcessing(true);

    try {
      const res = await fetch('/api/license/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail.trim(),
          tier: selectedPlan,
          paymentType: okxTransferType === 'internal' ? 'okx_internal' : 'okx_trc20',
          txHash: txRef.trim(),
          notes: `Checkout via OKX Crypto (${okxTransferType === 'internal' ? 'OKX Internal' : 'USDT TRC-20'})`,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setOrderRecord(data.order);
        setOrderSuccess(true);

        if (data.autoActivated && data.licenseKey) {
          setGeneratedKey(data.licenseKey);
          await activateLicense(data.licenseKey);
        }
      } else {
        setOrderError(data.error || 'Could not submit order. Please check details and try again.');
      }
    } catch (err: any) {
      setOrderError(err.message || 'Network connection failed');
    } finally {
      setOrderProcessing(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    if (adminPin === '90tech' || adminPin === 'admin123') {
      setAdminAuthenticated(true);
      fetchAdminOrders(adminPin);
    } else {
      setAdminAuthError('Invalid Admin PIN. Please check master PIN.');
    }
  };

  const fetchAdminOrders = async (pin: string = adminPin) => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'x-admin-pin': pin }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminOrders(data.orders || []);
      }
    } catch (e) {
      console.error('Failed to fetch admin orders', e);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin/orders/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          fetchAdminOrders(adminPin);
          if (data.license?.key) {
            copyToClipboard(data.license.key, `lic_${orderId}`);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!confirm(`Reject order ${orderId}?`)) return;
    try {
      const res = await fetch('/api/admin/orders/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify({ orderId, reason: 'Payment reference not found on OKX account' })
      });
      if (res.ok) {
        fetchAdminOrders(adminPin);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateManualKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualCreatedKey(null);
    try {
      const res = await fetch('/api/admin/licenses/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify({
          email: manualEmail || 'custom-client@iptv.com',
          tier: manualTier,
          maxDevices: manualTier === 'pro_vip' ? 3 : 1,
          notes: 'Owner issued key'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.license) {
          setManualCreatedKey(data.license.key);
          setManualEmail('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredOrders = adminOrders.filter(o => {
    if (adminFilter !== 'all' && o.status !== adminFilter) return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      return o.email.toLowerCase().includes(q) || o.order_id.toLowerCase().includes(q) || o.tx_hash.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#111114] border border-[#242428] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#242428] bg-[#0E0E11] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Crown className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Xtream Validator Pro & Licensing</h2>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    {tier === 'pro_vip' ? 'VIP PRO (3 Devices)' : 'STANDARD PRO (1 Device)'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">Unlimited scans, clean M3U playlist export, and Python Desktop Suite.</p>
            </div>
          </div>

          <button
            onClick={closeUpgradeModal}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-[#1E1E24] bg-[#0C0C0F] text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentTab('pricing')}
              className={`pb-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'pricing'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Upgrade Plans & OKX Payment</span>
            </button>

            <button
              onClick={() => setCurrentTab('activate')}
              className={`pb-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'activate'
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Enter License Key</span>
            </button>

            <button
              onClick={() => setCurrentTab('devices')}
              className={`pb-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'devices'
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Device Manager {licenseInfo ? `(${licenseInfo.devicesCount}/${licenseInfo.maxDevices})` : ''}</span>
            </button>
          </div>

          {/* Owner Admin Orders Tab */}
          <button
            onClick={() => setCurrentTab('admin')}
            className={`pb-3 px-2 border-b-2 font-semibold transition-all flex items-center gap-1 cursor-pointer text-[11px] ${
              currentTab === 'admin'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Owner Admin</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow">

          {/* TAB 1: PRICING & PAYMENT */}
          {currentTab === 'pricing' && (
            <div className="space-y-6">
              
              {/* Plan Selector Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Free Tier Card */}
                <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-4 flex flex-col justify-between opacity-80">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Current Base</span>
                    <h3 className="text-lg font-bold text-white mt-1">Free Tier</h3>
                    <div className="mt-2 text-2xl font-black text-gray-300">$0 <span className="text-xs font-normal text-gray-500">/ forever</span></div>
                    <ul className="mt-4 space-y-2 text-xs text-gray-400">
                      <li className="flex items-center gap-2 text-gray-300">
                        <Check className="w-3.5 h-3.5 text-gray-500" /> Max 5 lines per batch
                      </li>
                      <li className="flex items-center gap-2 text-gray-300">
                        <Check className="w-3.5 h-3.5 text-gray-500" /> Basic server status check
                      </li>
                      <li className="flex items-center gap-2 text-gray-300">
                        <Check className="w-3.5 h-3.5 text-gray-500" /> CSV Text export
                      </li>
                      <li className="flex items-center gap-2 text-gray-500 line-through">
                        Custom M3U playlist generator
                      </li>
                      <li className="flex items-center gap-2 text-gray-500 line-through">
                        Python Desktop GUI app
                      </li>
                    </ul>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#1C1C21] text-[11px] text-gray-500 text-center">
                    Active by default
                  </div>
                </div>

                {/* Standard Pro Card */}
                <div
                  onClick={() => setSelectedPlan('standard')}
                  className={`bg-[#0E0E12] border-2 rounded-xl p-4 flex flex-col justify-between transition-all cursor-pointer relative ${
                    selectedPlan === 'standard'
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 bg-indigo-950/10'
                      : 'border-[#242428] hover:border-gray-600'
                  }`}
                >
                  {selectedPlan === 'standard' && (
                    <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                      SELECTED
                    </div>
                  )}
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400">Single Device</span>
                    <h3 className="text-lg font-bold text-white mt-1">Standard Pro</h3>
                    <div className="mt-2 text-2xl font-black text-white">$9.99 <span className="text-xs font-normal text-gray-400">/ lifetime key</span></div>
                    <ul className="mt-4 space-y-2 text-xs text-gray-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> <strong>Unlimited</strong> batch validation
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> <strong>1 Registered Device</strong> (HWID lock)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Full M3U playlist exporter
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Python GUI & CLI standalone scripts
                      </li>
                    </ul>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#1C1C21]">
                    <button
                      type="button"
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedPlan === 'standard'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-[#1C1C22] text-gray-300 hover:text-white'
                      }`}
                    >
                      Select Standard ($9.99)
                    </button>
                  </div>
                </div>

                {/* VIP Pro (3 Devices) Card */}
                <div
                  onClick={() => setSelectedPlan('pro_vip')}
                  className={`bg-[#0E0E12] border-2 rounded-xl p-4 flex flex-col justify-between transition-all cursor-pointer relative ${
                    selectedPlan === 'pro_vip'
                      ? 'border-amber-400 shadow-xl shadow-amber-500/10 bg-amber-950/15'
                      : 'border-[#242428] hover:border-gray-600'
                  }`}
                >
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-black tracking-wider">
                    MOST POPULAR
                  </div>
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Power Multi-Device</span>
                    <h3 className="text-lg font-bold text-white mt-1">VIP Pro Multi-Device</h3>
                    <div className="mt-2 text-2xl font-black text-amber-300">$19.99 <span className="text-xs font-normal text-gray-400">/ lifetime key</span></div>
                    <ul className="mt-4 space-y-2 text-xs text-gray-200">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> <strong>Up to 3 Devices</strong> (PC, Laptop, Mobile)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> <strong>Unlimited</strong> high-speed scans (50+ threads)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> Full Category Filtered M3U Generator
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> Python GUI Standalone Exe builder
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> Priority updates & Support
                      </li>
                    </ul>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#1C1C21]">
                    <button
                      type="button"
                      className={`w-full py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        selectedPlan === 'pro_vip'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-md'
                          : 'bg-[#1C1C22] text-gray-300 hover:text-white'
                      }`}
                    >
                      Select VIP Pro ($19.99)
                    </button>
                  </div>
                </div>

              </div>

              {/* Payment Section (OKX Crypto Exclusive) */}
              <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E1E24] pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      Complete Payment via OKX Crypto
                    </h4>
                    <p className="text-xs text-gray-400">
                      Chosen Tier: <strong className="text-white">{selectedPlan === 'pro_vip' ? 'VIP Pro Multi-Device (3 Devices)' : 'Standard Pro (1 Device)'}</strong> — Price: <strong className="text-amber-400">{selectedPlan === 'pro_vip' ? '$19.99 USD' : '$9.99 USD'}</strong>
                    </p>
                  </div>

                  {/* Transfer Type Selector */}
                  <div className="flex items-center bg-[#141418] border border-[#27272F] rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setOkxTransferType('internal')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${
                        okxTransferType === 'internal'
                          ? 'bg-amber-500 text-black font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      OKX Internal (0 Fee)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOkxTransferType('trc20')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${
                        okxTransferType === 'trc20'
                          ? 'bg-amber-500 text-black font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      USDT TRC-20
                    </button>
                  </div>
                </div>

                {/* Transfer Details View */}
                <div className="space-y-4">
                  {okxTransferType === 'internal' ? (
                    <div className="p-4 bg-[#111114] border border-[#242428] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300">Recipient OKX Account / Email:</span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Zero OKX Internal Fee
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-[#0A0A0C] border border-[#27272F] rounded-lg font-mono text-sm text-amber-300 font-bold select-all">
                        <span>m.128kb@gmail.com</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('m.128kb@gmail.com', 'okx_email')}
                          className="px-2.5 py-1 bg-[#1E1E26] hover:bg-[#2A2A35] text-gray-300 hover:text-white rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === 'okx_email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'okx_email' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-gray-400 leading-relaxed bg-[#0A0A0C]/50 p-2.5 rounded border border-[#1E1E24]">
                        <p className="font-semibold text-gray-300 mb-1">How to pay in OKX app / website:</p>
                        <p className="text-gray-400">
                          1. Open <strong>OKX App</strong> ➔ <strong>Transfer / Send</strong> ➔ Select <strong>Internal Transfer (Free)</strong>.<br />
                          2. Enter recipient email: <code className="text-amber-300 font-mono">m.128kb@gmail.com</code>.<br />
                          3. Send amount: <strong>{selectedPlan === 'pro_vip' ? '$19.99 USD' : '$9.99 USD'}</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#111114] border border-[#242428] rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300">Recipient USDT TRC-20 (Tron Network) Address:</span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          TRON Network
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-[#0A0A0C] border border-[#27272F] rounded-lg font-mono text-xs sm:text-sm text-amber-300 font-bold select-all break-all">
                        <span>TQEVdoX82yQsj5gS9N8p52cH2panqUHTK3</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('TQEVdoX82yQsj5gS9N8p52cH2panqUHTK3', 'usdt_trc20')}
                          className="px-2.5 py-1 bg-[#1E1E26] hover:bg-[#2A2A35] text-gray-300 hover:text-white rounded text-xs transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0 ml-2"
                        >
                          {copiedField === 'usdt_trc20' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'usdt_trc20' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-gray-400 leading-relaxed bg-[#0A0A0C]/50 p-2.5 rounded border border-[#1E1E24]">
                        <p className="font-semibold text-gray-300 mb-1">How to pay via TRC-20 On-Chain:</p>
                        <p className="text-gray-400">
                          1. Open <strong>OKX App</strong> ➔ <strong>Withdraw USDT</strong> ➔ Select <strong>USDT-TRC20</strong> network.<br />
                          2. Paste the deposit address above and transfer <strong>{selectedPlan === 'pro_vip' ? '20' : '10'} USDT</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Checkout & Verification Form */}
                  {orderSuccess && orderRecord ? (
                    <div className="p-4 bg-emerald-950/25 border border-emerald-500/40 rounded-xl space-y-3 animate-in fade-in">
                      {generatedKey ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5" />
                            Payment Confirmed on TRON Blockchain! License Activated!
                          </div>
                          <div className="text-xs text-gray-300">Your Master Pro License Key:</div>
                          <div className="p-2.5 bg-[#0A0A0C] border border-emerald-500/30 rounded font-mono text-sm text-amber-300 font-bold flex items-center justify-between">
                            <span>{generatedKey}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(generatedKey, 'gen_key')}
                              className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-[#1C1C22] rounded flex items-center gap-1"
                            >
                              {copiedField === 'gen_key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === 'gen_key' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            Your device fingerprint ({hwid.substring(0, 16)}...) has been activated. You now have unlimited Pro access.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                            <Clock className="w-5 h-5 animate-pulse" />
                            Order #{orderRecord.order_id} Submitted for Verification
                          </div>
                          <div className="p-3 bg-[#0A0A0C] border border-[#242428] rounded-lg text-xs space-y-1.5 font-mono text-gray-300">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Order ID:</span>
                              <span className="text-amber-300 font-bold">{orderRecord.order_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Bound Email:</span>
                              <span>{orderRecord.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Amount:</span>
                              <span>${orderRecord.amount_usd} USD</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Status:</span>
                              <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                ⏳ Pending Admin Confirmation
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            Your payment proof has been queued for verification. As soon as the OKX transfer is confirmed by the administrator, your License Key will be issued.
                          </p>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOrderSuccess(false);
                                setCurrentTab('activate');
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Enter License Key Once Received
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderSuccess(false);
                                setTxRef('');
                              }}
                              className="px-3 py-1.5 bg-[#1C1C22] text-gray-400 hover:text-white rounded-lg text-xs cursor-pointer"
                            >
                              Submit Another Order
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleGenerateOrder} className="pt-3 border-t border-[#1C1C21] space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Your Email Address (Required):
                        </label>
                        <input
                          type="email"
                          required
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="you@gmail.com"
                          className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                        <span className="text-[10px] text-gray-500 mt-0.5 block">
                          License key will be cryptographically bound to this email.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          {okxTransferType === 'internal'
                            ? 'Your OKX Account Email / Internal Transfer ID (Required):'
                            : 'TRON USDT (TRC-20) Transaction Hash / TxID (Required):'}
                        </label>
                        <input
                          type="text"
                          required
                          value={txRef}
                          onChange={(e) => setTxRef(e.target.value)}
                          placeholder={
                            okxTransferType === 'internal'
                              ? 'e.g. sender@gmail.com or OKX Transfer #184920'
                              : 'e.g. 7f9b2...84a2 (64-character TRON TxID)'
                          }
                          className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                        <span className="text-[10px] text-gray-500 mt-0.5 block">
                          {okxTransferType === 'internal'
                            ? 'Used by the owner to match the deposit in OKX.'
                            : 'TRON blockchain hashes are automatically verified on-chain.'}
                        </span>
                      </div>

                      {orderError && (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {orderError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={orderProcessing}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4 fill-black" />
                        {orderProcessing
                          ? 'Verifying Payment & Submitting...'
                          : okxTransferType === 'trc20'
                          ? `Verify TRON Blockchain & Activate (${selectedPlan === 'pro_vip' ? '$19.99' : '$9.99'})`
                          : `Submit OKX Transfer Proof (${selectedPlan === 'pro_vip' ? '$19.99' : '$9.99'})`}
                      </button>
                    </form>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: ENTER LICENSE KEY */}
          {currentTab === 'activate' && (
            <div className="max-w-lg mx-auto space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Activate Existing License</h3>
                <p className="text-xs text-gray-400">
                  Paste the License Key you received upon purchase. Your device hardware fingerprint will be automatically bound.
                </p>
              </div>

              <form onSubmit={handleActivateSubmit} className="space-y-4 bg-[#0A0A0C] border border-[#242428] rounded-xl p-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    License Key:
                  </label>
                  <input
                    type="text"
                    required
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="XTREAM-VIP-XXXX-XXXX or XTREAM-STD-XXXX"
                    className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3.5 py-2.5 text-xs text-amber-300 focus:outline-none focus:border-indigo-400 font-mono tracking-wider font-bold"
                  />
                </div>

                <div className="p-3 bg-[#111114] border border-[#242428] rounded-lg text-xs space-y-1">
                  <div className="text-gray-400 font-semibold flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                    Target Hardware ID (HWID):
                  </div>
                  <div className="font-mono text-[11px] text-gray-500 break-all select-all">
                    {hwid}
                  </div>
                </div>

                {activateError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {activateError}
                  </p>
                )}

                {activateSuccess && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    License Activated Successfully! Enjoy Pro access.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={activateLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {activateLoading ? 'Verifying with License Server...' : 'Activate This Device'}
                </button>
              </form>

              <div className="text-center">
                <button
                  onClick={() => setCurrentTab('pricing')}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  Need a license? View Plans & OKX Payment
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DEVICE MANAGER */}
          {currentTab === 'devices' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-400" />
                    Registered Device Hardware IDs (HWID)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Active Slots: <strong className="text-white">{licenseInfo ? licenseInfo.devicesCount : 0}</strong> /{' '}
                    <strong className="text-amber-400">{licenseInfo ? licenseInfo.maxDevices : 1}</strong> Allowed Devices
                  </p>
                </div>

                {isPro && (
                  <button
                    type="button"
                    onClick={deactivateLicense}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer self-start"
                  >
                    Unlink License from this Browser
                  </button>
                )}
              </div>

              {/* Devices List */}
              <div className="space-y-3">
                {licenseInfo && licenseInfo.devices && licenseInfo.devices.length > 0 ? (
                  licenseInfo.devices.map((dev, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        dev.isCurrent
                          ? 'border-emerald-500/40 bg-emerald-950/15'
                          : 'border-[#242428] bg-[#0A0A0C]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          dev.isCurrent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#18181F] text-gray-400'
                        }`}>
                          <Laptop className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{dev.name || 'Web Browser'}</span>
                            {dev.isCurrent && (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                This Device
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            HWID: {dev.hwid.substring(0, 24)}...
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Last Active: {dev.lastSeen || 'Recently'}
                          </div>
                        </div>
                      </div>

                      <div>
                        {!dev.isCurrent ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('Disconnect this device to free up a slot?')) {
                                await disconnectDevice(dev.hwid);
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Disconnect (Free Slot)</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Active Session
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-8 text-center text-gray-400 text-xs space-y-2">
                    <Laptop className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-white font-semibold">No active devices registered yet.</p>
                    <p className="text-gray-500">
                      Activate your license key above to bind this computer/browser automatically.
                    </p>
                  </div>
                )}
              </div>

              {/* Security & Multi-IP Sharing Notice */}
              <div className="bg-[#0A0A0C] border border-amber-500/20 rounded-xl p-4 text-xs text-gray-400 space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Anti-Sharing & Abuse Protection Rules:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400 pl-1">
                  <li>Standard Plan is strictly locked to <strong>1 physical device HWID</strong>.</li>
                  <li>Pro VIP Plan allows up to <strong>3 registered devices</strong> (e.g. desktop PC, laptop, phone).</li>
                  <li>License sharing triggers an automatic lock if more than 10 distinct IP addresses connect within 1 hour.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: OWNER ADMIN ORDERS & KEY MANAGEMENT */}
          {currentTab === 'admin' && (
            <div className="space-y-6">
              {!adminAuthenticated ? (
                <div className="max-w-md mx-auto py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Owner Order Verification Portal</h3>
                  <p className="text-xs text-gray-400">
                    Enter the master admin PIN to review pending customer payments, approve orders, and issue license keys.
                  </p>

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <input
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="Enter Admin PIN (e.g. 90tech)"
                      className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg px-3 py-2.5 text-xs text-center text-white focus:outline-none focus:border-rose-400 font-mono tracking-widest"
                    />

                    {adminAuthError && (
                      <p className="text-xs text-rose-400">{adminAuthError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Unlock Owner Orders Panel
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0A0C] border border-[#242428] rounded-xl p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">Owner Payment Queue</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {adminOrders.length} Total Orders
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Target Deposit OKX: <strong className="text-amber-300 font-mono">m.128kb@gmail.com</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="/dashboard"
                        onClick={(e) => {
                          e.preventDefault();
                          closeUpgradeModal();
                          window.history.pushState({}, '', '/dashboard');
                          window.dispatchEvent(new PopStateEvent('popstate'));
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Full /dashboard</span>
                      </a>
                      <button
                        onClick={() => fetchAdminOrders()}
                        disabled={adminLoading}
                        className="px-3 py-1.5 bg-[#1C1C22] hover:bg-[#25252E] text-gray-300 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={() => setAdminAuthenticated(false)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs cursor-pointer"
                      >
                        Lock Panel
                      </button>
                    </div>
                  </div>

                  {/* Manual Key Generator Box */}
                  <div className="bg-[#0A0A0C] border border-indigo-500/20 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4" /> Quick Manual Key Generator (Issue for Client)
                    </h4>
                    <form onSubmit={handleCreateManualKey} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="client-email@domain.com"
                        className="sm:col-span-6 bg-[#131317] border border-[#27272F] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <select
                        value={manualTier}
                        onChange={(e) => setManualTier(e.target.value as any)}
                        className="sm:col-span-3 bg-[#131317] border border-[#27272F] rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="pro_vip">VIP Pro (3 Devices)</option>
                        <option value="standard">Standard (1 Device)</option>
                      </select>
                      <button
                        type="submit"
                        className="sm:col-span-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Generate Key
                      </button>
                    </form>

                    {manualCreatedKey && (
                      <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded-lg flex items-center justify-between font-mono text-xs text-amber-300 font-bold">
                        <span>{manualCreatedKey}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(manualCreatedKey, 'man_key')}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px]"
                        >
                          {copiedField === 'man_key' ? 'Copied!' : 'Copy Key'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter and Search */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-[#0A0A0C] border border-[#242428] rounded-lg p-1 text-xs">
                      <button
                        onClick={() => setAdminFilter('all')}
                        className={`px-2.5 py-1 rounded ${adminFilter === 'all' ? 'bg-[#25252E] text-white font-bold' : 'text-gray-400'}`}
                      >
                        All ({adminOrders.length})
                      </button>
                      <button
                        onClick={() => setAdminFilter('pending')}
                        className={`px-2.5 py-1 rounded ${adminFilter === 'pending' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-gray-400'}`}
                      >
                        Pending ({adminOrders.filter(o => o.status === 'pending').length})
                      </button>
                      <button
                        onClick={() => setAdminFilter('approved')}
                        className={`px-2.5 py-1 rounded ${adminFilter === 'approved' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400'}`}
                      >
                        Approved ({adminOrders.filter(o => o.status === 'approved').length})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        placeholder="Search email, order, or TxID..."
                        className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="space-y-3">
                    {filteredOrders.length === 0 ? (
                      <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-8 text-center text-gray-500 text-xs">
                        No orders match the current filter.
                      </div>
                    ) : (
                      filteredOrders.map((ord) => (
                        <div
                          key={ord.order_id}
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            ord.status === 'approved'
                              ? 'border-emerald-500/30 bg-emerald-950/10'
                              : ord.status === 'rejected'
                              ? 'border-rose-500/20 bg-rose-950/10'
                              : 'border-amber-500/30 bg-amber-950/10'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white">{ord.order_id}</span>
                              <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                ord.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : ord.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                {ord.status}
                              </span>
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.2 rounded">
                                ${ord.amount_usd} USD ({ord.tier === 'pro_vip' ? 'VIP Pro' : 'Standard'})
                              </span>
                            </div>

                            <div className="text-xs text-gray-300 font-mono">
                              Email: <strong className="text-white">{ord.email}</strong>
                            </div>

                            <div className="text-[11px] text-gray-400 font-mono break-all">
                              Payment: <span className="text-cyan-300">{ord.payment_type}</span> | Ref/TxID:{' '}
                              <strong className="text-amber-300">{ord.tx_hash}</strong>
                            </div>

                            {ord.license_key && (
                              <div className="pt-1 flex items-center gap-2">
                                <span className="text-[11px] text-gray-400">License Key:</span>
                                <span className="font-mono text-xs text-emerald-400 font-bold">{ord.license_key}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(ord.license_key!, `lic_${ord.order_id}`)}
                                  className="text-[10px] px-1.5 py-0.5 bg-[#1E1E24] hover:bg-[#2A2A35] text-gray-300 rounded"
                                >
                                  {copiedField === `lic_${ord.order_id}` ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            )}

                            <div className="text-[10px] text-gray-500">
                              Created: {ord.created_at} {ord.notes ? `• ${ord.notes}` : ''}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ord.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(ord.order_id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve & Issue Key</span>
                              </button>
                            )}

                            {ord.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(ord.order_id)}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1C1C21] bg-[#0A0A0C] flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2 flex-shrink-0">
          <span>Official Recipient OKX: <strong className="text-gray-400 font-mono">m.128kb@gmail.com</strong></span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('activate')}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              Have a key? Activate
            </button>
            <button
              onClick={closeUpgradeModal}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
