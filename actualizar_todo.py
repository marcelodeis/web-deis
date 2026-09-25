import os
import subprocess
import sys

# Definir los scripts que se deben ejecutar en orden
SCRIPTS = [
    # Covid
    r"Covid_Web\scripts\procesar_covid.py",
    r"Covid_Web\scripts\generar_indice_covid.py",
    
    # Influenza
    r"Influenza_Web\Scripts_Procesamiento\parse_influenza.py",
    r"Influenza_Web\Scripts_Procesamiento\generar_indice_influenza.py",
    r"generar_rescates_influenza.py", # ADDED! Generates Excel files
    r"generar_rescates_ninos_2dosis.py", # ADDED! Generates children 2nd dose rescue
    r"generar_rechazos_influenza.py", # ADDED! Generates Rechazos Excel files
    
    # Programaticas
    # Replaced generate_data_2026 with generar_rescates_v5 since it handles everything now
    r"Programáticas_Web\generar_rescates_v5.py",
    
    # VRS
    r"VRS\Scripts_Procesamiento\parse_vrs.py", # This also generates Excel files for VRS
    r"VRS\scripts\generar_indice_vrs.py",
    
    # VPH
    r"VPH_Web\procesar_observatorio_vph.py",
    r"VPH_Web\procesar_ocurrencia_vph.py",
    r"VPH_Web\integrar_ocurrencia.py",
    r"VPH_Web\scripts\generar_indice_vph.py",
    
    # Actualizar Cache Busters
    r"update_cache_busters.py",
    
    # Finalmente construir para Cloudflare
    r"construir_cloudflare.py"
]

def run_script(script_path):
    if not os.path.exists(script_path):
        print(f"[!] ADVERTENCIA: No se encontró el script {script_path}")
        return False
        
    print(f"\n{'='*50}")
    print(f"[*] Ejecutando: {script_path}")
    print(f"{'='*50}")
    
    # Determinar el directorio de trabajo basándose en la ubicación del script
    parts = os.path.normpath(script_path).split(os.sep)
    if len(parts) > 1 and parts[0] != script_path:
        cwd = os.path.abspath(parts[0])
    else:
        cwd = os.path.abspath('.')
        
    try:
        # Run relative to cwd
        rel_path = os.path.relpath(os.path.abspath(script_path), cwd)
        
        result = subprocess.run(
            [sys.executable, rel_path],
            cwd=cwd,
            check=True
        )
        print(f"[+] {script_path} completado con éxito.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[-] ERROR al ejecutar {script_path}.")
        return False
    except Exception as e:
        print(f"[-] ERROR inesperado: {e}")
        return False

def main():
    print("Iniciando Proceso Maestro de Actualización WEB DEIS...")
    
    for script in SCRIPTS:
        success = run_script(script)
        if not success:
            print(f"\n[!] Proceso detenido debido a un error en {script}. Revisa los mensajes arriba.")
            sys.exit(1)
            
    print("\n" + "="*50)
    print("ACTUALIZACIÓN COMPLETA")
    print("La carpeta 'cloudflare' ha sido reconstruida y está lista para ser subida.")
    print("="*50)

if __name__ == "__main__":
    main()
