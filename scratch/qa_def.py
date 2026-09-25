import pandas as pd
import glob
import os
import random

BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"

def raw_inspect():
    print("=== QA RUN: DEF vs PROGRAMÁTICAS ===")
    
    # Get 20 from Programáticas
    prog_files = glob.glob(os.path.join(BASE_DIR, '2026', 'Programáticas_*.csv'))
    prog_runs = []
    for f in prog_files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', usecols=['RUN'], dtype=str)
            prog_runs.extend(df['RUN'].dropna().tolist())
            if len(prog_runs) > 100: break
        except: pass
        
    # Get 20 from DEF
    def_files = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    def_runs = []
    for f in def_files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, nrows=5000)
            rcol = next((c for c in df.columns if 'RUN' in c.upper() or 'RUT' in c.upper()), None)
            if rcol: def_runs.extend(df[rcol].dropna().tolist())
        except: pass
        
    random.seed(42)
    s_prog = random.sample(prog_runs, min(20, len(prog_runs)))
    s_def = random.sample(def_runs, min(20, len(def_runs)))
    
    print("\n--- 20 RUN PROGRAMÁTICAS ORIGINALES ---")
    for r in s_prog: print(f"Raw: '{r}' | Len: {len(r)}")
        
    print("\n--- 20 RUN DEF ORIGINALES ---")
    for r in s_def: print(f"Raw: '{r}' | Len: {len(r)}")

    # Let's write a smart digit extractor
    def get_digits(run):
        if pd.isna(run): return ""
        s = str(run).upper().replace('.', '').replace(' ', '').replace('-', '').strip()
        if len(s) > 1: return s[:-1] # return all but last char as digits (assuming last is DV or it's missing DV? Wait!)
        return s
        
    # Wait, what if DEF is purely digits without DV? Then s[:-1] drops the last digit!
    # I will inspect the raw output first.

if __name__ == '__main__':
    raw_inspect()
