import json, io, os

json_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\programaticas_rescates.json'
js_out_path = r'C:\Antigravity IDE\WEB DEIS\Programáticas_Web\data_rescates_v5.js'

with io.open(json_path, 'r', encoding='utf-8') as f:
    data = f.read()

# Wrap the JSON in a window variable assignment
js_content = f"window.rescatesDataV5 = {data};\n"

with io.open(js_out_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print('data_rescates_v5.js generated successfully!')
