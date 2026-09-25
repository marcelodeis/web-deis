import io, re

# Fix app_v9.js
js_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\app_v9.js'
with io.open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# Remove Flujo assignments
js = re.sub(r'document\.getElementById\(\'progModalFlujo.*?\)\;.*?\n', '', js)
# Remove Exclusiones logic
js = re.sub(r'// Excluidos.*?const tbodyExc = document\.getElementById\(\'progModalTbodyExclusiones\'\).*?</tr>`;\s*\}', '', js, flags=re.DOTALL)

with io.open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

# Fix index.html
html_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\index.html'
with io.open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove Flujo assignments in index.html
html = re.sub(r'document\.getElementById\(\'neoModalFlujo.*?\)\;.*?\n', '', html)

# Find and remove Exclusiones block in index.html
html = re.sub(r'const tbodyExc = document\.getElementById\(\'neoModalTbodyExclusiones\'\);.*?</tr>`;', '', html, flags=re.DOTALL)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
    
print("Broken DOM references removed.")
