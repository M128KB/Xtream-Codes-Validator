import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  Tv,
  Crown,
  Lock,
  Zap,
  Sparkles
} from 'lucide-react';
import { useLicense } from '../context/LicenseContext';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { isPro, openUpgradeModal } = useLicense();
  const [format, setFormat] = useState<'m3u' | 'csv' | 'txt' | 'json' | 'sqlite'>('m3u');
  const [statusFilter, setStatusFilter] = useState<'Valid' | 'All' | 'Expired'>('Valid');

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!isPro) {
      onClose();
      openUpgradeModal('pricing');
      return;
    }

    if (format === 'sqlite') {
      window.location.href = '/api/db/download-sqlite';
    } else {
      window.location.href = `/api/export?format=${format}&status=${statusFilter}`;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111114] border border-[#242428] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#242428] flex items-center justify-between bg-[#0E0E11]">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Export Database Accounts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {!isPro && (
            <div className="bg-gradient-to-br from-[#1A1610] to-[#121014] border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Pro Feature: Unlimited M3U & CSV Playlist Export</span>
              </div>
              <p className="text-gray-300 leading-relaxed text-xs">
                Exporting clean <strong>.M3U playlists</strong>, formatted <strong>.CSV spreadsheets</strong>, and raw <strong>SQLite databases</strong> is exclusively enabled on the Pro Tier.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openUpgradeModal('pricing');
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black font-extrabold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Upgrade to Pro to Unlock Instant Downloads ($9.99)</span>
              </button>
            </div>
          )}

          {/* Format selection */}
          <div className="space-y-2">
            <label className="font-semibold text-white block">1. Select Export Format:</label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* M3U */}
              <button
                type="button"
                onClick={() => setFormat('m3u')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'm3u'
                    ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                }`}
              >
                <Tv className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">M3U Playlist (.m3u)</span>
                  <span className="text-[11px] text-gray-500">Ready for IPTV players</span>
                </div>
              </button>

              {/* TXT */}
              <button
                type="button"
                onClick={() => setFormat('txt')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'txt'
                    ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Plain Text (.txt)</span>
                  <span className="text-[11px] text-gray-500">domain user pass</span>
                </div>
              </button>

              {/* CSV */}
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">CSV Spreadsheet (.csv)</span>
                  <span className="text-[11px] text-gray-500">Excel & Google Sheets</span>
                </div>
              </button>

              {/* SQLite DB */}
              <button
                type="button"
                onClick={() => setFormat('sqlite')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'sqlite'
                    ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                    : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                }`}
              >
                <Database className="w-4 h-4 text-indigo-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">SQLite File (.db)</span>
                  <span className="text-[11px] text-gray-500">Raw xtream_accounts.db</span>
                </div>
              </button>
            </div>
          </div>

          {/* Filter selection (when not raw sqlite) */}
          {format !== 'sqlite' && (
            <div className="space-y-2 pt-2 border-t border-[#242428]">
              <label className="font-semibold text-white block">2. Target Accounts Filter:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Valid', 'All', 'Expired'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      statusFilter === filter
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 font-semibold'
                        : 'border-[#242428] bg-[#0A0A0C] text-gray-400 hover:border-[#34343A]'
                    }`}
                  >
                    {filter === 'Valid' ? 'Valid Only' : filter === 'All' ? 'All Accounts' : 'Expired Only'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#242428] bg-[#0E0E11] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-[#1C1C21] hover:bg-[#242428] text-gray-300 text-xs font-medium border border-[#34343A] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={`px-5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ${
              isPro
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold hover:brightness-110'
            }`}
          >
            {isPro ? <Download className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5 fill-black" />}
            <span>{isPro ? 'Download Export' : 'Upgrade to Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
