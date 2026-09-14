import os
import zipfile
import shutil
from datetime import datetime

def crear_respaldo():
    # Carpeta de destino
    carpeta_respaldos = "Respaldos_Proyecto"
    if not os.path.exists(carpeta_respaldos):
        os.makedirs(carpeta_respaldos)
        
    # Obtener fecha y hora actual para el nombre del archivo
    ahora = datetime.now()
    nombre_zip = f"respaldo_{ahora.strftime('%d_%m_%Y_%H_%M')}.zip"
    ruta_zip = os.path.join(carpeta_respaldos, nombre_zip)
    
    # Archivos clave a respaldar
    archivos_a_respaldar = [
        "index.html",
        "script.js",
        "styles.css",
        "dashboard_data_2025.js",
        "dashboard_data_2025.json",
        "dashboard_data_2026.js",
        "dashboard_data_2026.json",
        "Scripts_Procesamiento/parse_influenza.py",
        "Scripts_Procesamiento/fix_chart.py"
    ]
    
    archivos_incluidos = 0
    
    print(f"Creando respaldo en: {ruta_zip}")
    with zipfile.ZipFile(ruta_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for archivo in archivos_a_respaldar:
            if os.path.exists(archivo):
                zipf.write(archivo)
                print(f" + Agregado: {archivo}")
                archivos_incluidos += 1
            else:
                print(f" - Ignorado (no existe): {archivo}")
                
    print("\n----------------------------------------")
    print(f"¡Respaldo creado con éxito!")
    print(f"Se respaldaron {archivos_incluidos} archivos.")
    print(f"Archivo guardado como: {ruta_zip}")
    
    # --- Lógica de preparación para Netlify ---
    carpeta_netlify = "Netlify"
    if not os.path.exists(carpeta_netlify):
        os.makedirs(carpeta_netlify)
        
    nombre_carpeta_subida = f"Subida_{ahora.strftime('%d_%m_%Y')}"
    ruta_subida = os.path.join(carpeta_netlify, nombre_carpeta_subida)
    
    # Archivos web exclusivos para subir a internet
    archivos_web = [
        "index.html",
        "script.js",
        "styles.css",
        "dashboard_data_2025.js",
        "dashboard_data_2025.json",
        "dashboard_data_2026.js",
        "dashboard_data_2026.json"
    ]
    
    print("\n----------------------------------------")
    print(f"Preparando paquete web para Netlify en: {ruta_subida}")
    
    if not os.path.exists(ruta_subida):
        os.makedirs(ruta_subida)
        
    archivos_netlify = 0
    for archivo in archivos_web:
        if os.path.exists(archivo):
            shutil.copy2(archivo, os.path.join(ruta_subida, os.path.basename(archivo)))
            print(f" + Copiado a Netlify: {archivo}")
            archivos_netlify += 1
        else:
            print(f" - Ignorado (no existe): {archivo}")
            
    print(f"¡Paquete de {archivos_netlify} archivos listo para subir a Netlify!")
    print("----------------------------------------")

if __name__ == "__main__":
    crear_respaldo()
