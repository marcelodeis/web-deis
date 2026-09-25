import pandas as pd
import os
import re
from datetime import datetime

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
    
    archivos_def = []
    # Solo usar archivos de los últimos 4 años (2023-2026) según solicitud
    archivos_permitidos = ["DEF2023.CSV", "DEF2023.XLSX", "DEF2024.CSV", "DEF2024.XLSX", "DEF2025.CSV", "DEF2025.XLSX", "DEF2026.CSV", "DEF2026.XLSX"]
    for root, _, files in os.walk(base_dir):
        for f in files:
            if f.upper() in archivos_permitidos:
                archivos_def.append(os.path.join(root, f))
                
    for archivo in sorted(archivos_def):
        try:
            if archivo.endswith(".csv"):
                df = pd.read_csv(archivo, sep="|", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
                if df.empty:
                    df = pd.read_csv(archivo, sep=";", usecols=lambda c: 'RUN' in str(c).upper(), dtype=str, encoding='utf-8')
            else:
                df = pd.read_excel(archivo, usecols=lambda c: 'RUN' in str(c).upper(), dtype=str)
                
            for col in df.columns:
                if 'RUN' in col.upper():
                    cleaned = df[col].apply(clean_run)
                    defunciones_set.update(cleaned.dropna().unique())
                    break 
                    
        except Exception as e:
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
    
    try:
        if 'FECHA_INMUNIZACION' in df_vac_filtered.columns:
            fechas_dt = pd.to_datetime(df_vac_filtered['FECHA_INMUNIZACION'], format="%Y-%m-%d", errors="coerce")
            max_date_str = fechas_dt.max().strftime("%d-%m-%Y")
        else:
            max_date_str = datetime.fromtimestamp(os.path.getmtime(csv_path)).strftime("%d-%m-%Y")
    except:
        max_date_str = datetime.now().strftime("%d-%m-%Y")
        
    print(f"\nLeyendo nomina AM Cronicos: {excel_path}")
    df_cronicos = pd.read_excel(excel_path)
    print(f"Total registros en nomina inicial: {len(df_cronicos)}")
    
    if 'Run' not in df_cronicos.columns:
        print(f"ERROR: Columna 'Run' no encontrada en el Excel. Columnas: {df_cronicos.columns.tolist()}")
        return
        
    df_cronicos['RUN_CLEAN'] = df_cronicos['Run'].apply(clean_run)
    
    # 2. Marcar fallecidos
    df_cronicos['ESTADO_VITAL'] = df_cronicos['RUN_CLEAN'].apply(lambda x: 'FALLECIDO' if x in defunciones_set else 'VIVO')
    
    # 3. Filtrar vacunados
    df_pendientes = df_cronicos[~df_cronicos['RUN_CLEAN'].isin(vacunados_set)].copy()
    
    df_pendientes = df_pendientes.drop(columns=['RUN_CLEAN'])
    
    # Identificar las columnas de comuna y establecimiento
    col_comuna = next((c for c in df_pendientes.columns if 'Comuna' in c), None)
    col_estab = next((c for c in df_pendientes.columns if 'Establecimiento' in c), None)

    # Preparar datos de resumen (excluyendo fallecidos del total general activo o mostrandolos? vamos a agrupar todos los pendientes vivos y fallecidos juntos, o tal vez solo vivos?)
    # Usaremos todos los que quedaron en df_pendientes, tal como estaba antes.
    summary_data = []
    total_general = len(df_pendientes)
    
    if col_comuna and col_estab:
        df_pendientes[col_comuna] = df_pendientes[col_comuna].fillna('SIN COMUNA').astype(str)
        df_pendientes[col_estab] = df_pendientes[col_estab].fillna('SIN ESTABLECIMIENTO').astype(str)
        comunas = sorted(df_pendientes[col_comuna].unique())
        
        for comuna in comunas:
            df_comuna = df_pendientes[df_pendientes[col_comuna] == comuna]
            total_comuna = len(df_comuna)
            summary_data.append({'COMUNA_ESTABLECIMIENTO': f"- {comuna}", 'TOTAL': total_comuna, 'IS_COMUNA': True})
            
            estab_counts = df_comuna[col_estab].value_counts()
            for estab, count in estab_counts.items():
                summary_data.append({'COMUNA_ESTABLECIMIENTO': f"    {estab}", 'TOTAL': count, 'IS_COMUNA': False})

    print(f"\nGuardando nomina de pendientes en: {output_path}")
    writer = pd.ExcelWriter(output_path, engine='xlsxwriter')
    workbook = writer.book
    
    # ----------------
    # HOJA: BASE DATOS
    # ----------------
    worksheet = workbook.add_worksheet('BASE DATOS')
    worksheet.hide_gridlines(2)
    
    fmt_header = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#ef4444', # Color rojo de la tarjeta
        'border': 1, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True,
        'font_name': 'Segoe UI', 'size': 10
    })
    fmt_data = workbook.add_format({'border': 1, 'font_name': 'Segoe UI', 'size': 10})
    title_fmt = workbook.add_format({'bold': True, 'size': 14, 'font_name': 'Segoe UI', 'font_color': '#ef4444'})
    
    worksheet.write('A1', f'NÓMINA DE RESCATES INFLUENZA 2026 - AM CRÓNICOS RESPIRATORIOS', title_fmt)
    worksheet.write('A2', f'Filtro aplicado: Adultos Mayores Crónicos sin registro de vacunación | Fecha de corte base: {max_date_str}', workbook.add_format({'italic': True, 'font_name': 'Segoe UI', 'size': 10}))
    
    for col_num, value in enumerate(df_pendientes.columns):
        worksheet.write(3, col_num, value, fmt_header)
        col_len = df_pendientes[value].astype(str).str.len().max()
        if pd.isna(col_len):
            col_len = 0
        col_len = max(col_len, len(str(value))) + 2
        worksheet.set_column(col_num, col_num, min(col_len, 40))
        
    for row_idx, row_data in enumerate(df_pendientes.values):
        for col_idx, value in enumerate(row_data):
            val = "" if pd.isna(value) else str(value)
            worksheet.write(row_idx + 4, col_idx, val, fmt_data)
            
    # ----------------
    # HOJA: RESUMEN
    # ----------------
    ws_res = workbook.add_worksheet('RESUMEN')
    ws_res.hide_gridlines(2)

    fmt_res_titlebox = workbook.add_format({
        'bold': True, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True,
        'bg_color': '#fcf6d6', 'border': 1, 'font_name': 'Times New Roman', 'size': 11
    })
    fmt_res_subtitle = workbook.add_format({
        'bold': True, 'align': 'center', 'font_name': 'Times New Roman', 'size': 11
    })
    fmt_res_italic = workbook.add_format({
        'italic': True, 'font_name': 'Times New Roman', 'size': 10
    })
    
    fmt_res_header = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#1f3864', 'border': 1,
        'align': 'left', 'valign': 'vcenter', 'font_name': 'Tahoma', 'size': 10
    })
    fmt_res_header_num = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#1f3864', 'border': 1,
        'align': 'center', 'valign': 'vcenter', 'font_name': 'Tahoma', 'size': 10
    })
    
    fmt_res_comuna = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#8eaadb', 'border': 1,
        'align': 'left', 'font_name': 'Tahoma', 'size': 10
    })
    fmt_res_comuna_num = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#8eaadb', 'border': 1,
        'align': 'center', 'font_name': 'Tahoma', 'size': 10
    })
    
    fmt_res_estab = workbook.add_format({
        'border': 1, 'align': 'left', 'font_name': 'Tahoma', 'size': 10
    })
    fmt_res_estab_num = workbook.add_format({
        'border': 1, 'align': 'center', 'font_name': 'Tahoma', 'size': 10
    })
    
    fmt_res_total_lbl = workbook.add_format({
        'bold': True, 'border': 1, 'align': 'left', 'font_name': 'Tahoma', 'size': 10
    })
    fmt_res_total_num = workbook.add_format({
        'bold': True, 'border': 1, 'align': 'center', 'font_name': 'Tahoma', 'size': 10
    })

    ws_res.set_column('A:A', 60)
    ws_res.set_column('B:B', 15)

    ws_res.merge_range('A2:B4', 'Adultos Mayores Crónicos Respiratorios sin registro de vacunación Influenza 2026.', fmt_res_titlebox)
    ws_res.merge_range('A6:B6', 'SS. Osorno', fmt_res_subtitle)
    ws_res.merge_range('A8:B8', f'Fuente DEIS-MINSAL con fecha de extracción {max_date_str}', fmt_res_italic)

    ws_res.write('A11', 'COMUNA / ESTABLECIMIENTO:', fmt_res_header)
    ws_res.write('B11', 'N°', fmt_res_header_num)

    row_idx = 11
    if summary_data:
        for item in summary_data:
            if item['IS_COMUNA']:
                ws_res.write(row_idx, 0, item['COMUNA_ESTABLECIMIENTO'], fmt_res_comuna)
                ws_res.write(row_idx, 1, item['TOTAL'], fmt_res_comuna_num)
            else:
                ws_res.write(row_idx, 0, item['COMUNA_ESTABLECIMIENTO'], fmt_res_estab)
                ws_res.write(row_idx, 1, item['TOTAL'], fmt_res_estab_num)
            row_idx += 1
    else:
        ws_res.write(row_idx, 0, "Sin información de comuna/establecimiento", fmt_res_estab)
        ws_res.write(row_idx, 1, total_general, fmt_res_estab_num)
        row_idx += 1

    ws_res.write(row_idx, 0, 'Total general', fmt_res_total_lbl)
    ws_res.write(row_idx, 1, total_general, fmt_res_total_num)
    ws_res.set_row(row_idx, None, workbook.add_format({'bottom': 6})) 

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
