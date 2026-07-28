import os
import shutil
from datetime import datetime

# Directorio raíz (donde están todos los proyectos)
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Directorio de salida para Cloudflare
CLOUDFLARE_DIR = os.path.join(ROOT_DIR, 'cloudflare')

# Carpetas a ignorar al copiar los dashboards
IGNORE_PATTERNS = shutil.ignore_patterns(
    '.venv', '.trunk', '__pycache__', '.git', '.github', '.cursor',
    'node_modules', '*.log', '.env', 'Scripts_Procesamiento', 'generar_datos.py',
    '*.zip', '*.pdf', 'cloudflare', 'Respaldos_Proyecto', 'Documentos_PDF', 'Archivos_Excel'
)

def limpiar_directorio_cloudflare():
    if os.path.exists(CLOUDFLARE_DIR):
        print(f"Limpiando directorio {CLOUDFLARE_DIR}...")
        shutil.rmtree(CLOUDFLARE_DIR, ignore_errors=True)
    os.makedirs(CLOUDFLARE_DIR, exist_ok=True)
    print("Directorio 'cloudflare' creado exitosamente.")

def copiar_portal():
    print("Copiando Portal RNI...")
    portal_dir = os.path.join(ROOT_DIR, 'Portal_Web')
    
    # Copiar index.html y styles.css del portal a la raíz de cloudflare
    shutil.copy2(os.path.join(portal_dir, 'index.html'), os.path.join(CLOUDFLARE_DIR, 'index.html'))
    shutil.copy2(os.path.join(portal_dir, 'styles.css'), os.path.join(CLOUDFLARE_DIR, 'styles.css'))
    
    # Copiar imágenes si existen
    for item in os.listdir(portal_dir):
        if item.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif')):
            shutil.copy2(os.path.join(portal_dir, item), os.path.join(CLOUDFLARE_DIR, item))
    print("Portal RNI copiado a la raíz.")

def copiar_dashboard(nombre_origen, nombre_destino):
    origen = os.path.join(ROOT_DIR, nombre_origen)
    destino = os.path.join(CLOUDFLARE_DIR, nombre_destino)
    
    if os.path.exists(origen):
        print(f"Empaquetando dashboard: {nombre_origen} -> /{nombre_destino}...")
        shutil.copytree(origen, destino, ignore=IGNORE_PATTERNS)
    else:
        print(f"ADVERTENCIA: No se encontró la carpeta {nombre_origen}")

def construir():
    print("=== INICIANDO CONSTRUCCIÓN PARA CLOUDFLARE ===")
    limpiar_directorio_cloudflare()
    
    # 1. Copiar el Portal Central a la raíz
    copiar_portal()
    
    # 2. Copiar los 4 Dashboards como sub-rutas
    copiar_dashboard('Influenza_Web', 'influenza')
    copiar_dashboard('Covid_Web', 'covid')
    copiar_dashboard('VRS', 'vrs')
    copiar_dashboard('Programáticas_Web', 'programaticas')
    
    print("\n=== ¡CONSTRUCCIÓN COMPLETADA! ===")
    print("La carpeta 'cloudflare' está lista para ser subida a Cloudflare Pages.")
    print("Las URLs serán:")
    print(" - www.rni.cl/")
    print(" - www.rni.cl/influenza/")
    print(" - www.rni.cl/covid/")
    print(" - www.rni.cl/vrs/")
    print(" - www.rni.cl/programaticas/")
    
    guardar_respaldo()

def guardar_respaldo():
    print("\n=== GENERANDO RESPALDO AUTOMÁTICO ===")
    respaldos_dir = os.path.join(ROOT_DIR, 'Respaldos')
    os.makedirs(respaldos_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    nombre_zip = f"Respaldo_Web_{timestamp}"
    ruta_zip = os.path.join(respaldos_dir, nombre_zip)
    
    # Crear un archivo ZIP de toda la carpeta cloudflare
    shutil.make_archive(ruta_zip, 'zip', CLOUDFLARE_DIR)
    print(f"Respaldo guardado exitosamente en: Respaldos/{nombre_zip}.zip")

if __name__ == '__main__':
    construir()
