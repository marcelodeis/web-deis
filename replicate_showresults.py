"""
Replicates the Influenza autoconsulta.js structure to Covid, VRS, and VPH.
Copies the entire showResults, toggleExportMenu, renderCharts, downloadPDF, _generatePDF methods
from Influenza to the other modules, preserving each module's unique processing logic.
"""
import re

# Read the Influenza file as the template
with open(r'c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js', 'r', encoding='utf-8') as f:
    influenza_content = f.read()

# Extract the showResults method and all new methods up to downloadResult
# We need to extract from "showResults() {" to "downloadResult() {"
pattern = r'(    showResults\(\) \{.*?)(    /\*\*\s*\n\s*\*\s*Descarga el reporte visual como PNG)'
match = re.search(pattern, influenza_content, flags=re.DOTALL)

if not match:
    print("Could not extract showResults block from Influenza")
    exit(1)

new_show_results_block = match.group(1)
print(f"Extracted showResults block: {len(new_show_results_block)} chars")

targets = [
    r'c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js',
    r'c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js',
]

for filepath in targets:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the same region in the target file
    target_pattern = r'(    showResults\(\) \{.*?)(    /\*\*\s*\n\s*\*\s*Descarga el reporte visual como PNG)'
    target_match = re.search(target_pattern, content, flags=re.DOTALL)
    
    if target_match:
        content = content[:target_match.start()] + new_show_results_block + target_match.group(2) + content[target_match.end():]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"Could not find showResults block in {filepath}")
