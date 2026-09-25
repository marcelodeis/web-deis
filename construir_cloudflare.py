import os
import shutil
import sys
import re
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_PUBLIC_DIR = ROOT_DIR
ENTREGAS_DIR = os.path.join(ROOT_DIR, 'Entregas_Cloudflare')
TIMESTAMP = datetime.now().strftime("%Y-%m-%d_%H-%M")
CLOUDFLARE_DIR = os.path.join(ENTREGAS_DIR, f'Entrega_{TIMESTAMP}')

ALLOWED_EXTENSIONS = {
    '.html', '.css', '.js', '.json', '.geojson',
    '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif',
    '.woff', '.woff2', '.ttf', '.eot', '.xlsx', '.xls'
}

BANNED_EXTENSIONS = {
    '.csv', '.env', '.zip', '.7z', '.rar',
    '.bak', '.py', '.pem', '.key', '.pfx', '.sqlite', '.db', '.sql', '.log'
}

# Regex parameters for nominal detection (keys inside JSON or words in text)
# Modificado: Se quitó NOMBRE por ser muy común en GeoJSON (nombre de comuna)
# o se le añade una exclusión explícita si la clave está en GeoJSON.
NOMINAL_PATTERNS = [
    r'["\']RUT["\']\s*:', 
    r'["\']RUN["\']\s*:', 
    r'["\']APELLIDO["\']\s*:', 
    r'["\']FECHA_NACIMIENTO["\']\s*:',
    r'["\']password["\']\s*:',
    r'["\']API_KEY["\']\s*:',
    r'["\']SECRET["\']\s*:'
]
regex_nominal = re.compile('|'.join(NOMINAL_PATTERNS), re.IGNORECASE)

def preflight_check(directory):
    print("Iniciando validación PRE-DEPLOY de seguridad...")
    if not os.path.exists(directory):
        print(f"[ERROR CRÍTICO] El directorio origen {directory} no existe.")
        sys.exit(1)

    for root, dirs, files in os.walk(directory):
        if root == directory:
            dirs[:] = [d for d in dirs if not d.startswith('.') and d in ['Covid_Web', 'Influenza_Web', 'Portal_Web', 'Programáticas_Web', 'VPH_Web', 'VRS']]
            continue


        for file in files:
            path = os.path.join(root, file)
            _, ext = os.path.splitext(file)
            ext = ext.lower()

            # Bloqueo 1: Extensiones
            if ext not in ALLOWED_EXTENSIONS:
                print(f"[SKIP] Ignorando archivo no autorizado: {file}")
                continue

            if ext not in ALLOWED_EXTENSIONS:
                print(f"\n[BLOQUEO DE SEGURIDAD] Extensión NO autorizada en lista blanca detectada.")
                print(f"Archivo: {path}")
                print(f"Tipo: {ext}")
                print("ABORTANDO DESPLIEGUE.")
                sys.exit(1)

            # Bloqueo 2: Detección Nominal (solo en archivos de texto, ignorar geojson/js de mapas)
            if ext in ['.html', '.js', '.json', '.css'] and "comunas" not in file.lower() and "regiones" not in file.lower():
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for idx, line in enumerate(f):
                            if regex_nominal.search(line):
                                print(f"\n[BLOQUEO DE SEGURIDAD] Posible fuga de datos nominales o secretos.")
                                print(f"Archivo: {path}")
                                print(f"Línea aproximada: {idx+1}")
                                print("Patrón sospechoso detectado.")
                                print("ABORTANDO DESPLIEGUE.")
                                sys.exit(1)
                except Exception as e:
                    pass
    
    print("[OK] Validación PRE-DEPLOY superada con éxito. Cero hallazgos nominales o prohibidos.")

# Carpetas basura que NUNCA deben empaquetarse (a cualquier nivel de profundidad)
EXCLUDED_DIRS = {
    'Cloudflare_FINAL_Subir', 'Directorio_Cloudflare', 'Entregas_Cloudflare',
    'node_modules', '__pycache__', 'workflows', 'Apoyo 2025',
    'cloudflare', 'georeferencia', 'Respaldos_Proyecto', 'temp_regen',
    'Documentos_PDF', 'Archivos_Excel', 'Scripts_Procesamiento', 'Netlify',
    'data', 'scratch', 'shared', 'BASE DATOS MINSAL', 'Respaldos',
    'WEB_PUBLIC', 'Reportes_Privados', 'PRIVADO', 'Avance Cobertura',
    'Calendario Vacunación',
}

# Módulos web autorizados en la raíz
WEB_MODULES = {'Covid_Web', 'Influenza_Web', 'Portal_Web', 'Programáticas_Web', 'VPH_Web', 'VRS'}

def empaquetar_cloudflare():
    preflight_check(WEB_PUBLIC_DIR)
    
    print(f"\nEmpaquetando desde carpetas web activas hacia {CLOUDFLARE_DIR}...")
    os.makedirs(CLOUDFLARE_DIR, exist_ok=True)
    
    total_files = 0
    total_size = 0
    
    for root, dirs, files in os.walk(WEB_PUBLIC_DIR):
        # En la raíz: solo entrar a los módulos web autorizados
        if root == WEB_PUBLIC_DIR:
            dirs[:] = [d for d in dirs if d in WEB_MODULES]
            continue
        
        # En cualquier otro nivel: excluir carpetas basura y ocultas
        dirs[:] = [d for d in dirs if not d.startswith('.') and not d.startswith('_') and d not in EXCLUDED_DIRS]
            
        for file in files:
            _, ext = os.path.splitext(file)
            if ext.lower() not in ALLOWED_EXTENSIONS:
                continue
                
            src = os.path.join(root, file)
            rel_path = os.path.relpath(root, WEB_PUBLIC_DIR)
            dst_dir = os.path.join(CLOUDFLARE_DIR, rel_path)
            os.makedirs(dst_dir, exist_ok=True)
            dst = os.path.join(dst_dir, file)
            
            shutil.copy2(src, dst)
            total_files += 1
            total_size += os.path.getsize(src)
            
    # Copiar el index.html raíz (redireccionador a Portal_Web)
    root_index = os.path.join(WEB_PUBLIC_DIR, 'index.html')
    if os.path.exists(root_index):
        shutil.copy2(root_index, os.path.join(CLOUDFLARE_DIR, 'index.html'))
        total_files += 1
        total_size += os.path.getsize(root_index)
        print("[OK] index.html raíz (redireccionador) incluido.")
    else:
        print("[ADVERTENCIA] No se encontró index.html raíz. rni.cl/ dará error 404.")
            
    print(f"[OK] Empaquetado completado: {total_files} archivos ({total_size / 1024 / 1024:.2f} MB)")
    print("[OK] El paquete está listo para subir a Cloudflare de forma segura.")

if __name__ == '__main__':
    print("=== CONSTRUCTOR CLOUDFLARE (SECURE MODE V2) ===")
    empaquetar_cloudflare()
