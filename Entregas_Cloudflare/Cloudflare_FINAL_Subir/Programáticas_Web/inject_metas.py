import json
import re

# Read original 2026 js to extract metas
with open('programaticas_data_2026.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Naive JSON extraction (find metas object)
match = re.search(r'"metas":\s*(\{.*?\})\n}', text, re.DOTALL)
if match:
    metas_json = match.group(1)
    metas = json.loads(metas_json)
else:
    # Try another regex
    match = re.search(r'"metas":\s*(\{.*?\n  \})', text, re.DOTALL)
    metas = json.loads(match.group(1)) if match else {}

# Update the ALL data
with open('programaticas_data_all.js', 'r', encoding='utf-8') as f:
    content = f.read()
    json_str = content.replace('var PROGRAMATICAS_DATA_ALL = ', '').strip().rstrip(';')
    data_all = json.loads(json_str)

for year in ["2025", "2026"]:
    data_all[year]["metas"] = metas

with open('programaticas_data_all.js', 'w', encoding='utf-8') as f:
    f.write('var PROGRAMATICAS_DATA_ALL = ')
    json.dump(data_all, f, ensure_ascii=False, indent=2)
    f.write(';\n')
print("Metas injected successfully!")
