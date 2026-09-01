with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

import re

# We can show an alert if liveRes or vodRes returns an error.
error_handling = """      const live = await liveRes.json();
      const vod = await vodRes.json();
      
      if (live.error) console.error("Live TV Error:", live.error);
      if (vod.error) console.error("VOD Error:", vod.error);
"""

content = content.replace("      const live = await liveRes.json();\n      const vod = await vodRes.json();", error_handling)

with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)
