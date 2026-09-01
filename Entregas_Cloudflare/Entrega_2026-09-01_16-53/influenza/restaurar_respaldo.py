import os
import zipfile
import glob

def restaurar_respaldo():
    carpeta_respaldos = "Respaldos_Proyecto"
    
    if not os.path.exists(carpeta_respaldos):
        print(f"Error: No se encontró la carpeta '{carpeta_respaldos}'.")
        input("Presiona Enter para salir...")
        return
        
    # Buscar archivos zip
    archivos_zip = glob.glob(os.path.join(carpeta_respaldos, "*.zip"))
    
    if not archivos_zip:
        print("No se encontraron archivos de respaldo (.zip) en la carpeta.")
        input("Presiona Enter para salir...")
        return
        
    print("=====================================================")
    print("               RESTAURADOR DE RESPALDOS              ")
    print("=====================================================")
    print("¡PELIGRO! Al restaurar un respaldo, se SOBREESCRIBIRÁN")
    print("los archivos actuales de tu proyecto (HTML, JS, CSS).")
    print("Cualquier cambio que no hayas respaldado se perderá.\n")
    
    # Listar respaldos ordenados por fecha (más reciente primero)
    archivos_zip.sort(key=os.path.getmtime, reverse=True)
    
    for i, archivo in enumerate(archivos_zip):
        nombre = os.path.basename(archivo)
        print(f"[{i + 1}] {nombre}")
        
    print(f"[{len(archivos_zip) + 1}] Cancelar y salir")
    
    try:
        opcion = int(input("\nIngresa el número del respaldo que deseas restaurar: "))
    except ValueError:
        print("Opción no válida. Saliendo...")
        input("Presiona Enter para salir...")
        return
        
    if opcion == len(archivos_zip) + 1:
        print("Operación cancelada. No se ha modificado nada.")
        input("Presiona Enter para salir...")
        return
        
    if 1 <= opcion <= len(archivos_zip):
        archivo_elegido = archivos_zip[opcion - 1]
        
        confirmacion = input(f"\n¿Estás ABSOLUTAMENTE SEGURO de restaurar '{os.path.basename(archivo_elegido)}'? (s/n): ")
        if confirmacion.lower() == 's':
            print(f"\nRestaurando archivos desde {os.path.basename(archivo_elegido)}...")
            
            try:
                with zipfile.ZipFile(archivo_elegido, 'r') as zip_ref:
                    # Extraer en la carpeta actual (sobrescribe archivos existentes)
                    zip_ref.extractall(".")
                    
                print("\n-----------------------------------------------------")
                print("¡RESTAURACIÓN COMPLETADA CON ÉXITO!")
                print("Recuerda actualizar tu navegador web con Ctrl + F5")
                print("para borrar el caché y ver la versión restaurada.")
                print("-----------------------------------------------------")
            except Exception as e:
                print(f"\nError al intentar restaurar el archivo: {e}")
        else:
            print("Operación cancelada. No se ha modificado nada.")
    else:
        print("Opción fuera de rango. Saliendo...")
        
    input("\nPresiona Enter para cerrar esta ventana...")

if __name__ == "__main__":
    restaurar_respaldo()
