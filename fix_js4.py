import os

files = [
    r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js'
]

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    start_str = "// Generar HTML del Mini-Informe Estadístico"
    end_str = "        const dropZone = document.getElementById('autoconsultaDropZone');"

    if start_str in content and end_str in content:
        start_idx = content.find(start_str)
        # We find the insertion of statsHTML just before the end of the template literal 
        # Wait, the error is at line 435. Let's just fix the template literals using replace.
        
        content = content.replace("statsHTML += \n                <div", "statsHTML += \n                <div")
        content = content.replace("statsHTML +=\n                <div", "statsHTML += \n                <div")
        content = content.replace("statsHTML += \n                    <div", "statsHTML += \n                    <div")
        content = content.replace("statsHTML +=\n                    <div", "statsHTML += \n                    <div")
        content = content.replace("statsHTML += \n                            <div", "statsHTML += \n                            <div")
        content = content.replace("statsHTML +=\n                            <div", "statsHTML += \n                            <div")
        content = content.replace("statsHTML += \n                        </div>", "statsHTML += \n                        </div>")
        content = content.replace("statsHTML +=\n                        </div>", "statsHTML += \n                        </div>")

        content = content.replace("\n            ;\n", "\n            ;\n")
        content = content.replace("\n                ;\n", "\n                ;\n")
        content = content.replace("\n                    ;\n", "\n                    ;\n")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
for f in files:
    fix_file(f)
