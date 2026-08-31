import os

files = [
    r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
]

rep_old = """                                <p style="font-size: 0.8rem; color: #475569; margin-top: 5px; margin-bottom: 0; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>Regla de Prioridad Operativa:</strong><br>
                                <span style="color: #991b1b; font-weight: 600;">Alta:</span> Proporción local sin registro >= ${(globalNo * 1.2).toFixed(1)}%, más de 10 personas sin registro y cohorte local > 30.<br>
                                <span style="color: #92400e; font-weight: 600;">Media:</span> (Proporción local sin registro > ${globalNo.toFixed(1)}% y > 5 casos) o (proporción local > ${(globalNo * 1.5).toFixed(1)}% y > 2 casos).<br>
                                <span style="color: #166534; font-weight: 600;">Baja:</span> Resto de establecimientos.</p>"""

rep_new = """                                <p style="font-size: 0.8rem; color: #475569; margin-top: 5px; margin-bottom: 0; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;"><strong>Regla de Prioridad Operativa:</strong><br>
                                <span style="color: #991b1b; font-weight: 600;">Alta:</span> Proporción local sin registro >= ${(parseFloat(pctNo) * 1.2).toFixed(1)}%, más de 10 personas sin registro y cohorte local > 30.<br>
                                <span style="color: #92400e; font-weight: 600;">Media:</span> (Proporción local sin registro > ${parseFloat(pctNo).toFixed(1)}% y > 5 casos) o (proporción local > ${(parseFloat(pctNo) * 1.5).toFixed(1)}% y > 2 casos).<br>
                                <span style="color: #166534; font-weight: 600;">Baja:</span> Resto de establecimientos.</p>"""

for path in files:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        content = content.replace(rep_old, rep_new)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {path}")
    else:
        print(f"File not found: {path}")
