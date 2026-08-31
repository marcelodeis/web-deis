import os
import re

js_dir = r"c:\Antigravity IDE\WEB DEIS\Covid_Web\js"
output_file = r"c:\Antigravity IDE\WEB DEIS\Covid_Web\bundle.js"

# The correct dependency order
files = [
    "data.js",
    "charts.js",
    "table.js",
    "epidemiology.js",
    "map.js",
    "pdf-export.js",
    "app.js"
]

bundled_code = []

for filename in files:
    filepath = os.path.join(js_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Remove all import statements
            content = re.sub(r"^import\s+.*?;?\s*$", "", content, flags=re.MULTILINE)
            
            # Remove all export keywords
            content = re.sub(r"^export\s+(const|let|var|function|async\s+function|class)", r"\1", content, flags=re.MULTILINE)
            content = re.sub(r"^\s*export\s+.*?;?\s*$", "", content, flags=re.MULTILINE) # for export { ... }
            
            bundled_code.append(f"/* --- {filename} --- */\n{content}\n")
    else:
        print(f"Warning: {filename} not found.")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write("try {\n")
    f.write("\n".join(bundled_code))
    f.write("\n} catch(e) { alert('BUNDLE ERROR: ' + e.message + '\\n' + e.stack); console.error(e); }\n")

print("Bundled successfully into bundle.js")
