import pandas as pd
import os
import re

def clean_run(run_str):
    if pd.isna(run_str):
        return ""
    s = str(run_str).strip().upper()
    if not s:
        return ""
    s = s.replace(".", "").replace(" ", "")
    if "-" in s:
        s = s.split("-")[0]
    return s

def leer_defunciones():
    print("\nLeyendo bases históricas de DEFUNCIONES para descartar fallecidos...")
    base_dir = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"
    defunciones_set = set()
    
    # Buscar archivos DEF*.csv y DEF*.xlsx (desde 1999 hasta 2026)
    archivos_def = []
    for root, _, files in os.walk(base_dir):
        for f in files:
            if f.upper().startswith("DEF") and (f.endswith(".csv") or f.endswith(".xlsx")):
                archivos_def.append(os.path.join(root, f))
                
    for archivo in sorted(archivos_def):
        #print(f"  Procesando {os.path.basename(archivo)}...")
        try:
            if archivo.endswith(".csv"):
                # Leer usando chunksize o engine c para mayor velocidad
                df = pd.read_csv(archivo, sep="|", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
                if df.empty:
                    df = pd.read_csv(archivo, sep=";", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
            else:
                # Leer excel
                df = pd.read_excel(archivo, usecols=lambda c: 'RUN' in str(c).upper(), dtype=str)
                
            for col in df.columns:
                if 'RUN' in col.upper():
                    cleaned = df[col].apply(clean_run)
                    defunciones_set.update(cleaned.dropna().unique())
                    break # Solo necesitamos la primera columna de RUN
                    
        except Exception as e:
            # Fallback for encoding errors in CSV
            try:
                if archivo.endswith(".csv"):
                    df = pd.read_csv(archivo, sep="|", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='latin-1')
                    for col in df.columns:
                        if 'RUN' in col.upper():
                            defunciones_set.update(df[col].apply(clean_run).dropna().unique())
                            break
            except Exception as e2:
                print(f"    Error leyendo {os.path.basename(archivo)}: {e2}")
                
    print(f"Total RUN fallecidos históricos encontrados: {len(defunciones_set)}")
    return defunciones_set

def main():
    print("Iniciando cruce de Rescates para AM Cronicos Respiratorios...")
    
    csv_path = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Influenza_Residencia_2026.csv"
    excel_path = r"C:\Antigravity IDE\WEB DEIS\Vac. Influenza AM Crónicos Respiratorios 06.08.2026 .xlsx"
    output_path = r"C:\Antigravity IDE\WEB DEIS\Influenza_Web\Rescates_Influenza_Cronicos_2026.xlsx"
    password = "DEIS2026"
    
    # 1. Obtener defunciones
    defunciones_set = leer_defunciones()
    
    print(f"\nLeyendo base de vacunacion: {csv_path}")
    try:
        df_vac = pd.read_csv(csv_path, sep="|", encoding="utf-8", dtype=str)
    except UnicodeDecodeError:
        df_vac = pd.read_csv(csv_path, sep="|", encoding="latin-1", dtype=str)
        
    print(f"Total registros originales CSV: {len(df_vac)}")
    
    df_vac['VACUNA_ADMINISTRADA'] = df_vac['VACUNA_ADMINISTRADA'].fillna("").astype(str).str.strip().str.upper()
    df_vac['REGISTRO_ELIMINADO'] = df_vac['REGISTRO_ELIMINADO'].fillna("NO").astype(str).str.strip().str.upper()
    df_vac['CRITERIO_ELEGIBILIDAD'] = df_vac['CRITERIO_ELEGIBILIDAD'].fillna("").astype(str).str.strip().str.upper()
    df_vac['DOSIS'] = df_vac['DOSIS'].fillna("").astype(str).str.strip().str.upper()
    
    mask = (
        (df_vac['VACUNA_ADMINISTRADA'] == 'SI') & 
        (df_vac['REGISTRO_ELIMINADO'] != 'SI') & 
        (df_vac['CRITERIO_ELEGIBILIDAD'] != 'EPRO') & 
        (df_vac['DOSIS'] != 'EPRO')
    )
    df_vac_filtered = df_vac[mask]
    
    print(f"Total registros CSV tras filtros: {len(df_vac_filtered)}")
    
    if 'RUN' not in df_vac_filtered.columns:
        print("ERROR: Columna 'RUN' no encontrada en CSV.")
        return
        
    df_vac_filtered['RUN_CLEAN'] = df_vac_filtered['RUN'].apply(clean_run)
    vacunados_set = set(df_vac_filtered['RUN_CLEAN'].dropna().unique())
    print(f"Total RUN unicos vacunados: {len(vacunados_set)}")
    
    print(f"\nLeyendo nomina AM Cronicos: {excel_path}")
    df_cronicos = pd.read_excel(excel_path)
    print(f"Total registros en nomina inicial: {len(df_cronicos)}")
    
    if 'Run' not in df_cronicos.columns:
        print(f"ERROR: Columna 'Run' no encontrada en el Excel. Columnas: {df_cronicos.columns.tolist()}")
        return
        
    df_cronicos['RUN_CLEAN'] = df_cronicos['Run'].apply(clean_run)
    
    # 2. Marcar fallecidos en lugar de eliminarlos
    df_cronicos['ESTADO_VITAL'] = df_cronicos['RUN_CLEAN'].apply(lambda x: 'FALLECIDO' if x in defunciones_set else 'VIVO')
    fallecidos_total = len(df_cronicos[df_cronicos['ESTADO_VITAL'] == 'FALLECIDO'])
    print(f"Total personas fallecidas detectadas en la nómina original: {fallecidos_total}")
    
    # 3. Filtrar vacunados (mantenemos a los fallecidos en la lista de pendientes para informar al CESFAM)
    df_pendientes = df_cronicos[~df_cronicos['RUN_CLEAN'].isin(vacunados_set)].copy()
    
    fallecidos_pendientes = len(df_pendientes[df_pendientes['ESTADO_VITAL'] == 'FALLECIDO'])
    vivos_pendientes = len(df_pendientes[df_pendientes['ESTADO_VITAL'] == 'VIVO'])
    print(f"Total rezagados (pendientes): {len(df_pendientes)} (Vivos: {vivos_pendientes}, Fallecidos: {fallecidos_pendientes})")
    
    df_pendientes = df_pendientes.drop(columns=['RUN_CLEAN'])
    
    print(f"\nGuardando nomina de pendientes en: {output_path}")
    writer = pd.ExcelWriter(output_path, engine='xlsxwriter')
    df_pendientes.to_excel(writer, index=False, sheet_name="Pendientes")
    worksheet = writer.sheets["Pendientes"]
    for i, col in enumerate(df_pendientes.columns):
        # Calculate max string length safely
        col_len = df_pendientes[col].astype(str).str.len().max()
        if pd.isna(col_len):
            col_len = 0
        col_len = max(col_len, len(str(col))) + 2
        worksheet.set_column(i, i, col_len)
    writer.close()
    
    try:
        import win32com.client
        print(f"Cifrando archivo con contrasena '{password}'...")
        excel = win32com.client.Dispatch("Excel.Application")
        excel.DisplayAlerts = False
        abs_path = os.path.abspath(output_path)
        
        wb = excel.Workbooks.Open(abs_path)
        wb.Password = password
        wb.SaveAs(abs_path, Password=password)
        wb.Close()
        excel.Quit()
        print("Archivo cifrado exitosamente!")
    except Exception as e:
        print(f"ADVERTENCIA: No se pudo cifrar el archivo con win32com. Error: {e}")

if __name__ == '__main__':
    main()
