import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Download,
  Play,
  Copy,
  Check,
  FileCode,
  Layers,
  Cpu,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Code2,
  FolderDown,
  Monitor
} from 'lucide-react';

interface PythonStudioTabProps {
  onRefreshDb: () => void;
  onLockAdmin?: () => void;
}

export const PythonStudioTab: React.FC<PythonStudioTabProps> = ({ onRefreshDb, onLockAdmin }) => {
  const [activeFile, setActiveFile] = useState<'xtream_validator_gui.py' | 'xtream_cli.py' | 'sample_accounts.txt'>(
    'xtream_validator_gui.py'
  );
  const [sourceCode, setSourceCode] = useState<string>('');
  const [loadingCode, setLoadingCode] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string | null>(null);
  const [showPinSettings, setShowPinSettings] = useState<boolean>(false);

  // Live Terminal Runner State
  const [runnerInput, setRunnerInput] = useState<string>(
`http://xtream-demo.streamline-iptv.net:8080 demo_user_alpha pass_secret123
http://iptv.server-pro.tv:80 user_premium99 pass_secure_2026
http://mag.ultra-iptv.com:8080/get.php?username=client_sports_hd&password=client_pass_789&type=m3u_plus
http://tv.fast-iptv.cc:8080|speed_user_01|fastpass_2024`
  );
  const [runnerThreads, setRunnerThreads] = useState<number>(10);
  const [runnerTimeout, setRunnerTimeout] = useState<number>(5);
  const [runnerSaveAll, setRunnerSaveAll] = useState<boolean>(true);
  const [isRunningPython, setIsRunningPython] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string>(
`$ python3 xtream_cli.py --help
Interactive Python 3.10 Runtime Ready.
Click "Run Python Script on Server" to execute batch validation.`
  );

  const fetchSourceCode = async (filename: string) => {
    setLoadingCode(true);
    try {
      const res = await fetch(`/api/python/source/${filename}`);
      if (res.ok) {
        const data = await res.json();
        setSourceCode(data.code);
      }
    } catch (e) {
      console.error('Failed to load code', e);
    } finally {
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    fetchSourceCode(activeFile);
  }, [activeFile]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunPython = async () => {
    if (!runnerInput.trim() || isRunningPython) return;

    setIsRunningPython(true);
    setTerminalOutput(`$ python3 xtream_cli.py --file input.txt --db xtream_accounts.db --threads ${runnerThreads} --timeout ${runnerTimeout}\nExecuting Python child process...\n\n`);

    try {
      const res = await fetch('/api/python/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputLines: runnerInput,
          threads: runnerThreads,
          timeout: runnerTimeout,
          saveAll: runnerSaveAll,
        }),
      });

      const data = await res.json();
      setTerminalOutput(
        (prev) => prev + (data.stdout || '') + (data.stderr ? `\n[STDERR]:\n${data.stderr}` : '') + `\n[Process completed with exit code ${data.exitCode}]`
      );
      onRefreshDb();
    } catch (e: any) {
      setTerminalOutput((prev) => prev + `\n[ERROR]: ${e.message}`);
    } finally {
      setIsRunningPython(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Standalone Desktop App Downloads */}
      <div className="bg-[#111114] border border-[#242428] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Monitor className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-white">Standalone Python Desktop Application</h2>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Complete cross-platform GUI built with Python 3, Tkinter, Multithreaded validation pool, and SQLite database storage.
              Download the `.py` files below to run natively on Windows, macOS, or Linux, or compile into a standalone `.exe`.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <a
              id="download-gui-py-btn"
              href="/api/python/download/xtream_validator_gui.py"
              download
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download GUI (.py)</span>
            </a>

            <a
              id="download-cli-py-btn"
              href="/api/python/download/xtream_cli.py"
              download
              className="px-3.5 py-2.5 bg-[#1C1C21] hover:bg-[#242428] text-gray-200 rounded-md text-xs font-medium border border-[#34343A] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>CLI Script</span>
            </a>

            <a
              id="download-sample-txt-btn"
              href="/api/python/download/sample_accounts.txt"
              download
              className="px-3.5 py-2.5 bg-[#1C1C21] hover:bg-[#242428] text-gray-200 rounded-md text-xs font-medium border border-[#34343A] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FolderDown className="w-4 h-4 text-amber-400" />
              <span>Sample .TXT</span>
            </a>

            <button
              onClick={() => setShowPinSettings(!showPinSettings)}
              className="px-3 py-2.5 bg-[#18181D] hover:bg-[#202026] text-amber-300 rounded-md text-xs font-medium border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Admin Security Settings"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>PIN Settings</span>
            </button>

            {onLockAdmin && (
              <button
                onClick={onLockAdmin}
                className="px-3 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-md text-xs font-medium border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Lock Studio"
              >
                <span>Lock Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* Change PIN Dropdown */}
        {showPinSettings && (
          <div className="mt-4 pt-4 border-t border-[#242428] flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#0A0A0C] p-3 rounded-lg border">
            <span className="text-xs text-gray-300 font-medium">Update Admin Passkey:</span>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN (e.g. secret456)"
                className="bg-[#141418] border border-[#27272F] rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => {
                  if (!newPin.trim()) return;
                  localStorage.setItem('xval_admin_pin', newPin.trim());
                  setPinChangeMsg('PIN updated successfully!');
                  setNewPin('');
                  setTimeout(() => setPinChangeMsg(null), 3000);
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded cursor-pointer"
              >
                Save
              </button>
            </div>
            {pinChangeMsg && (
              <span className="text-xs text-emerald-400 font-medium">{pinChangeMsg}</span>
            )}
          </div>
        )}
      </div>

      {/* Two Column Section: Live Terminal Runner on Left, Source Code on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Live Python Execution Sandbox */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#242428] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Live Python Runner Sandbox</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Python 3.10 Linux Container
              </span>
            </div>

            {/* Input credentials for Python */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Input Lines (.TXT content):</label>
              <textarea
                value={runnerInput}
                onChange={(e) => setRunnerInput(e.target.value)}
                rows={5}
                className="w-full bg-[#0A0A0C] border border-[#242428] rounded-lg p-2.5 text-xs font-mono text-[#D1D1D1] placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Runner Parameters */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400">Threads:</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={runnerThreads}
                  onChange={(e) => setRunnerThreads(Number(e.target.value))}
                  className="w-full bg-[#0A0A0C] border border-[#242428] rounded px-2 py-1.5 font-mono text-gray-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400">Timeout (s):</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={runnerTimeout}
                  onChange={(e) => setRunnerTimeout(Number(e.target.value))}
                  className="w-full bg-[#0A0A0C] border border-[#242428] rounded px-2 py-1.5 font-mono text-gray-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400">Save to SQLite:</label>
                <div className="flex items-center h-[34px]">
                  <input
                    type="checkbox"
                    checked={runnerSaveAll}
                    onChange={(e) => setRunnerSaveAll(e.target.checked)}
                    className="rounded bg-[#0A0A0C] border-[#242428] text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="ml-2 text-gray-300 text-xs">Save All</span>
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button
              id="run-python-cli-btn"
              onClick={handleRunPython}
              disabled={isRunningPython || !runnerInput.trim()}
              className="w-full py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {isRunningPython ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white" />
              )}
              <span>{isRunningPython ? 'Running Python Process...' : 'Run Python Script on Server'}</span>
            </button>

            {/* Terminal Window */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  Terminal Output (stdout / stderr)
                </span>
                <button
                  onClick={() => setTerminalOutput('$ Terminal cleared.')}
                  className="text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Clear Terminal
                </button>
              </div>
              <pre
                id="python-terminal-box"
                className="bg-[#0A0A0C] border border-[#242428] rounded-lg p-3 text-[11px] font-mono text-emerald-400/90 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text"
              >
                {terminalOutput}
              </pre>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Python Source Code Viewer */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#111114] border border-[#242428] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#242428] pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">Python Source Code</h3>
              </div>

              {/* File switch buttons */}
              <div className="flex items-center bg-[#0A0A0C] rounded-lg p-0.5 border border-[#242428] text-xs">
                <button
                  onClick={() => setActiveFile('xtream_validator_gui.py')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFile === 'xtream_validator_gui.py'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  GUI App (.py)
                </button>
                <button
                  onClick={() => setActiveFile('xtream_cli.py')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFile === 'xtream_cli.py'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  CLI (.py)
                </button>
                <button
                  onClick={() => setActiveFile('sample_accounts.txt')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeFile === 'sample_accounts.txt'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Sample (.txt)
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="relative">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A0C] border border-[#242428] rounded-t-lg text-[11px] font-mono text-gray-400">
                <span>{activeFile}</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <pre className="bg-[#0A0A0C] border border-t-0 border-[#242428] rounded-b-lg p-3 text-[11px] font-mono text-gray-300 h-96 overflow-y-auto leading-relaxed select-text">
                {loadingCode ? 'Loading source code...' : sourceCode}
              </pre>
            </div>

            {/* How to run locally instructions */}
            <div className="p-3.5 bg-[#0A0A0C] border border-[#242428] rounded-lg text-xs space-y-2.5">
              <span className="font-semibold text-gray-200 block">How to run locally & build standalone .exe:</span>
              <div className="space-y-2 font-mono text-[11px] text-gray-400">
                <div className="p-2 bg-[#111114] rounded border border-[#242428] text-indigo-300 select-all">
                  <div className="text-gray-400 font-sans text-[10px] mb-1 font-semibold"># Option A: Run directly with Python (No installation needed)</div>
                  python xtream_validator_gui.py
                </div>
                <div className="p-2 bg-[#111114] rounded border border-[#242428] text-emerald-300 select-all">
                  <div className="text-gray-400 font-sans text-[10px] mb-1 font-semibold"># Option B: Build Standalone .EXE (Use 'python -m' to bypass PATH errors)</div>
                  python -m pip install --upgrade pyinstaller<br />
                  python -m PyInstaller --onefile --windowed xtream_validator_gui.py
                </div>
                <div className="text-[10px] text-gray-500 font-sans">
                  The compiled standalone binary will appear in the newly created <code className="text-indigo-400 font-mono">dist/</code> folder.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
