import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    out = []
    for line in lines:
        if line.strip() == 'statsHTML +=':
            out.append(line.replace('statsHTML +=', 'statsHTML += '))
        elif line.strip() == ';':
            out.append(line.replace(';', ';'))
        else:
            out.append(line)
            
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(out)
        
for f in files:
    fix_file(f)
