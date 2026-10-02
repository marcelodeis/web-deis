import win32com.client
import os
import sys

def protect_excel(filepath, password):
    if not os.path.exists(filepath):
        print(f"Error: {filepath} no existe.")
        return False
        
    excel = win32com.client.Dispatch("Excel.Application")
    excel.DisplayAlerts = False
    excel.Visible = False
    
    abs_path = os.path.abspath(filepath)
    print(f"Encriptando: {abs_path}")
    
    try:
        wb = excel.Workbooks.Open(abs_path)
        wb.Password = password
        wb.Save()
        wb.Close()
        print("- Encriptacion exitosa.")
        return True
    except Exception as e:
        print(f"Error al encriptar: {str(e)}")
        return False
    finally:
        excel.Quit()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python encrypt_excel.py <archivo.xlsx> <contraseña>")
        sys.exit(1)
        
    archivo = sys.argv[1]
    pwd = sys.argv[2]
    protect_excel(archivo, pwd)
