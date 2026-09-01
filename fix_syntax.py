import re
with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

bad_fetch = """      const [liveRes, vodRes] = await Promise.all([
        fetch('/api/player/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
      ]);"""

good_fetch = """      const [liveRes, vodRes] = await Promise.all([
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
      ]);"""

content = content.replace(bad_fetch, good_fetch)
with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)
