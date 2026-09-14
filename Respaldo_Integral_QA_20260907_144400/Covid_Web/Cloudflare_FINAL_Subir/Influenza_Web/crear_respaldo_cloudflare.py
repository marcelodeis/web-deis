import os
import zipfile
import shutil
from datetime import datetime

def preparar_cloudflare():
    print("Iniciando proceso de actualizacion para Cloudflare...")
    
    # 1. Crear respaldo en Respaldos_Proyecto
    carpeta_respaldos = "Respaldos_Proyecto"
    os.makedirs(carpeta_respaldos, exist_ok=True)
    
    ahora = datetime.now()
    fecha_str = ahora.strftime('%Y-%m-%d')
    nombre_zip = f"respaldo_web_{ahora.strftime('%d_%m_%Y_%H_%M')}.zip"
    ruta_zip = os.path.join(carpeta_respaldos, nombre_zip)
    
    archivos_a_respaldar = [
        "index.html", "script.js", "styles.css", 
        "dashboard_data_2025.js", "dashboard_data_2025.json",
        "dashboard_data_2026.js", "dashboard_data_2026.json",
        "Scripts_Procesamiento/parse_influenza.py"
    ]
    
    print(f"\n1. Creando respaldo completo del proyecto en: {ruta_zip}")
    with zipfile.ZipFile(ruta_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for archivo in archivos_a_respaldar:
            if os.path.exists(archivo):
                zipf.write(archivo)
        # Incluir georeferencia en el respaldo si existe
        if os.path.exists("georeferencia"):
            for root, dirs, files in os.walk("georeferencia"):
                for file in files:
                    zipf.write(os.path.join(root, file))
    
    print("   Respaldo creado con exito.")

    # 2. Manejar la carpeta Cloudflare
    print(f"\n2. Organizando carpeta Cloudflare...")
    carpeta_cf = "cloudflare"
    os.makedirs(carpeta_cf, exist_ok=True)
    
    # Crear nueva carpeta con la fecha y hora exactas para no borrar ningún respaldo
    fecha_hora_str = ahora.strftime('%Y-%m-%d_%H-%M-%S')
    nueva_carpeta = os.path.join(carpeta_cf, f"{fecha_hora_str}")
    os.makedirs(nueva_carpeta, exist_ok=True)
    
    # Archivos a copiar a Cloudflare
    archivos_web = [
        "index.html", "script.js", "styles.css", 
        "dashboard_data_2025.js", "dashboard_data_2026.js"
    ]
    
    archivos_copiados = 0
    for archivo in archivos_web:
        if os.path.exists(archivo):
            shutil.copy2(archivo, os.path.join(nueva_carpeta, os.path.basename(archivo)))
            archivos_copiados += 1
            
    if os.path.exists("georeferencia"):
        shutil.copytree(
            "georeferencia", 
            os.path.join(nueva_carpeta, "georeferencia"),
            ignore=shutil.ignore_patterns('.venv', '__pycache__', '.git', '*.pyc', 'api')
        )
        archivos_copiados += 1
        
    print(f"   Archivos web ({archivos_copiados}) copiados a: {nueva_carpeta}")
    print("\nProceso Finalizado!")
    print(f"Se ha creado un nuevo respaldo listo para subir a la web en: {nueva_carpeta}")
    print("--------------------------------------------------------------------")

if __name__ == "__main__":
    preparar_cloudflare()
    input("\nPresiona Enter para salir...")
