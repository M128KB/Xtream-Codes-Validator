with open('src/components/M3UGeneratorTab.tsx', 'r') as f:
    content = f.read()

import re

# Change selectedAccountId to string
content = content.replace(
    "const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');",
    "const [selectedAccountId, setSelectedAccountId] = useState<string>('');"
)

# Update handleAccountSelect
content = content.replace(
    "setSelectedAccountId(val === '' ? '' : Number(val));",
    "setSelectedAccountId(val);"
)
content = content.replace(
    "const acc = accounts.find(a => a.id === Number(val));",
    "const acc = accounts.find(a => String(a.id) === val);"
)

# Update handleGenerate
content = content.replace(
    "const acc = accounts.find(a => a.id === selectedAccountId);",
    "const acc = accounts.find(a => String(a.id) === selectedAccountId);"
)

# Add isActive prop
content = content.replace(
    "export default function M3UGeneratorTab({ \n  onRefreshDb \n}: { \n  onRefreshDb: () => void;\n}) {",
    "export default function M3UGeneratorTab({ \n  onRefreshDb, isActive \n}: { \n  onRefreshDb: () => void; isActive?: boolean;\n}) {"
)

# Fetch accounts when isActive changes
content = re.sub(
    r"  // Load valid accounts\n  useEffect\(\(\) => \{\n    fetchAccounts\(\);\n  \}, \[\]\);",
    """  // Load valid accounts
  useEffect(() => {
    if (isActive !== false) {
      fetchAccounts();
    }
  }, [isActive]);""",
    content
)

with open('src/components/M3UGeneratorTab.tsx', 'w') as f:
    f.write(content)
