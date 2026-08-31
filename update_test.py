import pandas as pd
import random

# Read the existing test excel
file_path = r'C:\Antigravity IDE\WEB DEIS\scratch\test_autoconsulta.xlsx'
if os.path.exists(file_path):
    df = pd.read_excel(file_path)
    
    # Add new columns
    comunas = ['OSORNO', 'PURRANQUE', 'RIO NEGRO']
    centros = ['CESFAM 1', 'CESFAM 2', 'HOSPITAL BASE']
    
    df['NOMBRE_COMUNA'] = [random.choice(comunas) for _ in range(len(df))]
    df['NOMBRE_CENTRO'] = [random.choice(centros) for _ in range(len(df))]
    
    df.to_excel(file_path, index=False)
    print('Updated test file with comuna and centro columns.')
else:
    print('Test file not found.')
