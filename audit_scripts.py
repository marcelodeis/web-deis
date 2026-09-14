import sys, io, re, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

htmls = {
    'Influenza': 'Influenza_Web/index.html',
    'VRS': 'VRS/index.html',
    'Programaticas': 'Programáticas_Web/index.html',
    'COVID': 'Covid_Web/index.html',
    'VPH': 'VPH_Web/index.html',
}

for label, path in htmls.items():
    print(f'=== {label} ===')
    content = open(path, encoding='utf-8').read()
    scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content)
    for s in scripts:
        # Check if file exists relative to the HTML dir
        html_dir = os.path.dirname(path)
        full = os.path.join(html_dir, s)
        exists = os.path.exists(full)
        sz = os.path.getsize(full) if exists else 0
        status = f'{sz:,} bytes' if exists else '*** MISSING ***'
        print(f'  {s:<50} {status}')
    print()
