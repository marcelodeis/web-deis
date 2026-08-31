import os
import shutil

source_dir = r"C:\Antigravity IDE\WEB DEIS"
deploy_dir = os.path.join(source_dir, "Directorio_Cloudflare")

# Create the directory if it doesn't exist
if not os.path.exists(deploy_dir):
    os.makedirs(deploy_dir)

directories_to_copy = [
    "Covid_Web",
    "Influenza_Web",
    "VPH_Web",
    "VRS",
    "Programáticas_Web",
    "Portal_Web",
    "shared"
]

def should_ignore(dir, files):
    ignore_list = []
    for file in files:
        if file.lower() == 'base datos minsal':
            ignore_list.append(file)
        elif file == '.git' or file.endswith('.py') or file.endswith('.bak') or file.endswith('.old') or file == '__pycache__':
            ignore_list.append(file)
    return ignore_list

for d in directories_to_copy:
    src_path = os.path.join(source_dir, d)
    dst_path = os.path.join(deploy_dir, d)
    
    if os.path.exists(src_path):
        print(f"Copying {d}...")
        shutil.copytree(src_path, dst_path, ignore=should_ignore, dirs_exist_ok=True)

# Create a root index.html that redirects to Portal_Web
root_index = """<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=Portal_Web/index.html" />
</head>
<body>
    <p>Redirigiendo al Portal RNI...</p>
</body>
</html>"""

with open(os.path.join(deploy_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(root_index)

print(f"Deploy folder ready at: {deploy_dir}")
