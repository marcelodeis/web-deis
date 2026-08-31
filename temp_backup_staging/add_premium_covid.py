import re
import codecs

path = r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Insert premium CSS
if 'global_premium.css' not in content:
    content = re.sub(
        r'(<link rel="stylesheet" href="style\.css\?v=\d+">)',
        r'\1\n    <!-- Premium Features -->\n    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">\n    <link rel="stylesheet" href="../shared/global_premium.css?v=2">',
        content,
        count=1
    )

# Insert premium JS
if 'global_premium.js' not in content:
    content = re.sub(
        r'(<script src="autoconsulta\.js\?v=\d+"></script>)',
        r'\1\n    <script src="../shared/global_premium.js?v=3"></script>',
        content,
        count=1
    )

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Added premium scripts to Covid_Web!")
