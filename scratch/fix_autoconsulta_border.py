import os

target_files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\index.html',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\index.html',
    r'C:\Antigravity IDE\WEB DEIS\VRS\index.html',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\index.html'
]

for path in target_files:
    if not os.path.exists(path):
        continue
        
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace border-left with border-top
    new_content = content.replace('border-left: 5px solid #3b82f6;', 'border-top: 4px solid #3b82f6;')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Patched border in {path}")
