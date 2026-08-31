import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    to_replace = """        }, 50);
    }).showToast();
        }
    },"""

    replacement = """        }, 50);
    },"""

    if to_replace in content:
        content = content.replace(to_replace, replacement)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
            print("Fixed syntax in", path)
