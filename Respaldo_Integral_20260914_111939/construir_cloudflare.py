import os
import shutil
from datetime import datetime

# Directorio raíz (donde están todos los proyectos)
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Directorio de salida para Cloudflare
TIMESTAMP = datetime.now().strftime("%Y-%m-%d_%H-%M")
ENTREGAS_DIR = os.path.join(ROOT_DIR, 'Entregas_Cloudflare')
CLOUDFLARE_DIR = os.path.join(ENTREGAS_DIR, f'Entrega_{TIMESTAMP}')

# Extensiones a excluir globalmente
EXCLUDE_EXTENSIONS = {
    '.py', '.pyc', '.pyo',       # Python
    '.pdf',                       # PDF
    '.zip', '.rar', '.7z',       # Comprimidos
    '.log', '.txt', '.md',       # Logs y documentación
    '.bat', '.sh', '.lnk',      # Scripts de sistema
    '.gitignore', '.gitattributes',
}

# Nombres de archivos/carpetas a excluir
EXCLUDE_NAMES = {
    '.git', '.github', '.cursor', '.claude', '.agents', '.trunk', '.vibecheck',
    '__pycache__', 'node_modules',
    'Scripts_Procesamiento', 'scripts',  # Carpetas de procesamiento Python
    'Respaldos_Proyecto', 'Respaldos', 'Documentos_PDF', 'Archivos_Excel',
    'Cloudflare_FINAL_Subir', 'cloudflare_deploy', 'cloudflare',
    'BASE DATOS MINSAL', 'Entregas_Cloudflare',
    'Netlify', 'PDF', 'Directorio_Cloudflare',
    'temp_regen', 'temp_backup_staging',
    'Respaldo_Integral_QA_20260907_120841', 'Respaldo_Integral_QA_20260907_144400',
    'Respaldos_Influenza_QA_20260907_110733', 'Respaldos_Influenza_QA_20260907_114822',
    'Avance Cobertura', 'Calendario Vacunación', 'Apoyo 2025',
    'workflows', '.github',
}

# Patrones de nombre parcial a excluir (contiene alguno de estos)
EXCLUDE_CONTAINS = [
    '_backup_', '_scenA', '_scenB', '_scenC',
    'backup_antes', 'backup_visual', 'backup_aprobado',
    'index_fixed', 'index_backup', 'index2',
    'original_autoconsulta', 'rechazos_backup',
    'script_backup_',  'styles_backup_',
    'output_log', 'extracted_rechazos',
    'temp_autoconsulta', 'temp_styles',
    'audit_barchart', 'check_reconciliation', 'check_total',
    'test_doses', 'test_dynamic', 'test_gethelp', 'test_validate', 'test_showresults',
    'calc.js', 'debug.js',
    'programaticas_data_2025_v', 'programaticas_data_2026_v',
    'programaticas_data_all',
    'bundle_js',
    'respaldo_v24',
    'vrs_duplicates', 'vrs_old',
    'implementation_plan', 'preflight_output', 'task.md', 'walkthrough.md',
    'CLAUDE.md', 'GUIA_ACTUALIZACION',
    'matches.txt', 'lt_url.txt', 'ssh_tunnel.txt',
    'package-lock.json', 'package.json',
    'iniciar_dashboard',
]

def should_exclude(name, is_dir=False):
    """Determina si un archivo o carpeta debe ser excluido."""
    # Excluir por nombre exacto
    if name in EXCLUDE_NAMES:
        return True
    
    # Excluir carpetas ocultas (empiezan con .)
    if name.startswith('.'):
        return True
    
    if not is_dir:
        # Excluir por extensión
        _, ext = os.path.splitext(name)
        if ext.lower() in EXCLUDE_EXTENSIONS:
            return True
        
        # Excluir por patrón parcial
        name_lower = name.lower()
        for pattern in EXCLUDE_CONTAINS:
            if pattern.lower() in name_lower:
                return True
    
    return False

def copiar_filtrado(src, dst):
    """Copia recursivamente solo los archivos necesarios para producción."""
    os.makedirs(dst, exist_ok=True)
    
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        
        if os.path.isdir(s):
            if should_exclude(item, is_dir=True):
                continue
            copiar_filtrado(s, d)
        else:
            if should_exclude(item, is_dir=False):
                continue
            shutil.copy2(s, d)

def copiar_portal():
    print("  Copiando Portal RNI...")
    portal_dir = os.path.join(ROOT_DIR, 'Portal_Web')
    
    # Copiar index.html y styles.css del portal a la raíz de cloudflare
    shutil.copy2(os.path.join(portal_dir, 'index.html'), os.path.join(CLOUDFLARE_DIR, 'index.html'))
    shutil.copy2(os.path.join(portal_dir, 'styles.css'), os.path.join(CLOUDFLARE_DIR, 'styles.css'))
    
    # Copiar imágenes si existen
    for item in os.listdir(portal_dir):
        if item.endswith(('.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.webp')):
            shutil.copy2(os.path.join(portal_dir, item), os.path.join(CLOUDFLARE_DIR, item))
    print("    ✓ Portal copiado a la raíz")

def copiar_dashboard(nombre_origen, nombre_destino):
    origen = os.path.join(ROOT_DIR, nombre_origen)
    destino = os.path.join(CLOUDFLARE_DIR, nombre_destino)
    
    if os.path.exists(origen):
        print(f"  Empaquetando: {nombre_origen} -> /{nombre_destino}/...")
        copiar_filtrado(origen, destino)
        
        # Contar archivos copiados y tamaño
        total_files = 0
        total_size = 0
        for root, dirs, files in os.walk(destino):
            for f in files:
                total_files += 1
                total_size += os.path.getsize(os.path.join(root, f))
        print(f"    ✓ {total_files} archivos ({total_size / 1024 / 1024:.1f} MB)")
    else:
        print(f"    ✗ ADVERTENCIA: No se encontró {nombre_origen}")

def copiar_shared():
    print("  Copiando recursos compartidos (shared)...")
    shared_dir = os.path.join(ROOT_DIR, 'shared')
    destino_shared = os.path.join(CLOUDFLARE_DIR, 'shared')
    if os.path.exists(shared_dir):
        copiar_filtrado(shared_dir, destino_shared)
        print("    ✓ Carpeta 'shared' copiada")
    else:
        print("    ✗ ADVERTENCIA: No se encontró 'shared'")

def arreglar_enlaces_html():
    print("  Arreglando enlaces internos en HTML...")
    reemplazos = {
        '../Influenza_Web/index.html': '/influenza/',
        '../Covid_Web/index.html': '/covid/',
        '../VRS/index.html': '/vrs/',
        '../VPH_Web/index.html': '/vph/',
        '../Programáticas_Web/index.html': '/programaticas/',
        '../Portal_Web/index.html': '/',
        '../shared/': '/shared/'
    }
    count = 0
    for root_dir, dirs, files in os.walk(CLOUDFLARE_DIR):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root_dir, file)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                modified = False
                for viejo, nuevo in reemplazos.items():
                    if viejo in content:
                        content = content.replace(viejo, nuevo)
                        modified = True
                
                if modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    count += 1
    print(f"    ✓ {count} archivos HTML actualizados")

def resumen_final():
    """Muestra un resumen del tamaño total."""
    total_files = 0
    total_size = 0
    by_ext = {}
    
    for root, dirs, files in os.walk(CLOUDFLARE_DIR):
        for f in files:
            total_files += 1
            fpath = os.path.join(root, f)
            fsize = os.path.getsize(fpath)
            total_size += fsize
            ext = os.path.splitext(f)[1].lower() or '(sin ext)'
            by_ext[ext] = by_ext.get(ext, 0) + fsize
    
    print(f"\n{'='*55}")
    print(f"  RESUMEN DE LA ENTREGA")
    print(f"{'='*55}")
    print(f"  Archivos totales: {total_files}")
    print(f"  Tamaño total:     {total_size / 1024 / 1024:.1f} MB")
    print(f"\n  Desglose por tipo:")
    for ext, size in sorted(by_ext.items(), key=lambda x: -x[1]):
        print(f"    {ext:12s}  {size / 1024 / 1024:6.1f} MB")
    print(f"\n  Carpeta: {CLOUDFLARE_DIR}")
    print(f"{'='*55}")

def construir():
    print(f"\n{'='*55}")
    print(f"  CONSTRUCCIÓN PARA CLOUDFLARE")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'='*55}\n")
    
    if os.path.exists(CLOUDFLARE_DIR):
        shutil.rmtree(CLOUDFLARE_DIR, ignore_errors=True)
    os.makedirs(CLOUDFLARE_DIR, exist_ok=True)
    
    copiar_portal()
    copiar_shared()
    
    copiar_dashboard('Influenza_Web', 'influenza')
    copiar_dashboard('Covid_Web', 'covid')
    copiar_dashboard('VRS', 'vrs')
    copiar_dashboard('VPH_Web', 'vph')
    copiar_dashboard('Programáticas_Web', 'programaticas')
    
    arreglar_enlaces_html()
    resumen_final()
    
    print(f"\n  URLs de producción:")
    print(f"    rni.cl/              (Portal)")
    print(f"    rni.cl/influenza/    (Influenza)")
    print(f"    rni.cl/covid/        (Covid)")
    print(f"    rni.cl/vrs/          (VRS)")
    print(f"    rni.cl/vph/          (VPH)")
    print(f"    rni.cl/programaticas/(Programáticas)")
    print(f"\n  ¡Listo para subir a Cloudflare Pages!\n")

if __name__ == '__main__':
    construir()
