import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Settings2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Crown,
  Lock
} from 'lucide-react';
import { XtreamAccount, ParseResult } from '../types';
import { parseXtreamTextClient } from '../utils/parser';
import { useLicense } from '../context/LicenseContext';

interface BatchValidatorTabProps {
  onAccountValidated: (account: XtreamAccount) => void;
  onRefreshDbStats: () => void;
  onOpenAccountDetail: (account: XtreamAccount) => void;
  onPlayAccount?: (account: XtreamAccount) => void;
  onValidationStateChange?: (isValidating: boolean) => void;
}

export const BatchValidatorTab: React.FC<BatchValidatorTabProps> = ({
  onAccountValidated,
  onRefreshDbStats,
  onOpenAccountDetail,
  onPlayAccount,
  onValidationStateChange,
}) => {
  const { isPro, freeScanLimit, openUpgradeModal } = useLicense();
  const [inputText, setInputText] = useState<string>('');
  const [parsedInfo, setParsedInfo] = useState<ParseResult | null>(null);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [timeout, setTimeoutSec] = useState<number>(8);
  const [userAgent, setUserAgent] = useState<string>(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTV-Client/2.0'
  );
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [saveOnlyValid, setSaveOnlyValid] = useState<boolean>(false);
  const [showPasswords, setShowPasswords] = useState<boolean>(false);

  // Validation State
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<{ processed: number; total: number; percent: number } | null>(null);
  const [currentValidatingItem, setCurrentValidatingItem] = useState<{ domain: string; username: string; index: number } | null>(null);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    valid: 0,
    expired: 0,
    invalid: 0,
    startTime: 0,
    elapsedMs: 0,
    speed: 0
  });
  const [liveResults, setLiveResults] = useState<XtreamAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'expired' | 'invalid'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    onValidationStateChange?.(isValidating);
  }, [isValidating, onValidationStateChange]);

  // Parse text whenever input changes
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedInfo(null);
      setParseProgress(null);
      return;
    }
    
    // Instant client-side parse
    const lines = inputText.split('\n');
    const totalLines = lines.length;
    if (totalLines > 200) {
      setIsParsingFile(true);
      setParseProgress({ processed: totalLines, total: totalLines, percent: 100 });
    }

    const instantParsed = parseXtreamTextClient(inputText);
    setParsedInfo(instantParsed);
    setIsParsingFile(false);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText }),
        });
        if (res.ok) {
          const data = await res.json();
          setParsedInfo(data);
        }
      } catch (e) {
        console.error('Parse error', e);
      } finally {
        setIsParsingFile(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [inputText]);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      setIsParsingFile(false);
    };
    reader.onerror = () => {
      setIsParsingFile(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setIsParsingFile(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInputText(content);
        setIsParsingFile(false);
      };
      reader.onerror = () => {
        setIsParsingFile(false);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch('/api/python/source/sample_accounts.txt');
      if (res.ok) {
        const data = await res.json();
        setInputText(data.code);
      }
    } catch {
      setInputText(
`# Sample Xtream Codes Credentials for Testing
http://xtream-demo.streamline-iptv.net:8080 demo_user_alpha pass_secret123
http://iptv.server-pro.tv:80 user_premium99 pass_secure_2026
http://mag.ultra-iptv.com:8080/get.php?username=client_sports_hd&password=client_pass_789&type=m3u_plus
http://tv.fast-iptv.cc:8080|speed_user_01|fastpass_2024
http://stream.nordic-tv.com:8000|nordic_vip|nordic_pass_332`
      );
    }
  };

  // Start batch validation
  const startValidation = async () => {
    if (!parsedInfo || parsedInfo.accounts.length === 0) return;

    // Free Tier limit enforcement: 5 lines maximum
    let accountsToCheck = [...parsedInfo.accounts];
    if (!isPro && accountsToCheck.length > freeScanLimit) {
      accountsToCheck = accountsToCheck.slice(0, freeScanLimit);
    }

    setIsValidating(true);
    stopRequestedRef.current = false;
    setLiveResults([]);

    const total = accountsToCheck.length;
    const startTime = Date.now();

    setProgress({
      completed: 0,
      total,
      valid: 0,
      expired: 0,
      invalid: 0,
      startTime,
      elapsedMs: 0,
      speed: 0,
    });

    let completed = 0;
    let validCount = 0;
    let expiredCount = 0;
    let invalidCount = 0;
    let currentIndex = 0;

    const workerLimit = Math.min(concurrency, total);

    const worker = async () => {
      while (currentIndex < total && !stopRequestedRef.current) {
        const index = currentIndex++;
        const target = accountsToCheck[index];
        if (!target) continue;

        try {
          setCurrentValidatingItem({
            domain: target.domain,
            username: target.username,
            index: index + 1
          });

          const res = await fetch('/api/validate-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain: target.domain,
              username: target.username,
              password: target.password,
              timeout,
              userAgent,
              saveToDb: autoSave && (!saveOnlyValid || true),
            }),
          });

          const result: XtreamAccount = await res.json();
          completed++;

          if (result.is_valid) {
            validCount++;
          } else if (result.status === 'Expired') {
            expiredCount++;
          } else {
            invalidCount++;
          }

          const now = Date.now();
          const elapsedSec = Math.max(0.1, (now - startTime) / 1000);
          const currentSpeed = parseFloat((completed / elapsedSec).toFixed(1));

          setProgress({
            completed,
            total,
            valid: validCount,
            expired: expiredCount,
            invalid: invalidCount,
            startTime,
            elapsedMs: now - startTime,
            speed: currentSpeed,
          });

          setLiveResults((prev) => [result, ...prev]);
          onAccountValidated(result);
        } catch (err: any) {
          completed++;
          invalidCount++;
          const failedAcc: XtreamAccount = {
            domain: target.domain,
            username: target.username,
            password: target.password,
            status: 'Server Error',
            is_valid: false,
            response_time_ms: 0,
          };
          setLiveResults((prev) => [failedAcc, ...prev]);
        }
      }
    };

    const workerPromises = Array.from({ length: workerLimit }, () => worker());
    await Promise.all(workerPromises);

    setCurrentValidatingItem(null);
    setIsValidating(false);
    onRefreshDbStats();
  };

  const stopValidation = () => {
    stopRequestedRef.current = true;
    setCurrentValidatingItem(null);
    setIsValidating(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResults = liveResults.filter((acc) => {
    if (statusFilter === 'valid') return acc.is_valid;
    if (statusFilter === 'expired') return acc.status === 'Expired';
    if (statusFilter === 'invalid') return !acc.is_valid && acc.status !== 'Expired';
    return true;
  });

  const percentComplete = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 4 Metric Cards from Elegant Dark Theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-[#111114] border border-[#242428] p-4 sm:p-5 rounded-xl shadow-sm">
          <div className="text-xs text-gray-500 mb-1 font-medium">Total Loaded</div>
          <div className="text-2xl font-mono text-white font-bold">
            {parsedInfo?.validLines || progress.total || 0}
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] p-4 sm:p-5 rounded-xl shadow-sm">
          <div className="text-xs text-gray-500 mb-1 font-medium">Valid (Stored)</div>
          <div className="text-2xl font-mono text-emerald-500 font-bold">
            {progress.valid}
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] p-4 sm:p-5 rounded-xl shadow-sm">
          <div className="text-xs text-gray-500 mb-1 font-medium">Invalid / Dead</div>
          <div className="text-2xl font-mono text-rose-500 font-bold">
            {progress.invalid}
          </div>
        </div>

        <div className="bg-[#111114] border border-[#242428] p-4 sm:p-5 rounded-xl shadow-sm">
          <div className="text-xs text-gray-500 mb-1 font-medium">Expired / Pending</div>
          <div className="text-2xl font-mono text-amber-500 font-bold">
            {progress.expired}
          </div>
        </div>
      </div>

      {/* Workspace Grid: File/Input on Left, Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input text & File Dropzone (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-white text-sm">Input Credentials (.TXT or Paste)</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="load-sample-btn"
                  onClick={handleLoadSample}
                  className="px-2.5 py-1 text-xs rounded bg-[#1C1C21] hover:bg-[#242428] text-gray-300 flex items-center gap-1.5 transition-colors border border-[#34343A]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Load Sample
                </button>
                <button
                  id="clear-input-btn"
                  onClick={() => setInputText('')}
                  disabled={!inputText}
                  className="px-2.5 py-1 text-xs rounded bg-[#1C1C21] hover:bg-[#242428] disabled:opacity-40 text-gray-400 flex items-center gap-1 transition-colors border border-[#34343A]"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear List
                </button>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              id="file-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#242428] hover:border-indigo-500 rounded-lg p-3.5 text-center cursor-pointer transition-colors bg-[#0A0A0C] group mb-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.m3u,.m3u8,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 group-hover:text-gray-300">
                <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Drop your <strong className="text-white">.txt</strong> file here or click to browse</span>
              </div>
            </div>

            {/* Raw Text Input */}
            <div className="relative">
              <textarea
                id="credentials-textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste lines here, e.g.:
http://provider-alpha.io:8080 adm_98231 pass_secret123
https://xtream-premium.net streamer_01 stream_key_2026
http://vod-master.com:2082/get.php?username=USER&password=PASS
domain.com:80|user|pass`}
                rows={8}
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg p-3 text-xs font-mono text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
              />
              <div className="absolute bottom-3 right-3 text-[11px] font-mono px-2 py-0.5 rounded bg-[#1C1C21] text-gray-400 border border-[#242428]">
                Lines: {inputText ? inputText.split('\n').length : 0}
              </div>
            </div>

            {/* Parsing Progress Notification / Bar */}
            {isParsingFile && (
              <div className="mt-3 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-300 font-medium">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span>Parsing credentials & extract accounts from text...</span>
                  </div>
                  <span className="font-mono text-xs text-indigo-300 font-bold">
                    {parseProgress ? `${parseProgress.processed} lines` : 'Processing...'}
                  </span>
                </div>
                <div className="w-full bg-[#0A0A0C] rounded-full h-1.5 overflow-hidden border border-indigo-500/20">
                  <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full w-full animate-pulse" />
                </div>
              </div>
            )}

            {/* Parse Summary Bar */}
            {parsedInfo && !isParsingFile && (
              <div className="mt-3 space-y-2">
                <div className="p-2.5 bg-[#0A0A0C] rounded-lg border border-[#242428] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">
                      Recognized Accounts: <strong className="text-emerald-400 font-semibold">{parsedInfo.validLines}</strong>
                    </span>
                    <span className="text-[#242428]">|</span>
                    <span className="text-gray-500">
                      Comment/Blank lines: {parsedInfo.totalLines - parsedInfo.validLines}
                    </span>
                  </div>
                  <span className="text-indigo-400 text-[11px] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Ready for batch test
                  </span>
                </div>

                {!isPro && parsedInfo.validLines > freeScanLimit && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        <strong>Free Tier Notice:</strong> Scanning is limited to the first <strong>5 accounts</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openUpgradeModal('pricing')}
                      className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-extrabold rounded-md text-[11px] flex items-center gap-1 shadow-sm flex-shrink-0 cursor-pointer"
                    >
                      <Crown className="w-3 h-3 fill-black" />
                      <span>Unlock Unlimited (10,000+)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Execution Settings & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#242428] pb-3">
              <Settings2 className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-white text-sm">Validation & Storage Settings</h2>
            </div>

            {/* Threads / Concurrency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-gray-300 font-medium">Worker Threads (Concurrency):</label>
                <span className="font-mono font-bold text-indigo-400 px-2 py-0.5 bg-[#0A0A0C] rounded border border-[#242428]">
                  {concurrency} threads
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                disabled={isValidating}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>1 (Gentle)</span>
                <span>10 (Recommended)</span>
                <span>30 (High Speed)</span>
              </div>
            </div>

            {/* Timeout */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-medium">Request Timeout:</label>
                <div className="flex items-center gap-1.5 bg-[#0A0A0C] border border-[#242428] rounded-lg px-2.5 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <select
                    value={timeout}
                    onChange={(e) => setTimeoutSec(Number(e.target.value))}
                    disabled={isValidating}
                    className="bg-transparent text-xs text-gray-200 focus:outline-none w-full cursor-pointer"
                  >
                    <option value={4} className="bg-[#111114]">4 seconds</option>
                    <option value={8} className="bg-[#111114]">8 seconds (Default)</option>
                    <option value={15} className="bg-[#111114]">15 seconds</option>
                    <option value={25} className="bg-[#111114]">25 seconds</option>
                  </select>
                </div>
              </div>

              {/* User Agent */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-medium">Client User-Agent:</label>
                <select
                  value={userAgent}
                  onChange={(e) => setUserAgent(e.target.value)}
                  disabled={isValidating}
                  className="bg-[#0A0A0C] border border-[#242428] rounded-lg px-2.5 py-2 text-xs text-gray-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTV-Client/2.0" className="bg-[#111114]">
                    IPTV Smarters Pro (Standard)
                  </option>
                  <option value="TiviMate/4.7.0 (Android TV)" className="bg-[#111114]">
                    TiviMate Android
                  </option>
                  <option value="VLC/3.0.18 LibVLC/3.0.18" className="bg-[#111114]">
                    VLC Media Player
                  </option>
                </select>
              </div>
            </div>

            {/* SQLite Storage Toggles */}
            <div className="pt-2 border-t border-[#242428] space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  disabled={isValidating}
                  className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Save verified accounts to SQLite (<code className="text-indigo-400">xtream_accounts.db</code>)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-400 select-none ml-6">
                <input
                  type="checkbox"
                  checked={saveOnlyValid}
                  onChange={(e) => setSaveOnlyValid(e.target.checked)}
                  disabled={!autoSave || isValidating}
                  className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Save only <strong className="text-emerald-400">Active / Valid</strong> accounts (skip dead lines)</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#242428] flex items-center gap-3">
              {!isValidating ? (
                <button
                  id="start-validation-btn"
                  onClick={startValidation}
                  disabled={!parsedInfo || parsedInfo.validLines === 0}
                  className="flex-1 py-2.5 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>
                    Start Batch Validation (
                    {!isPro && (parsedInfo?.validLines || 0) > freeScanLimit
                      ? `First ${freeScanLimit} of ${parsedInfo?.validLines} lines`
                      : `${parsedInfo?.validLines || 0} lines`}
                    )
                  </span>
                </button>
              ) : (
                <button
                  id="stop-validation-btn"
                  onClick={stopValidation}
                  className="flex-1 py-2.5 px-4 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  Stop Validation
                </button>
              )}
            </div>
          </div>

          {/* Real-time Status Card with Individual Progress */}
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-200">Validation Progress</span>
                {isValidating && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                    Testing Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-mono text-xs">
                  {progress.completed} / {progress.total}
                </span>
                <span className="font-mono font-bold text-sm text-indigo-400">
                  {percentComplete}%
                </span>
              </div>
            </div>

            {/* Segmented Multi-Color Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-[#0A0A0C] rounded-full h-3 overflow-hidden border border-[#242428] p-0.5 flex">
                {progress.total > 0 ? (
                  <>
                    {/* Valid Segment (Emerald) */}
                    <div
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-300"
                      style={{ width: `${(progress.valid / progress.total) * 100}%` }}
                      title={`Valid: ${progress.valid} (${Math.round((progress.valid / progress.total) * 100)}%)`}
                    />
                    {/* Expired Segment (Amber) */}
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${(progress.expired / progress.total) * 100}%` }}
                      title={`Expired: ${progress.expired} (${Math.round((progress.expired / progress.total) * 100)}%)`}
                    />
                    {/* Invalid / Dead Segment (Rose) */}
                    <div
                      className="bg-rose-500 h-full transition-all duration-300"
                      style={{ width: `${(progress.invalid / progress.total) * 100}%` }}
                      title={`Invalid: ${progress.invalid} (${Math.round((progress.invalid / progress.total) * 100)}%)`}
                    />
                  </>
                ) : (
                  <div className="bg-[#1C1C21] h-full w-full rounded-full" />
                )}
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono px-0.5">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  {progress.total > 0 ? Math.round((progress.valid / progress.total) * 100) : 0}% Valid
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                  {progress.total > 0 ? Math.round((progress.expired / progress.total) * 100) : 0}% Expired
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                  {progress.total > 0 ? Math.round((progress.invalid / progress.total) * 100) : 0}% Dead
                </span>
              </div>
            </div>

            {/* Currently Validating Account Ticker */}
            {isValidating && currentValidatingItem && (
              <div className="p-2.5 bg-[#0A0A0C] rounded-lg border border-indigo-500/20 text-xs font-mono flex items-center justify-between gap-2 overflow-hidden animate-pulse">
                <div className="flex items-center gap-2 truncate text-gray-300">
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600/30 text-indigo-300 rounded border border-indigo-500/30 font-bold shrink-0">
                    #{currentValidatingItem.index}
                  </span>
                  <span className="truncate text-gray-200 font-semibold">{currentValidatingItem.domain}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-indigo-400 truncate">{currentValidatingItem.username}</span>
                </div>
                <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded shrink-0">
                  Probing...
                </span>
              </div>
            )}

            {/* Progress Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono">
              <div className="bg-[#0A0A0C] p-2 rounded-lg border border-[#242428]">
                <span className="block text-[10px] text-gray-500 uppercase">Valid</span>
                <span className="text-sm font-bold text-emerald-400">{progress.valid}</span>
              </div>
              <div className="bg-[#0A0A0C] p-2 rounded-lg border border-[#242428]">
                <span className="block text-[10px] text-gray-500 uppercase">Expired</span>
                <span className="text-sm font-bold text-amber-400">{progress.expired}</span>
              </div>
              <div className="bg-[#0A0A0C] p-2 rounded-lg border border-[#242428]">
                <span className="block text-[10px] text-gray-500 uppercase">Dead</span>
                <span className="text-sm font-bold text-rose-400">{progress.invalid}</span>
              </div>
              <div className="bg-[#0A0A0C] p-2 rounded-lg border border-[#242428]">
                <span className="block text-[10px] text-gray-500 uppercase">Speed</span>
                <span className="text-sm font-bold text-indigo-300">{progress.speed}/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Results Table */}
      <div className="bg-[#111114] border border-[#242428] rounded-xl flex flex-col overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-6 bg-[#0E0E11] border-b border-[#242428]">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">
              Live Validation Queue ({liveResults.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="px-2.5 py-1 text-xs rounded bg-[#1C1C21] border border-[#34343A] text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
            </button>

            {/* Filter Pills */}
            <div className="flex items-center bg-[#0A0A0C] rounded-md p-0.5 border border-[#242428] text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'all' ? 'bg-[#1C1C21] text-white font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({liveResults.length})
              </button>
              <button
                onClick={() => setStatusFilter('valid')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'valid' ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Valid ({progress.valid})
              </button>
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'expired' ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Expired ({progress.expired})
              </button>
              <button
                onClick={() => setStatusFilter('invalid')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'invalid' ? 'bg-rose-500/10 text-rose-400 font-medium' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Dead ({progress.invalid})
              </button>
            </div>
          </div>
        </div>

        {/* Results Data Table */}
        {filteredResults.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-xs font-mono bg-[#0A0A0C]">
            {isValidating ? (
              <div className="flex flex-col items-center gap-2 text-indigo-400">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Running multi-threaded Xtream Codes validation...</span>
              </div>
            ) : (
              'No validated accounts in this view. Load .txt or paste credentials above and click Start.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto bg-[#0A0A0C]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#1C1C21] text-gray-400 uppercase text-[11px] font-bold tracking-wider border-b border-[#242428]">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Host / Domain</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4">Expiration</th>
                  <th className="py-3 px-4">Max Cons</th>
                  <th className="py-3 px-4 text-center">Latency</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242428] text-gray-300">
                {filteredResults.map((acc, i) => {
                  const uniqueKey = `${acc.domain}-${acc.username}-${i}`;
                  const m3uUrl = `${acc.domain}/get.php?username=${encodeURIComponent(acc.username)}&password=${encodeURIComponent(acc.password)}&type=m3u_plus&output=ts`;
                  const rowBg = i % 2 === 0 ? 'bg-[#111114]' : 'bg-[#131316]';

                  return (
                    <tr
                      key={uniqueKey}
                      className={`${rowBg} hover:bg-[#1C1C21] transition-colors cursor-pointer`}
                      onClick={() => onOpenAccountDetail(acc)}
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {acc.is_valid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            VALID
                          </span>
                        ) : acc.status === 'Expired' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Domain */}
                      <td className="py-3.5 px-4 text-gray-200 font-medium max-w-[220px] truncate" title={acc.domain}>
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

                      {/* Max Cons */}
                      <td className="py-3.5 px-4 text-gray-400">
                        {acc.max_connections ? `${acc.active_cons || 0}/${acc.max_connections}` : '-'}
                      </td>

                      {/* Latency */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[11px] ${
                          acc.is_valid
                            ? 'text-emerald-400'
                            : (acc.response_time_ms || 0) < 500 && acc.response_time_ms !== 0
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {acc.response_time_ms ? `${acc.response_time_ms}ms` : '---'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {onPlayAccount && acc.is_valid && (
                            <button
                              title="Play live channels in Web Player"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayAccount(acc);
                              }}
                              className="p-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-200 transition-colors border border-indigo-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-indigo-400" />
                              <span className="hidden sm:inline text-[11px] font-semibold">Play</span>
                            </button>
                          )}
                          <button
                            title="Copy M3U Playlist URL"
                            onClick={() => copyToClipboard(m3uUrl, uniqueKey)}
                            className="p-1.5 rounded bg-[#1C1C21] hover:bg-[#242428] text-gray-300 transition-colors border border-[#34343A] cursor-pointer"
                          >
                            {copiedId === uniqueKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
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
      </div>
    </div>
  );
};
