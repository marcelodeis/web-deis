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

def main():
    print("Iniciando cruce de Rescates para AM Cronicos Respiratorios...")
    
    csv_path = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Influenza_Residencia_2026.csv"
    excel_path = r"C:\Antigravity IDE\WEB DEIS\Vac. Influenza AM Crónicos Respiratorios 06.08.2026 .xlsx"
    output_path = r"C:\Antigravity IDE\WEB DEIS\Influenza_Web\Rescates_Influenza_Cronicos_2026.xlsx"
    password = "DEIS2026"
    
    print(f"Leyendo base de vacunacion: {csv_path}")
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
    print(f"Total registros en nomina: {len(df_cronicos)}")
    
    if 'Run' not in df_cronicos.columns:
        print(f"ERROR: Columna 'Run' no encontrada en el Excel. Columnas: {df_cronicos.columns.tolist()}")
        return
        
    df_cronicos['RUN_CLEAN'] = df_cronicos['Run'].apply(clean_run)
    
    df_pendientes = df_cronicos[~df_cronicos['RUN_CLEAN'].isin(vacunados_set)].copy()
    print(f"Total rezagados (pendientes): {len(df_pendientes)}")
    
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
