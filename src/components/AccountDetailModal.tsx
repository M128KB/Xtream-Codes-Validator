import React, { useState } from 'react';
import {
  X,
  User,
  Server,
  Calendar,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Code2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Play
} from 'lucide-react';
import { XtreamAccount } from '../types';

interface AccountDetailModalProps {
  account: XtreamAccount | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onRevalidate: (acc: XtreamAccount) => void;
  onPlayAccount?: (acc: XtreamAccount) => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onDelete,
  onRevalidate,
  onPlayAccount,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!account) return null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const m3uPlusUrl = `${account.domain}/get.php?username=${encodeURIComponent(account.username)}&password=${encodeURIComponent(account.password)}&type=m3u_plus&output=ts`;
  const m3uHlsUrl = `${account.domain}/get.php?username=${encodeURIComponent(account.username)}&password=${encodeURIComponent(account.password)}&type=m3u_plus&output=m3u8`;
  const epgUrl = `${account.domain}/xmltv.php?username=${encodeURIComponent(account.username)}&password=${encodeURIComponent(account.password)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111114] border border-[#242428] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#242428] flex items-center justify-between bg-[#0E0E11]">
          <div className="flex items-center gap-3">
            {account.is_valid ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : account.status === 'Expired' ? (
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white">Account Inspector</h3>
              <p className="text-xs text-gray-400 font-mono truncate max-w-md">{account.domain}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C1C21] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Credentials Card */}
          <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between text-gray-400 border-b border-[#242428] pb-2">
              <span className="font-semibold text-white">Credentials & Status</span>
              <span className="text-[11px] text-gray-500">ID: {account.id ?? 'New'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500 block text-[10px]">USERNAME</span>
                <span className="text-indigo-400 font-bold text-sm select-all">{account.username}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">PASSWORD</span>
                <span className="text-gray-200 font-bold text-sm select-all">{account.password}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">STATUS</span>
                <span className={`font-semibold ${account.is_valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {account.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">LATENCY</span>
                <span className="text-gray-300">{account.response_time_ms ? `${account.response_time_ms} ms` : '-'}</span>
              </div>
            </div>
          </div>

          {/* Subscription & Server Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-4 space-y-2 font-mono">
              <div className="flex items-center gap-1.5 text-white font-semibold border-b border-[#242428] pb-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Subscription</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Exp Date:</span>
                  <span className="text-gray-200">{account.exp_date || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Cons:</span>
                  <span className="text-gray-200">{account.max_connections ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Cons:</span>
                  <span className="text-gray-200">{account.active_cons ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-4 space-y-2 font-mono">
              <div className="flex items-center gap-1.5 text-white font-semibold border-b border-[#242428] pb-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Server Profile</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Timezone:</span>
                  <span className="text-gray-200">{account.timezone || 'UTC'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Checked:</span>
                  <span className="text-gray-200 text-[10px]">{account.last_checked || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Playlist URLs */}
          <div className="bg-[#0A0A0C] border border-[#242428] rounded-xl p-4 space-y-3 font-mono">
            <span className="font-semibold text-white block border-b border-[#242428] pb-2">
              Generated Streaming & Playlist URLs
            </span>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>M3U Plus TS Playlist:</span>
                <button
                  onClick={() => copyText(m3uPlusUrl, 'm3u_ts')}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'm3u_ts' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <input
                readOnly
                value={m3uPlusUrl}
                className="w-full bg-[#111114] border border-[#242428] rounded px-2.5 py-1 text-[11px] text-[#D1D1D1] select-all"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>XMLTV EPG Guide:</span>
                <button
                  onClick={() => copyText(epgUrl, 'epg')}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'epg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <input
                readOnly
                value={epgUrl}
                className="w-full bg-[#111114] border border-[#242428] rounded px-2.5 py-1 text-[11px] text-[#D1D1D1] select-all"
              />
            </div>
          </div>

          {/* Raw JSON Accordion if exists */}
          {account.raw_data && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-300 flex items-center gap-1">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  Xtream Codes API Raw Data
                </span>
                <button
                  onClick={() => copyText(JSON.stringify(account.raw_data, null, 2), 'raw_json')}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'raw_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Raw JSON</span>
                </button>
              </div>
              <pre className="bg-[#0A0A0C] border border-[#242428] rounded-lg p-3 text-[10px] font-mono text-gray-300 max-h-48 overflow-y-auto">
                {JSON.stringify(account.raw_data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#242428] bg-[#0E0E11] flex items-center justify-between">
          {account.id ? (
            <button
              onClick={() => {
                onDelete(account.id!);
                onClose();
              }}
              className="px-3 py-1.5 rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Record
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {onPlayAccount && account.is_valid && (
              <button
                onClick={() => {
                  onPlayAccount(account);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Open in Web Player</span>
              </button>
            )}
            <button
              onClick={() => {
                onRevalidate(account);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-md bg-[#24242C] hover:bg-[#2F2F3A] text-gray-200 text-xs font-semibold flex items-center gap-1.5 border border-[#3A3A46] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-validate Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
