with open('src/components/Navbar.tsx', 'r') as f:
    content = f.read()

import re
# Look for import { ... } from 'lucide-react'
match = re.search(r"import \{(.*?)\} from 'lucide-react';", content)
if match:
    imports = match.group(1).split(',')
    imports = [i.strip() for i in imports]
    if 'FileAudio' not in imports:
        imports.append('FileAudio')
    
    new_import = "import { " + ", ".join(imports) + " } from 'lucide-react';"
    content = content.replace(match.group(0), new_import)

with open('src/components/Navbar.tsx', 'w') as f:
    f.write(content)
