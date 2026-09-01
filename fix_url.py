with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'a.domain.replace(/https?:\\/\\//i, "").split("/")[0]',
    'a.domain.replace(/^https?:\\/\\//i, "").split("/")[0]'
)

# And fix if the sed was weird
content = content.replace('new URL(a.domain).hostname', 'a.domain.replace(/^https?:\\/\\//i, "").split("/")[0]')

with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)
