import os
import shutil

src_dir = r"C:\Antigravity IDE\WEB DEIS"
dest_dir = r"C:\Antigravity IDE\WEB DEIS\cloudflare_deploy"

# Ensure clean deploy directory
if os.path.exists(dest_dir):
    shutil.rmtree(dest_dir)
os.makedirs(dest_dir)

# Folders that constitute the web app
web_folders = [
    'Covid_Web', 
    'Influenza_Web', 
    'VPH_Web', 
    'VRS', 
    'Portal_Web', 
    'Programáticas_Web', 
    'shared'
]

# Folders to completely skip (heavy backend or dev folders)
skip_folders = {
    'Scripts_Procesamiento',
    'Archivos_Excel',
    'Apoyo 2025',
    'Base Datos Minsal',
    'DEFUNCIONES',
    'NAC',
    '.claude',
    '.vibecheck',
    '.agents',
    'workflows',
    'Respaldos',
    'scripts'
}

# Allowed file extensions for the web
allowed_exts = {
    '.html', '.css', '.js', '.json',
    '.png', '.jpg', '.jpeg', '.svg', '.ico', '.gif',
    '.woff', '.woff2', '.ttf',
    '.xlsx', '.xls', '.pdf'
}

total_size = 0
file_count = 0

for folder in web_folders:
    folder_path = os.path.join(src_dir, folder)
    if not os.path.exists(folder_path):
        continue
        
    for root, dirs, files in os.walk(folder_path):
        # Filter directories in-place to skip unwanted ones
        dirs[:] = [d for d in dirs if d not in skip_folders]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in allowed_exts:
                # Construct full source path
                src_file = os.path.join(root, file)
                
                # Construct destination path preserving structure
                rel_path = os.path.relpath(src_file, src_dir)
                dest_file = os.path.join(dest_dir, rel_path)
                
                os.makedirs(os.path.dirname(dest_file), exist_ok=True)
                
                shutil.copy2(src_file, dest_file)
                total_size += os.path.getsize(src_file)
                file_count += 1

# Also copy index.html from root if it exists
root_index = os.path.join(src_dir, 'index.html')
if os.path.exists(root_index):
    shutil.copy2(root_index, dest_dir)
    total_size += os.path.getsize(root_index)
    file_count += 1

print(f"Deployment folder created at: {dest_dir}")
print(f"Total files copied: {file_count}")
print(f"Total size: {total_size / (1024*1024):.2f} MB")
