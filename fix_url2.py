with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()
import re
content = re.sub(r'\{a\.username\} \(\{.*\}\)', '{a.username} ({a.domain})', content)
with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)
