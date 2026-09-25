import pandas as pd
import glob
import os
import random

BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"

def extract_cuerpo(run):
    if pd.isna(run): return ""
    s = str(run).upper().replace('.', '').replace(' ', '').replace('-', '').strip()
    if s.endswith('.0'): s = s[:-2]
    # Remove leading zeros
    s = s.lstrip('0')
    if not s: return ""
    return s

def test_def_cuerpo():
    print("=== QA RUN CUERPO: DEF vs PROGRAMÁTICAS ===")
    
    # 1. Extraer Programaticas
    files_prog = glob.glob(os.path.join(BASE_DIR, '2026', 'Programáticas_*.csv'))
    prog_cuerpos = set()
    prog_samples = []
    
    for f in files_prog:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', usecols=['RUN'], dtype=str)
            raw = df['RUN'].dropna()
            for r in raw:
                cuerpo = extract_cuerpo(r)
                if len(cuerpo) > 1:
                    cuerpo = cuerpo[:-1] # Drop DV
                    prog_cuerpos.add(cuerpo)
                    if len(prog_samples) < 20: prog_samples.append((r, cuerpo))
        except: pass

    # 2. Extraer DEF
    files_def = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    def_cuerpos = set()
    def_samples = []
    
    for f in sorted(files_def):
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: 'RUN' in c.upper())
            rcol = next((c for c in df.columns if 'RUN' in c.upper()), None)
            if rcol:
                raw = df[rcol].dropna()
                for r in raw:
                    cuerpo = extract_cuerpo(r)
                    if cuerpo:
                        # DEF is already cuerpo, no DV to drop
                        def_cuerpos.add(cuerpo)
                        if len(def_samples) < 20: def_samples.append((r, cuerpo))
        except: pass
        
    print(f"RUN cuerpo únicos Programáticas: {len(prog_cuerpos)}")
    print(f"RUN cuerpo únicos DEF: {len(def_cuerpos)}")
    
    inter = prog_cuerpos.intersection(def_cuerpos)
    print(f"Cantidad exacta de intersecciones: {len(inter)}")
    
    if len(inter) > 0:
        print("Muestra intersección:")
        print(list(inter)[:5])
    else:
        print("\n--- MUESTRA 20 PROGRAMÁTICAS (Raw vs Cuerpo) ---")
        for raw, c in prog_samples: print(f"Raw: {raw:<15} | Cuerpo: {c} (Len: {len(c)})")
        print("\n--- MUESTRA 20 DEF (Raw vs Cuerpo) ---")
        for raw, c in def_samples: print(f"Raw: {raw:<15} | Cuerpo: {c} (Len: {len(c)})")

if __name__ == '__main__':
    test_def_cuerpo()
