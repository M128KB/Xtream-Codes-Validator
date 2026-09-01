import re

with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

# Remove series from the fetch
content = content.replace(
    """        fetch('/api/player/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: acc.domain, username: acc.username, password: acc.password, type: 'series' })
        })""",
    ""
)

# And remove it from Promise.all
content = re.sub(
    r'const \[liveRes, vodRes, seriesRes\] = await Promise\.all\(\[\n(.*?),\n(.*?),\n.*?\]\);',
    r'const [liveRes, vodRes] = await Promise.all([\n\1,\n\2\n      ]);',
    content,
    flags=re.DOTALL
)

# Remove series parsing
content = re.sub(r'const series = await seriesRes\.json\(\);\n\n', '', content)
content = re.sub(r'setSeriesCats\(Array\.isArray\(series\) \? series : \[\]\);\n\n', '', content)
content = re.sub(r'const sSel: CategorySelection = \{\};\n.*?setSelectedSeries\(sSel\);\n\n', '', content, flags=re.DOTALL)

# Remove series generation
series_gen = re.compile(r"setGenerateProgress\('Fetching Series\.\.\.'\);\n\n\s*// 3\. Series.*?setGenerateProgress\('Finishing File\.\.\.'\);", re.DOTALL)
content = series_gen.sub("setGenerateProgress('Finishing File...');", content)

# Remove series render block
content = re.sub(r"\{renderCategoryList\('Series', <Video className=\"w-4 h-4 text-amber-400\" \/>, seriesCats, selectedSeries, setSelectedSeries, 'series'\)\}", "", content)

# Fix Category count in bottom bar
content = content.replace(
    'Object.values(selectedLive).filter(Boolean).length + Object.values(selectedVod).filter(Boolean).length + Object.values(selectedSeries).filter(Boolean).length',
    'Object.values(selectedLive).filter(Boolean).length + Object.values(selectedVod).filter(Boolean).length'
)

# Remove series state
content = re.sub(r'const \[seriesCats, setSeriesCats\] = useState<Category\[\]>\(\[\]\);\n', '', content)
content = re.sub(r'const \[selectedSeries, setSelectedSeries\] = useState<CategorySelection>\(\{\}\);\n', '', content)

# Remove series toggleAll
content = content.replace(
    """    } else {
      const n: CategorySelection = {};
      seriesCats.forEach(c => n[c.category_id] = state);
      setSelectedSeries(n);""",
    ""
)

with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)

