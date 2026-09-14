import os, shutil, datetime

backup_dir = "Respaldo_Integral_QA_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(backup_dir, exist_ok=True)

folders_to_backup = [
    "Covid_Web",
    "Programáticas_Web",
    "VRS"
]

for folder in folders_to_backup:
    if os.path.exists(folder):
        shutil.copytree(folder, os.path.join(backup_dir, folder))
        print(f"Respaldado: {folder}")
    else:
        print(f"Carpeta no encontrada: {folder}")

print(f"Respaldo completo creado en: {backup_dir}")
