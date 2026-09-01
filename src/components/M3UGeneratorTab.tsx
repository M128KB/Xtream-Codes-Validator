import React, { useState, useEffect } from 'react';
import { Download, CheckSquare, Square, RefreshCw, FileAudio, Server, CheckCircle2, PlayCircle, Film, Tv, Video, AlertTriangle } from 'lucide-react';
import { XtreamAccount } from '../types';

interface Category {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

interface CategorySelection {
  [id: string]: boolean;
}

export default function M3UGeneratorTab({ 
  onRefreshDb, isActive 
}: { 
  onRefreshDb: () => void; isActive?: boolean;
}) {
  const [accounts, setAccounts] = useState<XtreamAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  const [isLoadingCats, setIsLoadingCats] = useState(false);
  const [liveCats, setLiveCats] = useState<Category[]>([]);
  const [vodCats, setVodCats] = useState<Category[]>([]);
    
  const [selectedLive, setSelectedLive] = useState<CategorySelection>({});
  const [selectedVod, setSelectedVod] = useState<CategorySelection>({});
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');

  // Load valid accounts
  useEffect(() => {
    if (isActive !== false) {
      fetchAccounts();
    }
  }, [isActive]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/db/accounts?validOnly=true');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.filter((a: XtreamAccount) => a.is_valid && a.status === 'Active'));
      }
    } catch (e) {
      console.error('Failed to load accounts', e);
    }
  };

  const handleAccountSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedAccountId(val);
    
    if (!val) {
      setLiveCats([]);
      setVodCats([]);
      return;
    }

    const acc = accounts.find(a => String(a.id) === val);
    if (!acc) return;

    setIsLoadingCats(true);
    try {
      const [liveRes, vodRes] = await Promise.all([
        fetch('/api/player/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: acc.domain, username: acc.username, password: acc.password, type: 'live' })
        }),
        fetch('/api/player/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: acc.domain, username: acc.username, password: acc.password, type: 'vod' })
        })
      ]);

      const live = await liveRes.json();
      const vod = await vodRes.json();
      
      if (live.error) console.error("Live TV Error:", live.error);
      if (vod.error) console.error("VOD Error:", vod.error);

            setLiveCats(Array.isArray(live) ? live : []);
      setVodCats(Array.isArray(vod) ? vod : []);
            // Default all to selected
      const lSel: CategorySelection = {};
      (Array.isArray(live) ? live : []).forEach(c => lSel[c.category_id] = true);
      setSelectedLive(lSel);

      const vSel: CategorySelection = {};
      (Array.isArray(vod) ? vod : []).forEach(c => vSel[c.category_id] = true);
      setSelectedVod(vSel);

          } catch (e) {
      console.error('Error fetching categories', e);
    }
    setIsLoadingCats(false);
  };

  const toggleAll = (type: 'live'|'vod'|'series', state: boolean) => {
    if (type === 'live') {
      const n: CategorySelection = {};
      liveCats.forEach(c => n[c.category_id] = state);
      setSelectedLive(n);
    } else if (type === 'vod') {
      const n: CategorySelection = {};
      vodCats.forEach(c => n[c.category_id] = state);
      setSelectedVod(n);

    }
  };

  const handleGenerate = async () => {
    const acc = accounts.find(a => String(a.id) === selectedAccountId);
    if (!acc) return;

    setIsGenerating(true);
    setGenerateProgress('Fetching Live Streams...');
    
    try {
      let m3uContent = '#EXTM3U\n';
      const cleanHost = acc.domain.replace(/\/+$/, '');

      // 1. Live Streams
      const hasLive = Object.values(selectedLive).some(v => v);
      if (hasLive) {
        const res = await fetch('/api/player/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: acc.domain, username: acc.username, password: acc.password, type: 'live' })
        });
        const streams = await res.json();
        if (Array.isArray(streams)) {
          const catMap = Object.fromEntries(liveCats.map(c => [c.category_id, c.category_name]));
          streams.forEach(s => {
            if (selectedLive[s.category_id]) {
              const name = s.name || s.title || 'Unknown Channel';
              const logo = s.stream_icon || '';
              const catName = catMap[s.category_id] || 'Live TV';
              const epg = s.epg_channel_id ? ` tvg-id="${s.epg_channel_id}"` : '';
              
              // M3U format
              m3uContent += `#EXTINF:-1${epg} tvg-name="${name}" tvg-logo="${logo}" group-title="${catName}", ${name}\n`;
              m3uContent += `${cleanHost}/live/${encodeURIComponent(acc.username)}/${encodeURIComponent(acc.password)}/${s.stream_id}.ts\n`;
            }
          });
        }
      }

      setGenerateProgress('Fetching VOD Streams...');
      
      // 2. VOD Streams
      const hasVod = Object.values(selectedVod).some(v => v);
      if (hasVod) {
        const res = await fetch('/api/player/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: acc.domain, username: acc.username, password: acc.password, type: 'vod' })
        });
        const streams = await res.json();
        if (Array.isArray(streams)) {
          const catMap = Object.fromEntries(vodCats.map(c => [c.category_id, c.category_name]));
          streams.forEach(s => {
            if (selectedVod[s.category_id]) {
              const name = s.name || s.title || 'Unknown Movie';
              const logo = s.stream_icon || '';
              const catName = catMap[s.category_id] || 'Movies';
              const ext = s.container_extension || 'mp4';
              
              m3uContent += `#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${catName}", ${name}\n`;
              m3uContent += `${cleanHost}/movie/${encodeURIComponent(acc.username)}/${encodeURIComponent(acc.password)}/${s.stream_id}.${ext}\n`;
            }
          });
        }
      }

      setGenerateProgress('Finishing File...');

      // Create download
      const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Playlist_${acc.username}.m3u`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('Failed to generate M3U', e);
      alert('Failed to generate M3U. Check console for details.');
    }
    
    setIsGenerating(false);
    setGenerateProgress('');
  };

  const renderCategoryList = (
    title: string, 
    icon: React.ReactNode, 
    cats: Category[], 
    selection: CategorySelection, 
    setSelection: (s: CategorySelection) => void,
    toggleType: 'live'|'vod'|'series'
  ) => {
    if (cats.length === 0) return null;

    const allSelected = cats.every(c => selection[c.category_id]);
    const noneSelected = cats.every(c => !selection[c.category_id]);

    return (
      <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[300px]">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#242428]">
          <h3 className="font-semibold text-gray-200 flex items-center gap-2">
            {icon}
            {title} ({cats.length})
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <button 
              onClick={() => toggleAll(toggleType, true)}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >All</button>
            <span className="text-gray-600">|</span>
            <button 
              onClick={() => toggleAll(toggleType, false)}
              className="text-rose-400 hover:text-rose-300 transition-colors"
            >None</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
          {cats.map(c => (
            <label key={c.category_id} className="flex items-center gap-3 p-2 hover:bg-[#1A1A22] rounded-lg cursor-pointer transition-colors group">
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  className="peer sr-only"
                  checked={!!selection[c.category_id]}
                  onChange={(e) => setSelection({...selection, [c.category_id]: e.target.checked})}
                />
                <div className="w-4 h-4 rounded border border-gray-500 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-colors">
                  <CheckSquare className="w-3 h-3 text-[#111114] opacity-0 peer-checked:opacity-100" />
                </div>
              </div>
              <span className={`text-sm select-none transition-colors ${selection[c.category_id] ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>
                {c.category_name}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Info */}
      <div className="bg-[#111114] border border-[#242428] rounded-xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2 mb-1.5">
            <FileAudio className="w-5 h-5 text-emerald-400" />
            Custom M3U Playlist Generator
          </h2>
          <p className="text-sm text-gray-400 max-w-2xl">
            Select an active account from your database to extract its categories. You can filter out unwanted VODs or Live TV groups before exporting a clean, lightweight .m3u playlist.
          </p>
        </div>
        
        <div className="flex-shrink-0 w-full sm:w-64 relative">
          <select
            value={selectedAccountId}
            onChange={handleAccountSelect}
            className="w-full bg-[#1A1A22] border border-[#34343A] text-sm text-gray-200 rounded-lg p-2.5 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
          >
            <option value="">Select a valid account...</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.username} ({a.domain})
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Server className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>

      {isLoadingCats ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
          <p>Fetching categories from Xtream server...</p>
        </div>
      ) : selectedAccountId ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-[400px]">
            {liveCats.length === 0 && vodCats.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-amber-500 border border-dashed border-amber-500/20 rounded-xl bg-amber-500/5">
                <AlertTriangle className="w-10 h-10 mb-3 opacity-80" />
                <p className="font-semibold text-lg text-amber-400">No categories found.</p>
                <p className="text-sm opacity-80 mt-1 max-w-md text-center">This Xtream server returned empty categories. It may not support API category requests or the account lacks permissions.</p>
              </div>
            ) : (
              <>
                {renderCategoryList('Live TV', <Tv className="w-4 h-4 text-indigo-400" />, liveCats, selectedLive, setSelectedLive, 'live')}
                {renderCategoryList('Movies (VOD)', <Film className="w-4 h-4 text-emerald-400" />, vodCats, selectedVod, setSelectedVod, 'vod')}
              </>
            )}
          </div>
          
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-4 shadow-xl flex items-center justify-between mt-2">
            <div className="text-sm text-gray-400">
              <span className="text-gray-200 font-semibold">{Object.values(selectedLive).filter(Boolean).length + Object.values(selectedVod).filter(Boolean).length}</span> Categories Selected
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all ${
                isGenerating 
                  ? 'bg-emerald-600/50 text-emerald-200 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {generateProgress}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download M3U Playlist
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 min-h-[400px] border border-dashed border-[#242428] rounded-xl bg-[#0A0A0C]">
          <FileAudio className="w-12 h-12 text-gray-700 mb-3" />
          <p>Select an account above to start generating</p>
        </div>
      )}
    </div>
  );
}
