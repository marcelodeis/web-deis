import os
import zipfile

entregas_dir = r"C:\Antigravity IDE\WEB DEIS\Entregas_Cloudflare"
zip_path = os.path.join(entregas_dir, "Cloudflare_Deploy_Final.zip")

# Find the latest Entrega folder
folders = [d for d in os.listdir(entregas_dir) if d.startswith("Entrega_") and os.path.isdir(os.path.join(entregas_dir, d))]
if not folders:
    print("No Entrega folders found.")
    exit(1)

latest_folder = max(folders)
src_path = os.path.join(entregas_dir, latest_folder)

print(f"Empaquetando desde la carpeta más reciente: {latest_folder}")

if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, _, files in os.walk(src_path):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, src_path)
            zipf.write(file_path, arcname)

print("Deploy zip created successfully at:", zip_path)
