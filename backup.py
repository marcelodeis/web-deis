import os, shutil, hashlib, datetime, json

backup_dir = "Respaldos_Influenza_QA_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(backup_dir, exist_ok=True)

files_to_backup = [
    r"BASE DATOS MINSAL\2026\Influenza_Residencia_2026.csv",
    r"BASE DATOS MINSAL\2026\Influenza_Ocurrencia_2026.csv",
    r"Influenza_Web\Archivos_Excel\Metas_Influenza_2026.xlsx",
    r"Influenza_Web\dashboard_data_2026.js",
    r"Influenza_Web\dashboard_data_2026.json",
    r"Influenza_Web\rechazos.js",
    r"Influenza_Web\data_rechazos.js",
    r"Influenza_Web\influenza_runs_index.js",
    r"Influenza_Web\autoconsulta.js",
    r"Influenza_Web\index.html",
    r"Influenza_Web\script.js",
    r"Influenza_Web\styles.css",
    r"Influenza_Web\Scripts_Procesamiento\parse_influenza.py"
]

manifest = []
for f in files_to_backup:
    if os.path.exists(f):
        dest = os.path.join(backup_dir, os.path.basename(f))
        shutil.copy2(f, dest)
        sz = os.path.getsize(f)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime("%Y-%m-%d %H:%M:%S")
        
        h = hashlib.sha256()
        with open(f, "rb") as bf:
            h.update(bf.read())
            
        manifest.append({
            "file": f,
            "size_bytes": sz,
            "mtime": mtime,
            "sha256": h.hexdigest()
        })
        
with open(os.path.join(backup_dir, "manifest.json"), "w", encoding="utf-8") as mf:
    json.dump(manifest, mf, indent=2)

print(f"Backup creado exitosamente en: {backup_dir}")
