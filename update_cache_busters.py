import os
import re

def increment_version(match):
    v_num = int(match.group(2)) + 1
    return f"{match.group(1)}{v_num}{match.group(3)}"

# Pattern matches any JS file version parameter: src="....js?v=XX"
pattern = re.compile(r'(<script src="[^"]+\.js\?v=)(\d+)("></script>)')

count = 0
for root, dirs, files in os.walk('.'):
    # Ignore cloudflare and backup dirs
    if 'cloudflare' in root.lower() or 'temp_backup_staging' in root.lower() or 'respaldos' in root.lower():
        continue
        
    for name in files:
        if name == 'index.html':
            filepath = os.path.join(root, name)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub(increment_version, content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                print(f'Updated cache busters in {filepath}')

print(f'Total index.html files updated: {count}')
