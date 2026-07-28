import os
import subprocess
import sys

# Definir los scripts que se deben ejecutar en orden
# (Si usas otros scripts, puedes agregarlos a esta lista)
SCRIPTS = [
    # Covid
    r"Covid_Web\scripts\procesar_covid.py",
    # Influenza
    r"Influenza_Web\Scripts_Procesamiento\parse_influenza.py",
    # Programaticas
    r"Programáticas_Web\generate_data_2026.py",
    # VRS
    r"VRS\Scripts_Procesamiento\parse_vrs.py",
    
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
    cwd = os.path.dirname(os.path.abspath(script_path))
    if not cwd or cwd == os.path.abspath('.'):
        cwd = None
        
    try:
        result = subprocess.run(
            [sys.executable, os.path.basename(script_path)],
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
            print("\n[!] Proceso detenido debido a un error. Revisa los mensajes arriba.")
            sys.exit(1)
            
    print("\n" + "="*50)
    print("✅ ACTUALIZACIÓN COMPLETA")
    print("La carpeta 'cloudflare' ha sido reconstruida y está lista para ser subida.")
    print("="*50)

if __name__ == "__main__":
    main()
