import React, { useState } from 'react';
import {
  Search,
  Zap,
  Server,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Code2
} from 'lucide-react';
import { XtreamAccount } from '../types';

interface SingleTesterTabProps {
  onAccountSaved: () => void;
}

export const SingleTesterTab: React.FC<SingleTesterTabProps> = ({ onAccountSaved }) => {
  const [domain, setDomain] = useState<string>('http://example-iptv.net:8080');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [timeout, setTimeoutSec] = useState<number>(8);
  const [saveToDb, setSaveToDb] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<XtreamAccount | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !username || !password) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/validate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          username,
          password,
          timeout,
          saveToDb,
        }),
      });

      const data = await res.json();
      setResult(data);
      if (saveToDb) {
        onAccountSaved();
      }
    } catch (e: any) {
      setResult({
        domain,
        username,
        password,
        status: 'Server Error',
        is_valid: false,
        response_time_ms: 0,
        raw_data: { error: e.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const m3uPlusUrl = result
    ? `${result.domain}/get.php?username=${encodeURIComponent(result.username)}&password=${encodeURIComponent(result.password)}&type=m3u_plus&output=ts`
    : '';

  const m3uHlsUrl = result
    ? `${result.domain}/get.php?username=${encodeURIComponent(result.username)}&password=${encodeURIComponent(result.password)}&type=m3u_plus&output=m3u8`
    : '';

  const epgUrl = result
    ? `${result.domain}/xmltv.php?username=${encodeURIComponent(result.username)}&password=${encodeURIComponent(result.password)}`
    : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Input Card */}
      <div className="bg-[#111114] border border-[#242428] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#242428] pb-4 mb-5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Single Account Diagnostic Inspector</h2>
            <p className="text-xs text-gray-500">Validate server responsiveness, credentials authentication, and stream capabilities in real time.</p>
          </div>
        </div>

        <form onSubmit={handleTest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs text-gray-300 font-medium">Domain / Server URL:</label>
              <input
                id="single-domain-input"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="http://domain.com:8080"
                required
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg px-3 py-2 text-xs font-mono text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Username:</label>
              <input
                id="single-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg px-3 py-2 text-xs font-mono text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Password:</label>
              <input
                id="single-password-input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                required
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg px-3 py-2 text-xs font-mono text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4 text-xs text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveToDb}
                  onChange={(e) => setSaveToDb(e.target.checked)}
                  className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Save result into SQLite database</span>
              </label>

              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Timeout:</span>
                <select
                  value={timeout}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  className="bg-[#0A0A0C] border border-[#242428] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none cursor-pointer"
                >
                  <option value={5} className="bg-[#111114]">5s</option>
                  <option value={8} className="bg-[#111114]">8s</option>
                  <option value={15} className="bg-[#111114]">15s</option>
                </select>
              </div>
            </div>

            <button
              id="run-single-test-btn"
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4 fill-white" />
              )}
              <span>{loading ? 'Testing Xtream API...' : 'Run Live Diagnostic'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Results Inspector */}
      {result && (
        <div className="bg-[#111114] border border-[#242428] rounded-xl p-6 shadow-sm space-y-6">
          {/* Header Result Banner */}
          <div className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-xl border border-[#242428]">
            <div className="flex items-center gap-3">
              {result.is_valid ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : result.status === 'Expired' ? (
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">
                    {result.is_valid ? 'Account Active & Authorized' : `Status: ${result.status}`}
                  </span>
                  {result.is_trial && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                      Trial Account
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {result.domain} • User: {result.username}
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-xs text-gray-500">Response Latency</span>
              <div className="text-lg font-bold text-indigo-400">{result.response_time_ms} ms</div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info Card */}
            <div className="bg-[#0A0A0C] border border-[#242428] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white border-b border-[#242428] pb-2">
                <User className="w-4 h-4 text-indigo-400" />
                <span>Subscription Details</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Expiration Date:</span>
                  <span className="text-white font-semibold">{result.exp_date || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Active Connections:</span>
                  <span className="text-gray-300">{result.max_connections ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Connections:</span>
                  <span className="text-gray-300">{result.active_cons ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Type:</span>
                  <span className="text-gray-300">{result.is_trial ? 'Trial' : 'Full / Regular'}</span>
                </div>
              </div>
            </div>

            {/* Server Info Card */}
            <div className="bg-[#0A0A0C] border border-[#242428] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white border-b border-[#242428] pb-2">
                <Server className="w-4 h-4 text-indigo-400" />
                <span>Server Endpoint</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Server Host / URL:</span>
                  <span className="text-gray-300 truncate max-w-[200px]" title={result.server_name}>{result.server_name || result.domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Server Timezone:</span>
                  <span className="text-gray-300">{result.timezone || 'UTC'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Protocol:</span>
                  <span className="text-gray-300">{result.domain.startsWith('https') ? 'HTTPS (Secure)' : 'HTTP'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Saved to SQLite:</span>
                  <span className="text-emerald-400 font-semibold">{saveToDb ? 'Yes (xtream_accounts.db)' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Generated Playlist URLs for Valid Accounts */}
          {result.is_valid && (
            <div className="space-y-3 bg-[#0A0A0C] border border-[#242428] rounded-lg p-4">
              <span className="text-xs font-semibold text-white block border-b border-[#242428] pb-2">
                Generated Player URLs & Endpoints
              </span>

              {/* M3U TS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>M3U Plus (TS Format):</span>
                  <button
                    onClick={() => copyText(m3uPlusUrl, 'm3u_ts')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'm3u_ts' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy URL</span>
                  </button>
                </div>
                <input
                  readOnly
                  value={m3uPlusUrl}
                  className="w-full bg-[#111114] border border-[#242428] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#D1D1D1] select-all"
                />
              </div>

              {/* M3U HLS */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>M3U8 (HLS Format):</span>
                  <button
                    onClick={() => copyText(m3uHlsUrl, 'm3u_hls')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'm3u_hls' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy URL</span>
                  </button>
                </div>
                <input
                  readOnly
                  value={m3uHlsUrl}
                  className="w-full bg-[#111114] border border-[#242428] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#D1D1D1] select-all"
                />
              </div>

              {/* EPG XMLTV */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>XMLTV EPG Guide URL:</span>
                  <button
                    onClick={() => copyText(epgUrl, 'epg')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'epg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy URL</span>
                  </button>
                </div>
                <input
                  readOnly
                  value={epgUrl}
                  className="w-full bg-[#111114] border border-[#242428] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#D1D1D1] select-all"
                />
              </div>
            </div>
          )}

          {/* Raw JSON Accordion */}
          {result.raw_data && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-indigo-400" />
                  Raw Server JSON Response
                </span>
                <button
                  onClick={() => copyText(JSON.stringify(result.raw_data, null, 2), 'raw_json')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'raw_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy JSON</span>
                </button>
              </div>
              <pre className="bg-[#0A0A0C] border border-[#242428] rounded-lg p-4 text-[11px] font-mono text-[#D1D1D1] max-h-64 overflow-y-auto leading-relaxed">
                {JSON.stringify(result.raw_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
