import pandas as pd

filepath = r"C:\Antigravity IDE\WEB DEIS\COBERTURA ESCOLAR POR COMUNA 2026-08-31.xlsx"
df = pd.read_excel(filepath)
print(df.head(20))
print(df.columns)
