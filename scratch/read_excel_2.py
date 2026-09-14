import pandas as pd

filepath = r"C:\Antigravity IDE\WEB DEIS\COBERTURA ESCOLAR POR COMUNA 2026-08-31.xlsx"
df = pd.read_excel(filepath, sheet_name=0, header=2) # Try reading starting from row 2
print(df.head(10))
