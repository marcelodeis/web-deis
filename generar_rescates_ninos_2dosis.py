import pandas as pd
import os
from datetime import datetime, timedelta

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
    print("Iniciando generación de Rescates Niños 2da Dosis Influenza (Osorno)...")
    csv_path = r"C:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL\2026\Influenza_Ocurrencia_2026.csv"
    excel_dir = r"C:\Antigravity IDE\WEB DEIS\Influenza_Web"
    os.makedirs(excel_dir, exist_ok=True)
    output_path = os.path.join(excel_dir, "Rescates_Influenza_Ninos2Dosis_2026.xlsx")
    password = "DEIS2026"

    # Leer CSV
    print(f"Leyendo base de vacunacion: {csv_path}")
    cols = ['RUN', 'NOMBRES', 'APELLIDO_PATERNO', 'APELLIDO_MATERNO', 'FECHA_INMUNIZACION', 
            'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'CRITERIO_ELEGIBILIDAD', 'DOSIS', 
            'SERVICIO', 'COMUNA_OCURR', 'ESTABLECIMIENTO', 'TELEFONO', 'CORREO_ELECTRONICO']
    try:
        df = pd.read_csv(csv_path, sep="|", encoding="utf-8", usecols=cols, dtype=str)
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, sep="|", encoding="latin-1", usecols=cols, dtype=str)

    print(f"Total registros originales CSV: {len(df)}")

    df['VACUNA_ADMINISTRADA'] = df['VACUNA_ADMINISTRADA'].fillna("").astype(str).str.strip().str.upper()
    df['REGISTRO_ELIMINADO'] = df['REGISTRO_ELIMINADO'].fillna("NO").astype(str).str.strip().str.upper()
    df['CRITERIO_ELEGIBILIDAD'] = df['CRITERIO_ELEGIBILIDAD'].fillna("").astype(str).str.strip()
    df['DOSIS'] = df['DOSIS'].fillna("").astype(str).str.strip().str.upper()
    df['SERVICIO'] = df['SERVICIO'].fillna("").astype(str).str.strip()
    df['COMUNA_OCURR'] = df['COMUNA_OCURR'].fillna("").astype(str).str.strip()
    df['ESTABLECIMIENTO'] = df['ESTABLECIMIENTO'].fillna("").astype(str).str.strip()
    df['RUN_CLEAN'] = df['RUN'].apply(clean_run)
    df['FECHA_INMUNIZACION_DT'] = pd.to_datetime(df['FECHA_INMUNIZACION'], format='%Y-%m-%d', errors='coerce')

    # Filtrar válidos (Vacuna = SI, Eliminado != SI, Criterio != EPRO, Dosis != EPRO, y SERVICIO = S.S. Osorno)
    mask_validos = (
        (df['VACUNA_ADMINISTRADA'] == 'SI') & 
        (df['REGISTRO_ELIMINADO'] != 'SI') & 
        (df['CRITERIO_ELEGIBILIDAD'].str.upper() != 'EPRO') & 
        (df['DOSIS'] != 'EPRO') &
        (df['RUN_CLEAN'] != "") &
        (df['SERVICIO'].str.upper() == 'S.S. OSORNO')
    )
    df_validos = df[mask_validos].copy()

    # Obtener max_date para calcular los 28 días
    max_date = df_validos['FECHA_INMUNIZACION_DT'].max()
    max_date_str = max_date.strftime("%d/%m/%Y") if not pd.isna(max_date) else datetime.now().strftime("%d/%m/%Y")
    corte_28_dias = max_date - timedelta(days=28) if not pd.isna(max_date) else datetime.now() - timedelta(days=28)

    # Identificar las dosis de cada niño
    mask_ninos = df_validos['CRITERIO_ELEGIBILIDAD'].str.contains(r"meses a 5 a", case=False, na=False)
    runs_ninos = df_validos[mask_ninos]['RUN_CLEAN'].unique()
    
    df_ninos_all = df_validos[df_validos['RUN_CLEAN'].isin(runs_ninos)].copy()

    # Identificar quiénes tienen 2da dosis
    mask_segunda = df_ninos_all['DOSIS'].str.contains(r"2[ºª°]|2DA|SEGUNDA|2\s*dosis", regex=True)
    runs_con_segunda = set(df_ninos_all[mask_segunda]['RUN_CLEAN'].unique())

    # Identificar primera dosis (que sea de niño)
    mask_primera_nino = df_ninos_all['DOSIS'].str.contains(r"1[ºª°]|1RA|PRIMERA|1\s*dosis", regex=True) & df_ninos_all['CRITERIO_ELEGIBILIDAD'].str.contains(r"meses a 5 a", case=False, na=False)
    df_primeras = df_ninos_all[mask_primera_nino].copy()

    # Ordenar por fecha (quedarse con la última si hay duplicados de 1ra dosis por error)
    df_primeras = df_primeras.sort_values('FECHA_INMUNIZACION_DT', ascending=False)
    df_primeras = df_primeras.drop_duplicates(subset=['RUN_CLEAN'], keep='first')

    # Filtrar: los que NO tienen segunda dosis y su primera dosis fue hace más de 28 días
    df_rezagados = df_primeras[
        (~df_primeras['RUN_CLEAN'].isin(runs_con_segunda)) & 
        (df_primeras['FECHA_INMUNIZACION_DT'] <= corte_28_dias)
    ].copy()

    print(f"Total niños (6m a 5a) pendientes de 2da dosis (>28 días) en Osorno: {len(df_rezagados)}")

    # ==========================
    # DATOS PARA EL REPORTE
    # ==========================
    # BASE DATOS
    df_base = df_rezagados.drop(columns=['RUN_CLEAN', 'VACUNA_ADMINISTRADA', 'REGISTRO_ELIMINADO', 'FECHA_INMUNIZACION_DT', 'SERVICIO'])
    cols_order = [
        'RUN', 'NOMBRES', 'APELLIDO_PATERNO', 'APELLIDO_MATERNO', 'FECHA_INMUNIZACION',
        'CRITERIO_ELEGIBILIDAD', 'DOSIS', 'COMUNA_OCURR', 'ESTABLECIMIENTO',
        'TELEFONO', 'CORREO_ELECTRONICO'
    ]
    df_base = df_base[cols_order]

    # RESUMEN (Agrupación por Comuna y Establecimiento)
    summary_data = []
    # Ordenar comunas (opcional: alfabéticamente)
    comunas = sorted(df_rezagados['COMUNA_OCURR'].unique())
    total_general = len(df_rezagados)
    
    for comuna in comunas:
        df_comuna = df_rezagados[df_rezagados['COMUNA_OCURR'] == comuna]
        total_comuna = len(df_comuna)
        # Agregar fila de la comuna (ej: "- Osorno")
        summary_data.append({'COMUNA_ESTABLECIMIENTO': f"- {comuna}", 'TOTAL': total_comuna, 'IS_COMUNA': True})
        
        # Ordenar establecimientos por cantidad (descendente)
        estab_counts = df_comuna['ESTABLECIMIENTO'].value_counts()
        for estab, count in estab_counts.items():
            summary_data.append({'COMUNA_ESTABLECIMIENTO': f"    {estab}", 'TOTAL': count, 'IS_COMUNA': False})

    # ==========================
    # CREAR EXCEL
    # ==========================
    print(f"\nGuardando nomina en: {output_path}")
    writer = pd.ExcelWriter(output_path, engine='xlsxwriter')
    workbook = writer.book

    # ----------------
    # HOJA: BASE DATOS
    # ----------------
    ws_base = workbook.add_worksheet('BASE DATOS')
    ws_base.hide_gridlines(2)

    fmt_header = workbook.add_format({
        'bold': True, 'font_color': 'white', 'bg_color': '#eab308',
        'border': 1, 'align': 'center', 'valign': 'vcenter', 'text_wrap': True,
        'font_name': 'Segoe UI', 'size': 10
    })
    fmt_data = workbook.add_format({'border': 1, 'font_name': 'Segoe UI', 'size': 10})
    title_fmt = workbook.add_format({'bold': True, 'size': 14, 'font_name': 'Segoe UI', 'font_color': '#ca8a04'})
    
    ws_base.write('A1', 'NÓMINA RESCATES INFLUENZA 2026 - NIÑOS 6M A 5A SIN 2DA DOSIS (>28 DÍAS)', title_fmt)
    ws_base.write('A2', f'Fecha de corte base: {max_date_str} | Niños vacunados con 1ra dosis que aún no reciben la 2da dosis.', workbook.add_format({'italic': True, 'font_name': 'Segoe UI', 'size': 10}))

    for col_num, value in enumerate(df_base.columns):
        ws_base.write(3, col_num, value, fmt_header)
        col_len = min(40, max(len(str(value)), 12))
        ws_base.set_column(col_num, col_num, col_len)

    for row_idx, row_data in enumerate(df_base.values):
        for col_idx, value in enumerate(row_data):
            val = "" if pd.isna(value) else str(value)
            ws_base.write(row_idx + 4, col_idx, val, fmt_data)

    # ----------------
    # HOJA: RESUMEN
    # ----------------
    ws_res = workbook.add_worksheet('RESUMEN')
    ws_res.hide_gridlines(2)

    # Formatos para RESUMEN
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

    # Anchos de columna
    ws_res.set_column('A:A', 60)
    ws_res.set_column('B:B', 15)

    # Textos de encabezado
    ws_res.merge_range('A2:B4', 'Niños/as de 6 meses a 5 años con 1° dosis Influenza 2026 y sin 2° dosis tras más de 28 días desde la primera administracion de vacuna.', fmt_res_titlebox)
    ws_res.merge_range('A6:B6', 'SS. Osorno', fmt_res_subtitle)
    ws_res.merge_range('A8:B8', f'Fuente DEIS-MINSAL con fecha de extracción {max_date_str}', fmt_res_italic)

    # Tabla Header
    ws_res.write('A11', 'COMUNA / ESTABLECIMIENTO:', fmt_res_header)
    ws_res.write('B11', 'N°', fmt_res_header_num)

    # Filas de tabla
    row_idx = 11
    for item in summary_data:
        if item['IS_COMUNA']:
            ws_res.write(row_idx, 0, item['COMUNA_ESTABLECIMIENTO'], fmt_res_comuna)
            ws_res.write(row_idx, 1, item['TOTAL'], fmt_res_comuna_num)
        else:
            ws_res.write(row_idx, 0, item['COMUNA_ESTABLECIMIENTO'], fmt_res_estab)
            ws_res.write(row_idx, 1, item['TOTAL'], fmt_res_estab_num)
        row_idx += 1

    # Total General
    ws_res.write(row_idx, 0, 'Total general', fmt_res_total_lbl)
    ws_res.write(row_idx, 1, total_general, fmt_res_total_num)
    
    # Doble linea abajo del total general (opcional, simulando el screenshot)
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
