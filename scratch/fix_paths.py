import os
path = r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('href="/shared/global_premium.css', 'href="../shared/global_premium.css')
content = content.replace('src="/shared/global_premium.js', 'src="../shared/global_premium.js')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
