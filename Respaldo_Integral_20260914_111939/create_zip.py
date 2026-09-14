import os
import zipfile
import shutil

source_dir = r"C:\Antigravity IDE\WEB DEIS"
zip_path = r"C:\Antigravity IDE\WEB DEIS\Cloudflare_Deploy_Final.zip"

directories_to_copy = [
    "Covid_Web",
    "Influenza_Web",
    "VPH_Web",
    "VRS",
    "Programáticas_Web",
    "Portal_Web",
    "shared"
]

if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # Add root index.html to redirect to Portal_Web
    root_index = '''<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=Portal_Web/index.html" />
</head>
<body>
    <p>Redirigiendo al Portal RNI...</p>
</body>
</html>'''
    zipf.writestr("index.html", root_index)

    for d in directories_to_copy:
        src_path = os.path.join(source_dir, d)
        if not os.path.exists(src_path):
            continue
        
        for root, _, files in os.walk(src_path):
            for file in files:
                if file.endswith('.py') or file.endswith('.bak') or file.endswith('.old') or file == '__pycache__':
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)

print("Deploy zip created successfully at:", zip_path)
