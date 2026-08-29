import React, { useEffect, useRef, useState, useId } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Tv,
  Film,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Radio,
  Clock,
  Cast,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { StreamCategory, LiveStreamItem, VodStreamItem, EpgProgram, XtreamAccount } from '../types';

interface WebPlayerProps {
  initialAccount?: XtreamAccount | null;
  onBackToDatabase?: () => void;
}

declare global {
  interface Window {
    chrome?: any;
    cast?: any;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

export const WebPlayer: React.FC<WebPlayerProps> = ({ initialAccount, onBackToDatabase }) => {
  // Connection credentials state
  const [activeAccount, setActiveAccount] = useState<XtreamAccount | null>(initialAccount || null);
  const [hostInput, setHostInput] = useState(initialAccount?.domain || '');
  const [userInput, setUserInput] = useState(initialAccount?.username || '');
  const [passInput, setPassInput] = useState(initialAccount?.password || '');
  const [isConnecting, setIsConnecting] = useState(false);

  // Content state
  const [contentType, setContentType] = useState<'live' | 'vod'>('live');
  const [categories, setCategories] = useState<StreamCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [streams, setStreams] = useState<(LiveStreamItem | VodStreamItem)[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Active playing stream & EPG state
  const [activeLiveStream, setActiveLiveStream] = useState<LiveStreamItem | null>(null);
  const [activeVodStream, setActiveVodStream] = useState<VodStreamItem | null>(null);
  const [epgListings, setEpgListings] = useState<EpgProgram[]>([]);
  const [loadingEpg, setLoadingEpg] = useState(false);
  const [mobileTab, setMobileTab] = useState<'channels' | 'player' | 'categories'>('player');
  const [streamError, setStreamError] = useState<string | null>(null);

  // Player controls state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamQuality, setStreamQuality] = useState<string>('Auto (HLS)');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | 'cover'>('16:9');
  const [hlsStats, setHlsStats] = useState<{ bitrate?: number; resolution?: string; latency?: number }>({});
  
  // Chromecast support
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);

  // Unique IDs for accessibility
  const searchInputId = useId();
  const hostInputId = useId();
  const userInputId = useId();
  const passInputId = useId();

  // Initialize Chromecast SDK listener
  useEffect(() => {
    const checkCast = () => {
      if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
        setIsCastAvailable(true);
      }
    };

    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      setIsCastAvailable(true);
    } else {
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          setIsCastAvailable(true);
        }
      };
    }

    const timer = setTimeout(checkCast, 2000);
    return () => {
      clearTimeout(timer);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (_) {}
      }
    };
  }, []);

  // Update credentials if initialAccount prop changes
  useEffect(() => {
    if (initialAccount) {
      setActiveAccount(initialAccount);
      setHostInput(initialAccount.domain);
      setUserInput(initialAccount.username);
      setPassInput(initialAccount.password);
    }
  }, [initialAccount]);

  // Load categories whenever active account or content type changes
  useEffect(() => {
    if (activeAccount?.domain && activeAccount?.username && activeAccount?.password) {
      loadCategories();
    }
  }, [activeAccount, contentType]);

  // Load stream channels when category changes
  useEffect(() => {
    if (activeAccount?.domain && activeAccount?.username && activeAccount?.password) {
      loadStreams(selectedCategoryId);
    }
  }, [selectedCategoryId, activeAccount, contentType]);

  // Fetch Categories
  const loadCategories = async () => {
    if (!activeAccount) return;
    setLoadingContent(true);
    setContentError(null);
    try {
      const res = await fetch('/api/player/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeAccount.domain,
          username: activeAccount.username,
          password: activeAccount.password,
          type: contentType
        })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories([]);
      }
    } catch (e: any) {
      setContentError(`Failed to load categories: ${e.message}`);
    } finally {
      setLoadingContent(false);
    }
  };

  // Fetch Channels / Streams
  const loadStreams = async (categoryId: string) => {
    if (!activeAccount) return;
    setLoadingContent(true);
    setContentError(null);
    try {
      const res = await fetch('/api/player/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeAccount.domain,
          username: activeAccount.username,
          password: activeAccount.password,
          type: contentType,
          categoryId: categoryId === 'all' ? undefined : categoryId
        })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStreams(data);
      } else {
        setStreams([]);
      }
    } catch (e: any) {
      setContentError(`Failed to load stream list: ${e.message}`);
    } finally {
      setLoadingContent(false);
    }
  };

  // Fetch EPG schedule for currently selected channel
  const loadEpg = async (streamId: number) => {
    if (!activeAccount) return;
    setLoadingEpg(true);
    try {
      const res = await fetch('/api/player/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeAccount.domain,
          username: activeAccount.username,
          password: activeAccount.password,
          streamId
        })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setEpgListings(data);
      } else {
        setEpgListings([]);
      }
    } catch (_) {
      setEpgListings([]);
    } finally {
      setLoadingEpg(false);
    }
  };

  // Play a Live Channel
  const playLiveStream = (stream: LiveStreamItem) => {
    if (!activeAccount) return;
    setActiveLiveStream(stream);
    setActiveVodStream(null);
    setStreamError(null);
    setEpgListings([]);
    setMobileTab('player'); // Automatically switch to player view on mobile

    // Fetch EPG listings
    loadEpg(stream.stream_id);

    const streamUrl = `/api/stream/live/${stream.stream_id}.m3u8?host=${encodeURIComponent(activeAccount.domain)}&user=${encodeURIComponent(activeAccount.username)}&pass=${encodeURIComponent(activeAccount.password)}`;
    setupHlsPlayer(streamUrl, true);
  };

  // Play a VOD Movie
  const playVodStream = (stream: VodStreamItem) => {
    if (!activeAccount) return;
    setActiveVodStream(stream);
    setActiveLiveStream(null);
    setStreamError(null);
    setEpgListings([]);
    setMobileTab('player'); // Automatically switch to player view on mobile

    const ext = stream.container_extension || 'mp4';
    const streamUrl = `/api/stream/vod/${stream.stream_id}?host=${encodeURIComponent(activeAccount.domain)}&user=${encodeURIComponent(activeAccount.username)}&pass=${encodeURIComponent(activeAccount.password)}&container=${ext}`;
    
    // For VOD mp4, direct HTML5 video or HLS if m3u8
    if (ext === 'm3u8') {
      setupHlsPlayer(streamUrl, false);
    } else {
      setupDirectPlayer(streamUrl);
    }
  };

  // Safe Video Playback to prevent "The play() request was interrupted by a new load request"
  const safePlay = async (video: HTMLVideoElement | null) => {
    if (!video) return;
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        setIsPlaying(true);
      }
    } catch (err: any) {
      // Ignore AbortError / interruptions caused by changing streams rapidly or pausing
      if (
        err.name === 'AbortError' ||
        err.name === 'NotAllowedError' ||
        err.message?.includes('interrupted') ||
        err.message?.includes('The play() request was interrupted')
      ) {
        return;
      }
      setIsPlaying(false);
    }
  };

  // Setup HLS.js instance
  const setupHlsPlayer = (srcUrl: string, isLive: boolean) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Destroy existing Hls instance safely
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (_) {}
      hlsRef.current = null;
    }

    try {
      video.pause();
    } catch (_) {}

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });

      hls.loadSource(srcUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        safePlay(video);
        if (data.levels && data.levels.length > 0) {
          const lvl = data.levels[0];
          setHlsStats({
            bitrate: lvl.bitrate,
            resolution: `${lvl.width || '?'}x${lvl.height || '?'}`
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const lvl = hls.levels[data.level];
        if (lvl) {
          setHlsStats(prev => ({
            ...prev,
            bitrate: lvl.bitrate,
            resolution: `${lvl.width || '?'}x${lvl.height || '?'}`
          }));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setStreamError('Network connection failed. Attempting auto-recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setStreamError('Stream decoding media error. Recovering buffer...');
              hls.recoverMediaError();
              break;
            default:
              setStreamError(`Fatal playback error: ${data.details}`);
              try {
                hls.destroy();
              } catch (_) {}
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS
      video.src = srcUrl;
      safePlay(video);
    } else {
      setStreamError('Your browser does not support HLS media playback.');
    }
  };

  // Setup Direct MP4/VOD Player
  const setupDirectPlayer = (srcUrl: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (_) {}
      hlsRef.current = null;
    }

    try {
      video.pause();
    } catch (_) {}

    video.src = srcUrl;
    safePlay(video);
  };

  // Handle Manual Connection
  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostInput || !userInput || !passInput) return;
    
    setIsConnecting(true);
    const newAcc: XtreamAccount = {
      domain: hostInput.trim(),
      username: userInput.trim(),
      password: passInput.trim(),
      status: 'Active',
      is_valid: true
    };

    setActiveAccount(newAcc);
    setSelectedCategoryId('all');
    setActiveLiveStream(null);
    setActiveVodStream(null);
    setIsConnecting(false);
  };

  // Playback Control Handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      safePlay(videoRef.current);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Chromecast trigger
  const handleCast = () => {
    if (!window.chrome || !window.chrome.cast) {
      alert('Chromecast is supported on Google Chrome or Brave browsers. Ensure your Chromecast device is on the same Wi-Fi.');
      return;
    }
    
    try {
      const sessionRequest = new window.chrome.cast.SessionRequest(window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
      const apiConfig = new window.chrome.cast.ApiConfig(
        sessionRequest,
        (session: any) => {
          setIsCasting(true);
          // Load current stream to Cast Session
          if (activeAccount && (activeLiveStream || activeVodStream)) {
            const streamId = activeLiveStream ? activeLiveStream.stream_id : activeVodStream?.stream_id;
            const fullUrl = `${window.location.origin}/api/stream/${activeLiveStream ? 'live' : 'vod'}/${streamId}?host=${encodeURIComponent(activeAccount.domain)}&user=${encodeURIComponent(activeAccount.username)}&pass=${encodeURIComponent(activeAccount.password)}`;
            const mediaInfo = new window.chrome.cast.media.MediaInfo(fullUrl, activeLiveStream ? 'application/x-mpegURL' : 'video/mp4');
            mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = activeLiveStream?.name || activeVodStream?.name || 'IPTV Stream';
            
            const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
            session.loadMedia(request, () => {}, () => {});
          }
        },
        () => {}
      );
      window.chrome.cast.initialize(apiConfig, () => {
        window.chrome.cast.requestSession(() => {
          setIsCasting(true);
        }, () => {});
      });
    } catch (e: any) {
      console.error('Cast error', e);
    }
  };

  // Filter streams by search query
  const filteredStreams = streams.filter(s => {
    if (!searchQuery) return true;
    return s.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeTitle = activeLiveStream?.name || activeVodStream?.name || 'No Stream Selected';
  const activeIcon = activeLiveStream?.stream_icon || activeVodStream?.stream_icon;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0B0B0E] text-gray-200 overflow-hidden select-none">
      
      {/* Top Credentials & Account Switcher Bar */}
      <div className="bg-[#121216] border-b border-[#1E1E24] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">Web IPTV & VOD Player</h1>
              {activeAccount && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Connected
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 truncate max-w-[320px]">
              {activeAccount ? `${activeAccount.domain} (${activeAccount.username})` : 'Enter or select Xtream credentials to stream'}
            </p>
          </div>
        </div>

        {/* Credentials Form (Quick connect or edit) */}
        <form onSubmit={handleConnect} className="flex items-center gap-2 flex-wrap">
          <input
            id={hostInputId}
            type="text"
            placeholder="http://host:port"
            value={hostInput}
            onChange={(e) => setHostInput(e.target.value)}
            className="px-2.5 py-1 bg-[#18181E] border border-[#2A2A34] rounded text-xs text-white focus:outline-none focus:border-indigo-500 w-36 sm:w-44 font-mono"
            required
          />
          <input
            id={userInputId}
            type="text"
            placeholder="Username"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="px-2.5 py-1 bg-[#18181E] border border-[#2A2A34] rounded text-xs text-white focus:outline-none focus:border-indigo-500 w-28 font-mono"
            required
          />
          <input
            id={passInputId}
            type="password"
            placeholder="Password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            className="px-2.5 py-1 bg-[#18181E] border border-[#2A2A34] rounded text-xs text-white focus:outline-none focus:border-indigo-500 w-28 font-mono"
            required
          />
          <button
            type="submit"
            disabled={isConnecting}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            <span>{activeAccount ? 'Switch' : 'Connect'}</span>
          </button>
          
          {onBackToDatabase && (
            <button
              type="button"
              onClick={onBackToDatabase}
              className="px-2.5 py-1 bg-[#1A1A22] hover:bg-[#252530] text-gray-300 rounded text-xs font-medium border border-[#2A2A34] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>DB Accounts</span>
            </button>
          )}
        </form>
      </div>

      {/* Mobile Screen Tab Navigation Bar */}
      <div className="md:hidden bg-[#14141A] border-b border-[#24242E] px-2 py-1.5 flex items-center justify-around shrink-0 text-xs">
        <button
          onClick={() => setMobileTab('categories')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
            mobileTab === 'categories'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Categories</span>
        </button>
        <button
          onClick={() => setMobileTab('channels')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all relative ${
            mobileTab === 'channels'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>Streams ({filteredStreams.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('player')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
            mobileTab === 'player'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Player {activeLiveStream ? '• Live' : ''}</span>
        </button>
      </div>

      {/* Main Player Workspace: 3 Column Layout on Desktop, Tabbed on Mobile */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Column: Mode (Live/VOD) & Category List */}
        <div className={`w-full md:w-56 bg-[#0E0E12] md:border-r border-[#1E1E24] flex flex-col shrink-0 ${
          mobileTab === 'categories' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Live vs VOD Toggle */}
          <div className="p-2 border-b border-[#1E1E24] grid grid-cols-2 gap-1.5 bg-[#121216]">
            <button
              onClick={() => {
                setContentType('live');
                setSelectedCategoryId('all');
              }}
              className={`py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                contentType === 'live'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#181820]'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Live TV</span>
            </button>
            <button
              onClick={() => {
                setContentType('vod');
                setSelectedCategoryId('all');
              }}
              className={`py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                contentType === 'vod'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#181820]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>VOD Movies</span>
            </button>
          </div>

          {/* Categories Header */}
          <div className="px-3 py-2 border-b border-[#1E1E24] flex items-center justify-between text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
            <span>Categories</span>
            <span className="bg-[#1C1C24] text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {categories.length + 1}
            </span>
          </div>

          {/* Category List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#16161C] custom-scrollbar">
            <button
              onClick={() => {
                setSelectedCategoryId('all');
                setMobileTab('channels');
              }}
              className={`w-full text-left px-3 py-2.5 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-indigo-600/15 text-indigo-300 font-bold border-l-2 border-indigo-500'
                  : 'text-gray-300 hover:bg-[#15151B] hover:text-white'
              }`}
            >
              <span className="truncate">⭐ All {contentType === 'live' ? 'Channels' : 'Movies'}</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => {
                  setSelectedCategoryId(cat.category_id);
                  setMobileTab('channels');
                }}
                className={`w-full text-left px-3 py-2.5 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  selectedCategoryId === cat.category_id
                    ? 'bg-indigo-600/15 text-indigo-300 font-bold border-l-2 border-indigo-500'
                    : 'text-gray-400 hover:bg-[#15151B] hover:text-gray-200'
                }`}
              >
                <span className="truncate">{cat.category_name}</span>
              </button>
            ))}

            {categories.length === 0 && !loadingContent && (
              <div className="p-4 text-center text-xs text-gray-500">
                {activeAccount ? 'No categories found' : 'Connect account to view'}
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Stream/Channel List */}
        <div className={`w-full md:w-72 bg-[#121217] md:border-r border-[#1E1E24] flex flex-col shrink-0 ${
          mobileTab === 'channels' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Search Box */}
          <div className="p-2 border-b border-[#1E1E24] bg-[#0E0E12]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
              <input
                id={searchInputId}
                type="text"
                placeholder={`Search ${filteredStreams.length} items...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#181820] border border-[#282834] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* List Count Status */}
          <div className="px-3 py-1.5 border-b border-[#1E1E24] bg-[#14141B] flex items-center justify-between text-[11px] text-gray-400">
            <span className="font-medium">
              {contentType === 'live' ? 'Live Streams' : 'VOD Titles'}
            </span>
            <span className="font-mono text-gray-400 text-[10px]">
              {filteredStreams.length} found
            </span>
          </div>

          {/* Channels Scrollable View */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#181820] custom-scrollbar">
            {loadingContent && (
              <div className="p-8 text-center text-xs text-indigo-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading streams...</span>
              </div>
            )}

            {contentError && (
              <div className="p-3 m-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{contentError}</span>
              </div>
            )}

            {!loadingContent && filteredStreams.map((stream) => {
              const isSelected = contentType === 'live'
                ? activeLiveStream?.stream_id === stream.stream_id
                : activeVodStream?.stream_id === stream.stream_id;

              return (
                <div
                  key={stream.stream_id}
                  onClick={() => {
                    if (contentType === 'live') {
                      playLiveStream(stream as LiveStreamItem);
                    } else {
                      playVodStream(stream as VodStreamItem);
                    }
                  }}
                  className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-white'
                      : 'hover:bg-[#181822] text-gray-300'
                  }`}
                >
                  {/* Channel/Movie Icon */}
                  <div className="w-8 h-8 rounded bg-[#1A1A24] border border-[#2B2B38] flex items-center justify-center shrink-0 overflow-hidden">
                    {stream.stream_icon ? (
                      <img
                        src={stream.stream_icon}
                        alt={stream.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      contentType === 'live' ? <Tv className="w-4 h-4 text-gray-500" /> : <Film className="w-4 h-4 text-gray-500" />
                    )}
                  </div>

                  {/* Channel Title & Details */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>
                      {stream.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                      <span className="font-mono">ID: {stream.stream_id}</span>
                      {contentType === 'vod' && (stream as VodStreamItem).container_extension && (
                        <span className="uppercase text-amber-400 font-semibold">
                          {(stream as VodStreamItem).container_extension}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Play Indicator */}
                  {isSelected ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  )}
                </div>
              );
            })}

            {!loadingContent && filteredStreams.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                <Tv className="w-6 h-6 text-gray-600" />
                <span>No streams available in this category</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: High Performance Video Player & EPG Schedule */}
        <div className={`w-full flex-1 flex-col bg-[#070709] overflow-y-auto custom-scrollbar ${
          mobileTab === 'player' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Active Stream Title Banner */}
          <div className="bg-[#121217] border-b border-[#1E1E24] px-4 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {activeIcon && (
                <img
                  src={activeIcon}
                  alt={activeTitle}
                  className="w-7 h-7 object-contain bg-[#181820] rounded p-0.5 border border-[#282834]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
                  <span>{activeTitle}</span>
                  {activeLiveStream && (
                    <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[9px] font-bold uppercase tracking-wider">
                      LIVE
                    </span>
                  )}
                </h2>
                {hlsStats.resolution && (
                  <p className="text-[10px] text-gray-400 font-mono">
                    Quality: <span className="text-emerald-400">{hlsStats.resolution}</span> • Bitrate: <span className="text-indigo-400">{Math.round((hlsStats.bitrate || 0) / 1000)} kbps</span>
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions (Aspect ratio & Chromecast) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAspectRatio(prev => prev === '16:9' ? '4:3' : prev === '4:3' ? 'cover' : '16:9');
                }}
                className="px-2.5 py-1 bg-[#181820] hover:bg-[#22222E] text-gray-300 border border-[#282834] rounded text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
                title="Aspect Ratio"
              >
                <Sliders className="w-3 h-3 text-indigo-400" />
                <span>{aspectRatio}</span>
              </button>

              {/* Chromecast Button */}
              <button
                onClick={handleCast}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isCasting
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-[#181820] hover:bg-[#22222E] text-gray-300 border-[#282834]'
                }`}
                title="Cast Stream to Smart TV / Chromecast"
              >
                <Cast className={`w-3.5 h-3.5 ${isCasting ? 'text-amber-400' : 'text-gray-400'}`} />
                <span>{isCasting ? 'Casting' : 'Chromecast'}</span>
              </button>
            </div>
          </div>

          {/* Video Player Box */}
          <div
            ref={playerContainerRef}
            className="relative bg-black flex items-center justify-center min-h-[340px] max-h-[540px] w-full group overflow-hidden border-b border-[#1E1E24]"
          >
            <video
              ref={videoRef}
              className={`w-full h-full max-h-[540px] transition-all ${
                aspectRatio === '16:9'
                  ? 'aspect-video object-contain'
                  : aspectRatio === '4:3'
                  ? 'aspect-[4/3] object-contain'
                  : 'object-cover'
              }`}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 0);
                }
              }}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />

            {/* Error Message Overlay */}
            {streamError && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-20">
                <AlertTriangle className="w-10 h-10 text-rose-500 mb-2 animate-bounce" />
                <p className="text-sm font-semibold text-white max-w-md">{streamError}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  The IPTV stream might be offline, rate-limited, or requires authentication headers.
                </p>
                <button
                  onClick={() => {
                    if (activeLiveStream) playLiveStream(activeLiveStream);
                    else if (activeVodStream) playVodStream(activeVodStream);
                  }}
                  className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Stream</span>
                </button>
              </div>
            )}

            {/* Empty State Prompt */}
            {!activeLiveStream && !activeVodStream && !streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Tv className="w-12 h-12 mb-2 text-gray-700" />
                <p className="text-sm font-medium text-gray-400">Select any channel or movie from the left list to begin streaming</p>
                <p className="text-xs text-gray-600 mt-1">Supports Live HLS (.m3u8), TS streams, VOD movies and Chromecast</p>
              </div>
            )}

            {/* Custom On-Hover Video Player Controls Overlay */}
            {(activeLiveStream || activeVodStream) && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                
                {/* VOD Seek Bar (if not live) */}
                {activeVodStream && duration > 0 && (
                  <div className="mb-2">
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      value={currentTime}
                      onChange={(e) => {
                        const time = parseFloat(e.target.value);
                        setCurrentTime(time);
                        if (videoRef.current) videoRef.current.currentTime = time;
                      }}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {/* Left Controls (Play, Volume, Live status) */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleMute}
                        className="p-1 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    {activeLiveStream && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* Right Controls (Aspect ratio, Fullscreen) */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Toggle Fullscreen"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel: Electronic Program Guide (EPG) & Channel Details */}
          <div className="flex-1 p-4 bg-[#0E0E12]">
            <div className="flex items-center justify-between border-b border-[#1E1E24] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {contentType === 'live' ? 'Live Electronic Program Guide (EPG)' : 'VOD Media Details'}
                </h3>
              </div>
              {loadingEpg && (
                <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Updating EPG...
                </span>
              )}
            </div>

            {/* EPG Schedule Timeline */}
            {contentType === 'live' && (
              <div className="space-y-2">
                {epgListings.length > 0 ? (
                  epgListings.map((epg, idx) => (
                    <div
                      key={epg.id || idx}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        idx === 0
                          ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                          : 'bg-[#14141B] border-[#1E1E26] text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              NOW PLAYING
                            </span>
                          )}
                          <span className="font-bold text-gray-100">{epg.title}</span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">
                          {epg.start} - {epg.end}
                        </span>
                      </div>
                      {epg.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {epg.description}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 rounded-lg bg-[#14141B] border border-[#1E1E24] text-center text-xs text-gray-500">
                    {activeLiveStream
                      ? 'No active EPG schedule available for this channel.'
                      : 'Select a channel above to load its real-time TV program schedule.'}
                  </div>
                )}
              </div>
            )}

            {/* VOD Metadata Info */}
            {contentType === 'vod' && activeVodStream && (
              <div className="p-4 rounded-lg bg-[#14141B] border border-[#1E1E24] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Title:</span>
                  <span className="text-xs font-bold text-white">{activeVodStream.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Stream ID:</span>
                  <span className="text-xs font-mono text-indigo-400">{activeVodStream.stream_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Container Format:</span>
                  <span className="text-xs font-mono uppercase text-amber-400">{activeVodStream.container_extension || 'mp4'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Added Date:</span>
                  <span className="text-xs font-mono text-gray-300">{activeVodStream.added || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
