import re

# 1. Update App.tsx
with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add import
content = content.replace(
    "import { DatabaseManagerTab } from './components/DatabaseManagerTab';",
    "import { DatabaseManagerTab } from './components/DatabaseManagerTab';\nimport M3UGeneratorTab from './components/M3UGeneratorTab';"
)

# Add Tab content
tab_html = """
        <div className={activeTab === 'single' ? 'block' : 'hidden'}>
          <SingleTesterTab
            onAccountSaved={() => fetchDbStats()}
          />
        </div>
        <div className={activeTab === 'm3u' ? 'block' : 'hidden'}>
          <M3UGeneratorTab 
            onRefreshDb={fetchDbStats} 
          />
        </div>
"""
content = content.replace(
    """        <div className={activeTab === 'single' ? 'block' : 'hidden'}>
          <SingleTesterTab
            onAccountSaved={() => fetchDbStats()}
          />
        </div>""",
    tab_html
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

# 2. Update Navbar.tsx
with open('src/components/Navbar.tsx', 'r') as f:
    nav_content = f.read()

# Add icon import
nav_content = nav_content.replace(
    "import { Zap, Server, Shield, Crown, HardDrive, Terminal, Lock, Laptop, KeyRound, Search, Tv } from 'lucide-react';",
    "import { Zap, Server, Shield, Crown, HardDrive, Terminal, Lock, Laptop, KeyRound, Search, Tv, FileAudio } from 'lucide-react';"
)

# Add M3U button
m3u_btn = """
          <button
            id="tab-m3u-btn"
            onClick={() => setActiveTab('m3u')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              activeTab === 'm3u'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="whitespace-nowrap">M3U Generator</span>
          </button>
          <button
            id="tab-player-btn"
"""
nav_content = nav_content.replace('          <button\n            id="tab-player-btn"', m3u_btn)

with open('src/components/Navbar.tsx', 'w') as f:
    f.write(nav_content)

print("Patched App.tsx and Navbar.tsx")
