import os

files = ['Influenza_Web/autoconsulta.js', 'Covid_Web/autoconsulta.js', 'VRS/autoconsulta.js', 'VPH_Web/autoconsulta.js']

for f in files:
    path = os.path.join(r"C:\Antigravity IDE\WEB DEIS", f)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    campaign_name = "Campaña de Vacunación"
    if "Influenza" in f:
        campaign_name = "Campaña Influenza 2026"
    elif "Covid" in f:
        campaign_name = "Campaña COVID-19 2026"
    elif "VRS" in f:
        campaign_name = "Campaña Nirsevimab (VRS) 2026"
    elif "VPH" in f:
        campaign_name = "Campaña VPH 2026"
        
    old_str = "El cruce automatizado ha procesado exitosamente una cohorte de <strong>${(r.total || 0).toLocaleString('es-CL')}</strong> registros válidos`;"
    new_str = f"El cruce automatizado ha procesado exitosamente una cohorte de <strong>${{(r.total || 0).toLocaleString('es-CL')}}</strong> registros válidos correspondientes a la <strong>{campaign_name}</strong>`;"
    
    if old_str in content:
        content = content.replace(old_str, new_str)
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Updated campaign text in {f} to {campaign_name}")
    else:
        print(f"String not found in {f}")
