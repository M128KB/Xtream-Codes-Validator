import re

with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

# Add AlertTriangle to imports if missing
if 'AlertTriangle' not in content:
    content = content.replace("FileAudio, Server, CheckCircle2, PlayCircle, Film, Tv, Video", "FileAudio, Server, CheckCircle2, PlayCircle, Film, Tv, Video, AlertTriangle")

# Find the div and replace its contents
pattern = r'(<div className="flex flex-col md:flex-row gap-4 flex-1 min-h-\[400px\]">).*?(</div>)'

replacement = r'''\1
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
          \2'''

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)

