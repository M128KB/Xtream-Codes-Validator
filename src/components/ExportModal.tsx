import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  Tv,
  Crown,
  Zap,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Braces,
  AlertCircle
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { getOrCreateUserDatabaseId } from '../utils/fingerprint';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { isPro, openUpgradeModal } = useLicense();
  const [format, setFormat] = useState<'m3u' | 'json' | 'csv' | 'txt' | 'sqlite'>('m3u');
  const [statusFilter, setStatusFilter] = useState<'Valid' | 'All' | 'Expired'>('Valid');

  // Live preview state
  const [previewText, setPreviewText] = useState<string>('');
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const [previewLines, setPreviewLines] = useState<number>(0);
  const [previewSizeBytes, setPreviewSizeBytes] = useState<number>(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchLivePreview = useCallback(async (fmt: 'm3u' | 'json' | 'csv' | 'txt' | 'sqlite', status: 'Valid' | 'All' | 'Expired') => {
    if (fmt === 'sqlite') {
      setPreviewText('');
      setPreviewFilename(`xtream_accounts.db`);
      setPreviewLines(0);
      setPreviewSizeBytes(0);
      setPreviewError(null);
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const userId = getOrCreateUserDatabaseId();
      const res = await fetch(
        `/api/export/preview?format=${fmt}&status=${status}&userId=${encodeURIComponent(userId)}`
      );

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setPreviewText(data.data || '');
      setPreviewFilename(data.filename || `xtream_accounts_${status.toLowerCase()}.${fmt}`);
      setPreviewLines(data.lines || (data.data ? data.data.split('\n').length : 0));
      setPreviewSizeBytes(data.sizeBytes || (data.data ? new Blob([data.data]).size : 0));
    } catch (err: any) {
      console.error('Failed to fetch live export preview:', err);
      setPreviewError(err.message || 'Failed to load preview');
      setPreviewText('');
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  // Fetch or update preview whenever modal is opened or format/filter changes
  useEffect(() => {
    if (isOpen) {
      fetchLivePreview(format, statusFilter);
    }
  }, [isOpen, format, statusFilter, fetchLivePreview]);

  if (!isOpen) return null;

  const handleCopyPreview = () => {
    if (!previewText) return;
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!isPro) {
      onClose();
      openUpgradeModal('pricing');
      return;
    }

    const userId = getOrCreateUserDatabaseId();
    if (format === 'sqlite') {
      window.location.href = `/api/db/download-sqlite?userId=${encodeURIComponent(userId)}`;
    } else {
      window.location.href = `/api/export?format=${format}&status=${statusFilter}&userId=${encodeURIComponent(userId)}`;
    }
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#111114] border border-[#242428] rounded-2xl w-full max-w-2xl sm:max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#242428] flex items-center justify-between bg-[#0E0E11] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Export Database Accounts</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold uppercase tracking-wider">
                  Live Preview
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Inspect generated output in real-time before downloading
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {!isPro && (
            <div className="bg-gradient-to-br from-[#1A1610] to-[#121014] border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Pro Feature: Unlimited M3U, JSON & CSV Playlist Export</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 font-semibold border border-amber-400/20">
                  Preview Active
                </span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[11px]">
                You can live-preview the exact output below. Upgrading to the Pro Tier unlocks instant full-file downloads and API generation.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openUpgradeModal('pricing');
                }}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-extrabold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Upgrade to Pro to Unlock Instant Downloads ($9.99)</span>
              </button>
            </div>
          )}

          {/* Step 1: Format Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-white">1. Select Export Format:</label>
              <span className="text-[11px] text-gray-400 font-mono">Format: <strong className="text-indigo-300 uppercase">.{format}</strong></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* M3U */}
              <button
                type="button"
                onClick={() => setFormat('m3u')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  format === 'm3u'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A] hover:bg-[#121216]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Tv className={`w-4 h-4 ${format === 'm3u' ? 'text-indigo-400' : 'text-gray-500'}`} />
                  {format === 'm3u' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                </div>
                <div>
                  <span className="font-semibold text-white block text-xs">M3U Playlist</span>
                  <span className="text-[10px] text-gray-500">.m3u (IPTV players)</span>
                </div>
              </button>

              {/* JSON */}
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  format === 'json'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A] hover:bg-[#121216]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Braces className={`w-4 h-4 ${format === 'json' ? 'text-indigo-400' : 'text-gray-500'}`} />
                  {format === 'json' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                </div>
                <div>
                  <span className="font-semibold text-white block text-xs">JSON Data</span>
                  <span className="text-[10px] text-gray-500">.json (API / Scripts)</span>
                </div>
              </button>

              {/* CSV */}
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A] hover:bg-[#121216]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <FileSpreadsheet className={`w-4 h-4 ${format === 'csv' ? 'text-indigo-400' : 'text-gray-500'}`} />
                  {format === 'csv' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                </div>
                <div>
                  <span className="font-semibold text-white block text-xs">CSV Sheet</span>
                  <span className="text-[10px] text-gray-500">.csv (Excel / Sheets)</span>
                </div>
              </button>

              {/* TXT */}
              <button
                type="button"
                onClick={() => setFormat('txt')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  format === 'txt'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A] hover:bg-[#121216]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <FileText className={`w-4 h-4 ${format === 'txt' ? 'text-indigo-400' : 'text-gray-500'}`} />
                  {format === 'txt' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                </div>
                <div>
                  <span className="font-semibold text-white block text-xs">Plain Text</span>
                  <span className="text-[10px] text-gray-500">.txt (domain user pass)</span>
                </div>
              </button>

              {/* SQLite DB */}
              <button
                type="button"
                onClick={() => setFormat('sqlite')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                  format === 'sqlite'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-500/50'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A] hover:bg-[#121216]'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Database className={`w-4 h-4 ${format === 'sqlite' ? 'text-indigo-400' : 'text-gray-500'}`} />
                  {format === 'sqlite' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                </div>
                <div>
                  <span className="font-semibold text-white block text-xs">SQLite DB</span>
                  <span className="text-[10px] text-gray-500">.db (Raw database)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Filter Selection (when not raw sqlite) */}
          {format !== 'sqlite' && (
            <div className="space-y-1.5 pt-1">
              <label className="font-semibold text-white block">2. Target Accounts Filter:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Valid', 'All', 'Expired'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`py-1.5 px-3 rounded-lg border text-center font-medium transition-all cursor-pointer text-xs ${
                      statusFilter === filter
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200 font-semibold ring-1 ring-indigo-500/40'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                    }`}
                  >
                    {filter === 'Valid' ? 'Valid Only' : filter === 'All' ? 'All Accounts' : 'Expired Only'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Live Output Preview Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-white font-semibold">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>Live Output Preview:</span>
                </div>
                {previewFilename && (
                  <span className="px-2 py-0.5 rounded bg-[#1A1A22] border border-[#2D2D38] text-[11px] font-mono text-gray-300">
                    {previewFilename}
                  </span>
                )}
              </div>

              {format !== 'sqlite' && (
                <div className="flex items-center gap-2">
                  {!isLoadingPreview && previewText && (
                    <span className="text-[11px] text-gray-400 font-mono">
                      {previewLines} lines • {formatFileSize(previewSizeBytes)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchLivePreview(format, statusFilter)}
                    disabled={isLoadingPreview}
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1A1A22] transition-colors cursor-pointer"
                    title="Refresh Preview"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPreview}
                    disabled={!previewText || isLoadingPreview}
                    className="px-2.5 py-1 rounded bg-[#1A1A24] hover:bg-[#242434] text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                    title="Copy preview text to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-indigo-400" />
                        <span>Copy Preview</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Preview Box Container */}
            <div className="relative rounded-xl border border-[#23232A] bg-[#09090C] overflow-hidden shadow-inner">
              {isLoadingPreview ? (
                <div className="h-44 sm:h-52 flex flex-col items-center justify-center gap-2.5 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">Generating live {format.toUpperCase()} preview...</span>
                </div>
              ) : format === 'sqlite' ? (
                <div className="p-4 sm:p-5 flex flex-col gap-3 text-gray-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono">xtream_accounts.db</h4>
                      <p className="text-xs text-gray-400">
                        Binary relational SQLite 3 database file with complete table schemas and indexes.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-[#111116] p-3 rounded-lg border border-[#1E1E26]">
                    <div>
                      <span className="text-gray-500 block">Table:</span>
                      <strong className="text-indigo-300">accounts</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Format:</span>
                      <strong className="text-white">SQLite v3</strong>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-gray-500 block">Compatibility:</span>
                      <strong className="text-emerald-400">Desktop & Mobile App</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Ready to download and load directly into the Python desktop app, DB Browser for SQLite, or any standard SQL client.
                  </p>
                </div>
              ) : previewError ? (
                <div className="h-44 sm:h-52 flex flex-col items-center justify-center gap-2 p-4 text-rose-400">
                  <AlertCircle className="w-6 h-6" />
                  <span className="text-xs text-center font-medium">{previewError}</span>
                  <button
                    onClick={() => fetchLivePreview(format, statusFilter)}
                    className="mt-1 px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs transition-colors cursor-pointer"
                  >
                    Retry Preview
                  </button>
                </div>
              ) : !previewText || previewText.trim() === '' || (format === 'm3u' && previewText.trim() === '#EXTM3U') ? (
                <div className="h-44 sm:h-52 flex flex-col items-center justify-center gap-2 p-4 text-gray-500">
                  <FileText className="w-6 h-6 text-gray-600" />
                  <span className="text-xs text-center text-gray-400">
                    No {statusFilter.toLowerCase()} accounts found in your database.
                  </span>
                  <span className="text-[11px] text-gray-600 text-center">
                    Switch the filter above to &quot;All Accounts&quot; or validate new accounts to populate export.
                  </span>
                </div>
              ) : (
                <div className="h-48 sm:h-56 overflow-auto font-mono text-[11px] leading-relaxed p-3.5 select-text">
                  <pre className="text-gray-300 whitespace-pre">
                    {previewText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Download Confirmation */}
        <div className="px-5 py-3.5 border-t border-[#242428] bg-[#0E0E11] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-400 hidden sm:block">
            File: <strong className="text-gray-200 font-mono">{previewFilename || `xtream_accounts.${format}`}</strong>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-[#1C1C21] hover:bg-[#242428] text-gray-300 text-xs font-medium border border-[#34343A] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                isPro
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold hover:brightness-110 shadow-amber-500/20'
              }`}
            >
              {isPro ? (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Confirm & Download .{format.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <Crown className="w-3.5 h-3.5 fill-black" />
                  <span>Upgrade to Download .{format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
