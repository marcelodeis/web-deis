import os

influenza_css = r'C:\Antigravity IDE\WEB DEIS\Influenza_Web\styles.css'
with open(influenza_css, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if 'AUTOCONSULTA' in line and 'MODULO' in line:
        start_idx = i
        break

if start_idx == -1:
    print('Not found')
    exit(1)

autoconsulta_css = lines[start_idx:]

# Modify the banner and items to have separators
for i, line in enumerate(autoconsulta_css):
    if line.startswith('.autoconsulta-info-banner {'):
        # We will just append overrides at the very end
        break

autoconsulta_css.append("\n/* Visual separation for banner */\n")
autoconsulta_css.append(".autoconsulta-info-banner {\n")
autoconsulta_css.append("    gap: 0 !important;\n")
autoconsulta_css.append("    padding: 0 !important;\n")
autoconsulta_css.append("    overflow: hidden;\n")
autoconsulta_css.append("}\n")
autoconsulta_css.append(".autoconsulta-info-item {\n")
autoconsulta_css.append("    padding: 1rem 1.5rem;\n")
autoconsulta_css.append("    border-bottom: 1px solid rgba(15, 105, 180, 0.1);\n")
autoconsulta_css.append("}\n")
autoconsulta_css.append(".autoconsulta-info-item:last-child {\n")
autoconsulta_css.append("    border-bottom: none;\n")
autoconsulta_css.append("}\n")

# Responsive row on large screens
autoconsulta_css.append("@media (min-width: 1024px) {\n")
autoconsulta_css.append("    .autoconsulta-info-banner {\n")
autoconsulta_css.append("        flex-direction: row !important;\n")
autoconsulta_css.append("    }\n")
autoconsulta_css.append("    .autoconsulta-info-item {\n")
autoconsulta_css.append("        flex: 1;\n")
autoconsulta_css.append("        border-bottom: none;\n")
autoconsulta_css.append("        border-right: 1px solid rgba(15, 105, 180, 0.1);\n")
autoconsulta_css.append("    }\n")
autoconsulta_css.append("    .autoconsulta-info-item:last-child {\n")
autoconsulta_css.append("        border-right: none;\n")
autoconsulta_css.append("    }\n")
autoconsulta_css.append("}\n")

autoconsulta_css_str = ''.join(autoconsulta_css)

# Update Influenza
with open(influenza_css, 'w', encoding='utf-8') as f:
    f.writelines(lines[:start_idx])
    f.write(autoconsulta_css_str)

# Update others
others = [
    r'C:\Antigravity IDE\WEB DEIS\Covid_Web\styles.css',
    r'C:\Antigravity IDE\WEB DEIS\VRS\styles.css',
    r'C:\Antigravity IDE\WEB DEIS\VPH_Web\styles.css'
]

for other in others:
    with open(other, 'r', encoding='utf-8') as f:
        other_lines = f.readlines()
        
    other_start = -1
    for i, line in enumerate(other_lines):
        if 'AUTOCONSULTA' in line and 'MODULO' in line:
            other_start = i
            break
            
    with open(other, 'w', encoding='utf-8') as f:
        if other_start != -1:
            f.writelines(other_lines[:other_start])
        else:
            f.writelines(other_lines)
            f.write('\n\n')
        f.write(autoconsulta_css_str)

print('Done')
