import os, shutil, datetime, hashlib, json

backup_dir = "Respaldo_Integral_QA_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(backup_dir, exist_ok=True)

folders_to_backup = [
    "Covid_Web",
    "Programáticas_Web",
    "VRS",
    "VPH_Web",
    r"BASE DATOS MINSAL\2026"
]

manifest = {}

def get_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

for folder in folders_to_backup:
    if os.path.exists(folder):
        dest = os.path.join(backup_dir, os.path.basename(folder))
        # Handle the fact that BASE DATOS MINSAL\2026 is a subfolder, so we just put it in a 2026 folder.
        if "2026" in folder:
            dest = os.path.join(backup_dir, "BASE DATOS MINSAL", "2026")
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            
        shutil.copytree(folder, dest, dirs_exist_ok=True)
        print(f"Respaldado: {folder}")
        
        # Calculate hashes
        for root, _, files in os.walk(dest):
            for file in files:
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, backup_dir)
                manifest[rel_path] = {
                    "size": os.path.getsize(filepath),
                    "sha256": get_sha256(filepath)
                }
    else:
        print(f"Carpeta no encontrada: {folder}")

manifest_path = os.path.join(backup_dir, "manifest.json")
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=4, ensure_ascii=False)

print(f"Respaldo completo y manifest.json creados en: {backup_dir}")
