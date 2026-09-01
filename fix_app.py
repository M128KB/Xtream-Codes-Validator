with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    """          <M3UGeneratorTab 
            onRefreshDb={fetchDbStats} 
          />""",
    """          <M3UGeneratorTab 
            onRefreshDb={fetchDbStats} 
            isActive={activeTab === 'm3u'}
          />"""
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
