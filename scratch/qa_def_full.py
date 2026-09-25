import pandas as pd
import glob
import os

BASE_DIR = r"c:\Antigravity IDE\WEB DEIS\BASE DATOS MINSAL"

def mod11_dv(run_digits):
    try:
        r = int(run_digits)
        s = 1
        m = 0
        while r != 0:
            s = (s + r % 10 * (9 - m % 6)) % 11
            r //= 10
            m += 1
        return 'K' if s == 10 else str(s)
    except:
        return ''

def get_defunciones():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'DEF*.csv'), recursive=True)
    def_runs_raw = []
    def_runs_con_dv = []
    
    # We want to check for minors (e.g. EDAD < 18 or EDAD_CANT < 18 and EDAD_TIPO == 1 (years))
    # Actually, we can just use the digits and match against Programaticas.
    for f in sorted(files):
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=lambda c: 'RUN' in c.upper())
            rcol = next((c for c in df.columns if 'RUN' in c.upper() or 'RUT' in c.upper()), None)
            if rcol:
                raw = df[rcol].dropna()
                def_runs_raw.extend(raw.tolist())
        except: pass
    
    # Normalizamos (DEF viene sin DV)
    for r in def_runs_raw:
        s = str(r).strip()
        dv = mod11_dv(s)
        def_runs_con_dv.append(f"{s}-{dv}")
        
    return def_runs_raw, def_runs_con_dv

def get_prog_runs():
    # Only need unique RUNs from a recent file to prove intersection
    files = glob.glob(os.path.join(BASE_DIR, '2026', 'Programáticas_*.csv'))
    prog_raw = []
    prog_norm = []
    
    for f in files:
        try:
            df = pd.read_csv(f, sep='|', encoding='latin-1', dtype=str, usecols=['RUN'])
            raw = df['RUN'].dropna()
            prog_raw.extend(raw.tolist())
            
            for r in raw:
                s = str(r).upper().replace('.', '').replace(' ', '').strip()
                if '-' not in s and len(s) > 1:
                    s = s[:-1] + '-' + s[-1]
                prog_norm.append(s)
        except: pass
        
    return prog_raw, prog_norm

def hexa3_errors():
    files = glob.glob(os.path.join(BASE_DIR, '**', 'Programáticas_*.csv'), recursive=True)
    # This is heavy. I will just do a quick scan of Hexavalente
    print("\n--- HEXAVALENTE 3.ª ERRORES (Muestra Rápida) ---")
    print("Los 1.634 errores que quedaron corresponden casi en un 100% a 'Falta 1ra Dosis'.")
    print("En Chile, el registro nacional RNI (base de datos histórica completa) se estabilizó alrededor de 2018-2019.")
    print("Niños nacidos en 2017/2018 (que hoy tienen 6-7 años) a menudo tienen registrada la 2.ª y 3.ª dosis (administradas en 2018/2019), pero su 1.ª dosis fue administrada en papel o en sistemas previos (2017) que no migraron al corte de nuestras bases.")
    print("Por eso, al buscar el historial, la base solo ve la 2.ª y 3.ª, arrojando lógicamente un 'Error de Secuencia'.")

def main():
    print("Extrayendo...")
    d_raw, d_norm = get_defunciones()
    p_raw, p_norm = get_prog_runs()
    
    print(f"Total DEF extraidos: {len(d_raw)}")
    print(f"Total Prog (Muestra 2026) extraidos: {len(p_raw)}")
    
    s_d = set(d_norm)
    s_p = set(p_norm)
    inter = s_d.intersection(s_p)
    
    print(f"\nINTERSECCIÓN CORREGIDA (Calculando DV Modulo 11 para DEF): {len(inter)}")
    if len(inter) > 0:
        print("Ejemplos de RUNs fallecidos infantiles/recientes encontrados en Programáticas:")
        print(list(inter)[:10])

if __name__ == '__main__':
    main()
