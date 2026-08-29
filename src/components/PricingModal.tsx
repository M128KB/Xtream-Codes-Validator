import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';

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

  const [currentTab, setCurrentTab] = useState<'pricing' | 'activate' | 'devices'>(activeModalTab || 'pricing');
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro_vip'>('pro_vip');
  const [paymentMethod, setPaymentMethod] = useState<'crypto_binance' | 'crypto_cryptocom' | 'crypto_usdt' | 'payoneer'>('crypto_binance');
  
  // Checkout & Order State
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [txRef, setTxRef] = useState<string>('');
  const [orderProcessing, setOrderProcessing] = useState<boolean>(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Activation Tab State
  const [inputKey, setInputKey] = useState<string>('');
  const [activateLoading, setActivateLoading] = useState<boolean>(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<boolean>(false);

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      setOrderError('Please provide a valid email address to receive your license key.');
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
          paymentMethod,
          paymentRef: txRef.trim() || `ORDER-${Date.now().toString(36).toUpperCase()}`,
          notes: `Instant checkout via ${paymentMethod}`,
        }),
      });

      const data = await res.json();
      if (data.success && data.license) {
        setGeneratedKey(data.license.key);
        // Automatically activate it for the user right away!
        await activateLicense(data.license.key);
      } else {
        setOrderError(data.error || 'Could not process order. Please try again.');
      }
    } catch (err: any) {
      setOrderError(err.message || 'Network connection failed');
    } finally {
      setOrderProcessing(false);
    }
  };

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
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1E1E24] bg-[#0C0C0F] text-xs font-medium flex-shrink-0">
          <button
            onClick={() => setCurrentTab('pricing')}
            className={`pb-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'pricing'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Upgrade Plans & Payment</span>
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
                        <Check className="w-3.5 h-3.5 text-gray-500" /> Live single account tester
                      </li>
                      <li className="flex items-center gap-2 text-gray-500 line-through">
                        M3U Playlist & CSV Export
                      </li>
                      <li className="flex items-center gap-2 text-gray-500 line-through">
                        Python Desktop Suite & Source
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 pt-3 border-t border-[#1C1C21] text-center text-xs text-gray-500">
                    {tier === 'free' ? 'Active Plan' : 'Free Sandbox'}
                  </div>
                </div>

                {/* Standard Pro Card */}
                <div
                  onClick={() => setSelectedPlan('standard')}
                  className={`bg-[#0E0E12] border-2 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all ${
                    selectedPlan === 'standard'
                      ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
                      : 'border-[#242428] hover:border-[#3A3A44]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold">Personal</span>
                      {selectedPlan === 'standard' && (
                        <span className="px-2 py-0.5 bg-indigo-500 text-white rounded text-[10px] font-bold">Selected</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">Standard Pro</h3>
                    <div className="mt-2 text-2xl font-black text-white">$9.99 <span className="text-xs font-normal text-gray-400">/ lifetime</span></div>
                    <ul className="mt-4 space-y-2 text-xs text-gray-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-400" /> <strong>Unlimited</strong> batch scans (10,000+)
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-400" /> Full M3U & CSV clean exports
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-400" /> Python Desktop App (.py & CLI)
                      </li>
                      <li className="flex items-center gap-2 text-amber-300 font-medium">
                        <Laptop className="w-3.5 h-3.5 text-amber-400" /> <strong>1 Active Device</strong> (HWID bound)
                      </li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('standard')}
                    className={`mt-6 w-full py-2 rounded-lg text-xs font-bold transition-all ${
                      selectedPlan === 'standard'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-[#1C1C22] text-gray-300 hover:bg-[#25252D]'
                    }`}
                  >
                    Select Standard Pro
                  </button>
                </div>

                {/* VIP Pro Card */}
                <div
                  onClick={() => setSelectedPlan('pro_vip')}
                  className={`bg-gradient-to-b from-[#14141A] to-[#0D0D11] border-2 rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden ${
                    selectedPlan === 'pro_vip'
                      ? 'border-amber-400 shadow-xl shadow-amber-500/10'
                      : 'border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-600 text-black font-extrabold text-[9px] uppercase px-3 py-0.5 rounded-bl-lg tracking-wider">
                    Recommended
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> VIP Multi-Device
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">Pro VIP Suite</h3>
                    <div className="mt-2 text-2xl font-black text-white">$19.99 <span className="text-xs font-normal text-gray-400">/ lifetime</span></div>
                    <ul className="mt-4 space-y-2 text-xs text-gray-200">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> <strong>Unlimited</strong> Ultra-speed multithreading
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> Full M3U & CSV playlist export
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400" /> Python GUI + CLI + SQLite Database
                      </li>
                      <li className="flex items-center gap-2 text-emerald-300 font-bold">
                        <Laptop className="w-3.5 h-3.5 text-emerald-400" /> <strong>Up to 3 Active Devices</strong> (PC, Phone, Laptop)
                      </li>
                      <li className="flex items-center gap-2 text-amber-300 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Anti-Ban & High Concurrency Access
                      </li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('pro_vip')}
                    className={`mt-6 w-full py-2 rounded-lg text-xs font-extrabold transition-all ${
                      selectedPlan === 'pro_vip'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20'
                        : 'bg-[#1C1C22] text-gray-300 hover:bg-[#25252D]'
                    }`}
                  >
                    Select VIP Pro (3 Devices)
                  </button>
                </div>

              </div>

              {/* Payment Methods Section */}
              <div className="bg-[#0E0E12] border border-[#242428] rounded-xl p-5 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#1E1E24] pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      Select Payment Gateway
                    </h4>
                    <p className="text-xs text-gray-400">Choose Binance Pay, Crypto.com, USDT (TRC-20), or Payoneer for instant key delivery.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Total:</span>
                    <span className="text-base font-black text-amber-400 ml-1.5">
                      {selectedPlan === 'pro_vip' ? '$19.99 USD' : '$9.99 USD'}
                    </span>
                  </div>
                </div>

                {/* Gateway Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('crypto_binance')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'crypto_binance'
                        ? 'border-amber-400 bg-amber-500/10 text-white'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#383842]'
                    }`}
                  >
                    <span className="font-bold text-xs text-amber-300">🟡 Binance Pay</span>
                    <span className="text-[10px] text-gray-400">0% Fee / Instant Pay ID</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('crypto_cryptocom')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'crypto_cryptocom'
                        ? 'border-indigo-400 bg-indigo-500/10 text-white'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#383842]'
                    }`}
                  >
                    <span className="font-bold text-xs text-indigo-300">🔵 Crypto.com</span>
                    <span className="text-[10px] text-gray-400">Crypto.com Pay / App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('crypto_usdt')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'crypto_usdt'
                        ? 'border-emerald-400 bg-emerald-500/10 text-white'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#383842]'
                    }`}
                  >
                    <span className="font-bold text-xs text-emerald-300">🟢 USDT (TRC-20)</span>
                    <span className="text-[10px] text-gray-400">Low Network Fee</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('payoneer')}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'payoneer'
                        ? 'border-orange-400 bg-orange-500/10 text-white'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#383842]'
                    }`}
                  >
                    <span className="font-bold text-xs text-orange-300">🔴 Payoneer</span>
                    <span className="text-[10px] text-gray-400">Card / Balance</span>
                  </button>
                </div>

                {/* Gateway Detail Box */}
                <div className="bg-[#0A0A0C] border border-[#202026] rounded-xl p-4 space-y-4">
                  {paymentMethod === 'crypto_binance' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-gray-300">
                          <span className="text-gray-400 block text-[11px]">Binance Pay ID:</span>
                          <code className="text-amber-300 font-mono text-sm font-bold">90TECH-BINANCE-PAY</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('90TECH-BINANCE-PAY', 'binance_id')}
                          className="px-3 py-1.5 bg-[#18181F] hover:bg-[#22222B] text-gray-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 border border-[#2E2E38] transition-colors self-start cursor-pointer"
                        >
                          {copiedField === 'binance_id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'binance_id' ? 'Copied' : 'Copy Pay ID'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Open the Binance App ➔ Tap <strong>Pay</strong> ➔ Send <strong>{selectedPlan === 'pro_vip' ? '$19.99' : '$9.99'} USDT</strong> to Pay ID above.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'crypto_cryptocom' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-gray-300">
                          <span className="text-gray-400 block text-[11px]">Crypto.com Pay ID / Email:</span>
                          <code className="text-indigo-300 font-mono text-sm font-bold">Mr90tech@gmail.com</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('Mr90tech@gmail.com', 'cdc_id')}
                          className="px-3 py-1.5 bg-[#18181F] hover:bg-[#22222B] text-gray-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 border border-[#2E2E38] transition-colors self-start cursor-pointer"
                        >
                          {copiedField === 'cdc_id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'cdc_id' ? 'Copied' : 'Copy Email'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Open Crypto.com App ➔ Tap <strong>Pay Friends</strong> ➔ Send <strong>{selectedPlan === 'pro_vip' ? '$19.99' : '$9.99'} USD</strong> with 0 fees.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'crypto_usdt' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-gray-300 overflow-hidden">
                          <span className="text-gray-400 block text-[11px]">USDT TRC-20 Wallet Address:</span>
                          <code className="text-emerald-300 font-mono text-xs font-bold break-all">TXYZ90TechValidatorDirectUSDT2026SafePay</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('TXYZ90TechValidatorDirectUSDT2026SafePay', 'usdt_addr')}
                          className="px-3 py-1.5 bg-[#18181F] hover:bg-[#22222B] text-gray-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 border border-[#2E2E38] transition-colors self-start cursor-pointer flex-shrink-0"
                        >
                          {copiedField === 'usdt_addr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'usdt_addr' ? 'Copied' : 'Copy Address'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Send exact <strong>{selectedPlan === 'pro_vip' ? '20' : '10'} USDT (TRC-20 network)</strong> to the address above.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'payoneer' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-gray-300">
                          <span className="text-gray-400 block text-[11px]">Payoneer Recipient Email:</span>
                          <code className="text-orange-300 font-mono text-sm font-bold">Mr90tech@gmail.com</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('Mr90tech@gmail.com', 'payo_email')}
                          className="px-3 py-1.5 bg-[#18181F] hover:bg-[#22222B] text-gray-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 border border-[#2E2E38] transition-colors self-start cursor-pointer"
                        >
                          {copiedField === 'payo_email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === 'payo_email' ? 'Copied' : 'Copy Email'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Log in to Payoneer ➔ <strong>Pay</strong> ➔ <strong>Make a Payment to recipient's email</strong> ({selectedPlan === 'pro_vip' ? '$19.99' : '$9.99'} USD).
                      </p>
                    </div>
                  )}

                  {/* Checkout Form */}
                  <form onSubmit={handleGenerateOrder} className="pt-3 border-t border-[#1C1C21] space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Your Email Address (where your license key is bound):
                      </label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Transaction Hash / Reference Memo (optional):
                      </label>
                      <input
                        type="text"
                        value={txRef}
                        onChange={(e) => setTxRef(e.target.value)}
                        placeholder="e.g. TXID-8394829 or Payoneer Ref"
                        className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>

                    {orderError && (
                      <p className="text-xs text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        {orderError}
                      </p>
                    )}

                    {generatedKey ? (
                      <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 text-center space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5" />
                          License Successfully Activated!
                        </div>
                        <div className="text-xs text-gray-300">Your Master License Key:</div>
                        <div className="p-2 bg-[#0A0A0C] border border-emerald-500/30 rounded font-mono text-sm text-amber-300 font-bold flex items-center justify-between">
                          <span>{generatedKey}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(generatedKey, 'gen_key')}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-[#1C1C22] rounded"
                          >
                            {copiedField === 'gen_key' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Your device fingerprint ({hwid.substring(0, 16)}...) has been registered. You now have unlimited Pro access.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={orderProcessing}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-black" />
                        {orderProcessing ? 'Verifying & Generating Key...' : `Complete Order & Activate ${selectedPlan === 'pro_vip' ? 'VIP Pro ($19.99)' : 'Standard ($9.99)'}`}
                      </button>
                    )}
                  </form>
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
                    placeholder="XVAL-VIP-XXXX-2026"
                    className="w-full bg-[#131317] border border-[#27272F] rounded-lg px-3 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-400 tracking-wider"
                  />
                </div>

                <div className="p-3 bg-[#131317] rounded-lg border border-[#202026] text-[11px] text-gray-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Detected Hardware ID (HWID):</span>
                    <code className="text-indigo-300 font-mono font-bold">{hwid.substring(0, 20)}...</code>
                  </div>
                  <div className="text-gray-500">
                    Your plan allows {tier === 'pro_vip' ? '3 devices' : '1 device'} bound simultaneously.
                  </div>
                </div>

                {activateError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>{activateError}</span>
                  </div>
                )}

                {activateSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>License verified and activated successfully! Redirecting...</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={activateLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {activateLoading ? 'Validating HWID with Server...' : 'Activate & Bind Device'}
                </button>
              </form>

              <div className="text-center">
                <span className="text-xs text-gray-500">Need a key? </span>
                <button
                  type="button"
                  onClick={() => setCurrentTab('pricing')}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  View Plans & Instant Crypto Checkout
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

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1C1C21] bg-[#0A0A0C] flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2 flex-shrink-0">
          <span>Master Developer: <strong className="text-gray-400">Mr90tech@gmail.com</strong></span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('activate')}
              className="text-indigo-400 hover:underline"
            >
              Have a key? Activate
            </button>
            <button
              onClick={closeUpgradeModal}
              className="text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
